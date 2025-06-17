import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import HtmlTemplate  from "../../common/models/purchaseOrderTemplate.model.js";
import puppeteer from 'puppeteer';
import handlebars from 'handlebars';

const Company = db.Company;
const User =db.User;
const PurchaseOrder = db.PurchaseOrder;
const PurchaseOrderItem = db.PurchaseOrderItem;
const ItemMaster = db.ItemMaster;
const PurchaseOrderReturn = db.PurchaseOrderReturn;
const Inventory = db.Inventory;
const GRNItem = db.GRNItem;
const GRN = db.GRN;
const PurchaseOrderReturnItem = db.PurchaseOrderReturnItem;
const Item = db.ItemMaster;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();

//Create Po
v1Router.post("/purchase-order", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const purchase_generate_id = await generateId(req.user.company_id, PurchaseOrder, "purchase");
    const { items, ...poData } = req.body;
    poData.purchase_generate_id = purchase_generate_id;
    poData.created_by = req.user.id;
    poData.updated_by = req.user.id;
    poData.company_id = req.user.company_id;

    const newPO = await PurchaseOrder.create(poData, { transaction });
    for (const item of items) {
      const isValid = await ItemMaster.findOne({
        where: { id: item.item_id, status: "active" },
        transaction,
      });

      if (!isValid) throw new Error(`Item ID ${item.item_id} is invalid or inactive`);

      await PurchaseOrderItem.create({
        ...item,
        po_id: newPO.id,
        company_id: poData.company_id,
        created_by: poData.created_by,
        updated_by: poData.updated_by
      }, { transaction });
    }

    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: "Purchase Order with items created successfully",
      data: newPO
    });

  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: `Creation Failed: ${error.message}`
    });
  }
});

//get all po
v1Router.get("/purchase-orders/ids", authenticateJWT, async (req, res) => {
  try {
    const usedPoIds = await GRN.findAll({
      attributes: ['po_id'],
      raw: true,
    });

    const poIdList = usedPoIds.map(g => g.po_id).filter(Boolean); // remove nulls if any



    const orders = await PurchaseOrder.findAll({
      attributes: ["id", "purchase_generate_id"],
      where: {
        company_id: req.user.company_id,
        decision:"approve",
        status:"active",
        id: {
          [Op.notIn]: poIdList
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase orders",
    });
  }
});





//get all Po
v1Router.get("/purchase-order", authenticateJWT, async (req, res) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, parseInt(limit));
    const offset = (pageNumber - 1) * limitNumber;

    let where = {};
    if (search.trim()) {
      where.supplier_name = { [Op.like]: `%${search}%` };
    }
    where.status="active";
    const data = await PurchaseOrder.findAll({
      where,
      limit: limitNumber,
      offset,
      order: [['created_at', 'DESC']],
      include: [{ model: PurchaseOrderItem }]  // Optional: include items
    });

    const totalCount = await PurchaseOrder.count({ where });

    return res.status(200).json({
      success: true,
      message: "Purchase orders fetched",
      data,
      totalCount,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Fetching failed: ${error.message}`,
    });
  }
});

//get one po
v1Router.get("/purchase-order/:id", authenticateJWT,async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({
      where: { id: req.params.id, status: "active" },
      include: [{ 
        model: PurchaseOrderItem,
        include: [
              {
                model: ItemMaster,
                as: "item_info", // Alias from GRNItem → ItemMaster association
                attributes: ["id", "item_generate_id"]
              }
            ] 
        }],
    });

    if (!po) return res.status(404).json({ success: false, message: "Not found" });

    return res.status(200).json({
      success: true,
      message: "Purchase Order fetched",
      data: po,
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

//update po
v1Router.put("/purchase-order/:id", authenticateJWT, async (req, res) => {
  console.log("Update PO Request Body:", req.params.id, req.body);
  
    const transaction = await sequelize.transaction();
    try {
      const { items, ...poData } = req.body;
      const poId = req.params.id;
  
      const po = await PurchaseOrder.findOne({
        where: { id: poId },
        transaction
      });
  
      if (!po) {
        return res.status(404).json({
          success: false,
          message: "Purchase Order not found"
        });
      }
  
      // Update purchase order
      poData.updated_by = req.user.id;
      await po.update(poData, { transaction });
  
      console.log("po Id ", poId)
      // Delete old purchase order items
     const deletePOId= await PurchaseOrderItem.destroy({
        where: { po_id: poId },
        transaction
      });
      console.log(" Delete po Id ", deletePOId)
  
      // Recreate new purchase order items
      for (const item of items) {
        await PurchaseOrderItem.create({
          ...item,
          po_id: poId,
          company_id: req.user.company_id,
          created_by: req.user.id,
          updated_by: req.user.id
        }, { transaction });
      }
  
      await transaction.commit();
  
      return res.status(200).json({
        success: true,
        message: "Purchase Order and Items updated successfully",
        data: po
      });
  
    } catch (error) {
      await transaction.rollback();
      console.error("Update Error:", error.message);
      return res.status(500).json({
        success: false,
        message: `Update failed: ${error.message}`
      });
    }
  });
  

// delete po
v1Router.delete("/purchase-order/:id", authenticateJWT, async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ where: { id: req.params.id } });
    if (!po) return res.status(404).json({ success: false, message: "Not found" });

    await po.update({ status: "inactive", updated_by: req.user.id });

    return res.status(200).json({
      success: true,
      message: "Purchase Order deleted (soft delete)",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});



//////////////////////////////////////////////// PO Return ///////////////////////////////////////////////////////
// get po return details
v1Router.get("/purchase-order/details/po", authenticateJWT, async (req, res) => {
  try {
    const { po_id, grn_id } = req.query;
    console.log("PO ID:", po_id, "GRN ID:", grn_id);
    

    if (!po_id || !grn_id) {
      return res.status(400).json({ error: 'po_id and grn_id are required.' });
    }

    // Fetch Purchase Order
    const purchaseOrder = await PurchaseOrder.findOne({
      where: { id: po_id },
      attributes: [
        "id",
        "po_code",
        "supplier_id",
        "supplier_name",
        "billing_address",
        "shipping_address",
        "supplier_contact",
        "supplier_email",
        "payment_terms",
        "freight_terms",
        "total_qty",
        "cgst_amount",
        "sgst_amount",
        "amount",
        "tax_amount",
        "total_amount",
        "status",
        "decision"
      ],
    });

    if (!purchaseOrder) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    // Fetch GRN
    const grnDetails = await GRN.findOne({
      where: { id: grn_id },
      attributes: ["id"],
    });

    if (!grnDetails) {
      return res.status(404).json({ error: 'GRN details not found.' });
    }

    // Fetch PO Items
    const purchaseOrderItemDetails = await PurchaseOrderItem.findAll({
      where: { po_id: po_id },
      attributes: [
        "id",
        "po_id",
        "item_id",
        "item_code",
        "description",
        "hsn_code",
        "quantity",
        "uom",
        "unit_price",
        "cgst",
        "cgst_amount",
        "sgst",
        "sgst_amount",
        "amount",
        "tax_amount",
        "total_amount",
        "status"
      ],
    });

    if (!purchaseOrderItemDetails || purchaseOrderItemDetails.length === 0) {
      return res.status(404).json({ error: 'Purchase Order item not found.' });
    }

    // Fetch GRN Items
    const grnItemDetails = await GRNItem.findAll({
      where: { grn_id: grn_id },
      attributes: ["id", "item_id"],
    });

    // Fetch Inventory
    const inventoryDetails = await Inventory.findAll({
      where: {
        id: po_id,
        grn_id: grn_id,
      },
      attributes: ["id", "item_id"],
    });

    // Fetch Item table (for item_name)
    const itemIds = purchaseOrderItemDetails.map(item => item.item_id);

    const items = await Item.findAll({
      where: { id: itemIds },
      attributes: ["id", "item_name"],
    });

    // ===========================
    // Final Response Building
    // ===========================

    const formattedPurchaseOrder = {
      ...purchaseOrder.toJSON(),
      id: grnDetails.grn_id
    };

    const formattedPurchaseOrderItemDetails = purchaseOrderItemDetails.map(poItem => {
      const poItemJson = poItem.toJSON();

      const grnItem = grnItemDetails.find(g => g.item_id === poItemJson.item_id);
      const inventoryItem = inventoryDetails.find(i => i.item_id === poItemJson.item_id);
      const itemInfo = items.find(it => it.item_id === poItemJson.item_id);

      return {
        ...poItemJson,
        item_name: itemInfo ? itemInfo.item_name : null,    // Correct Item Name
        grn_item_id: grnItem ? grnItem.id : null,   // GRN Item ID
        inventory_id: inventoryItem ? inventoryItem.id : null,  // Inventory ID
      };
    });

    const response = {
      purchaseOrder: formattedPurchaseOrder,
      purchaseOrderItemDetails: formattedPurchaseOrderItemDetails,
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching details:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});





// create po return without calculation
v1Router.post("/purchase-order/return/po", authenticateJWT, async (req, res) => {
  const {
    po_id,
    grn_id,
    total_qty,
    cgst_amount,
    sgst_amount,
    amount,
    tax_amount,
    total_amount,
    items,
    reason,
    payment_terms,
    notes
  } = req.body;

  try {
    // 1. Validate Purchase Order
    const purchaseOrder = await PurchaseOrder.findOne({ where: { id: po_id } });
    if (!purchaseOrder) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    // 2. Validate GRN
    const grn = await GRN.findOne({ where: { id: grn_id } });
    if (!grn) {
      return res.status(404).json({ error: 'GRN not found.' });
    }

    // 3. Create PO Return
    const poReturn = await PurchaseOrderReturn.create({
      po_id,
      grn_id,
      company_id: req.user.company_id,
      total_qty,
      cgst_amount,
      sgst_amount,
      amount,
      tax_amount,
      total_amount,
      return_date: new Date(),
      reason,
      payment_terms,
      notes,
      status: 'initiated',
      decision: 'approve',
      created_by: req.user.id
    });

    // 4. Process Items
    const returnItems = [];

    for (const item of items) {
      const {
        grn_item_id,
        item_id,
        return_qty,
        unit_price,
        cgst,
        cgst_amount,
        sgst,
        sgst_amount,
        amount,
        tax_amount,
        total_amount,
        reason,
        notes
      } = item;

      // Validate GRN Item
      const grnItem = await GRNItem.findOne({
        where: { id: grn_item_id, grn_id, item_id }
      });
      if (!grnItem) {
        return res.status(404).json({
          error: `GRN Item not found for item_id ${item_id}`
        });
      }

      // Validate Inventory
      const inventory = await Inventory.findOne({ where: { item_id } });
      if (!inventory) {
        return res.status(404).json({
          error: `Inventory not found for item_id ${item_id}`
        });
      }

      // Reduce inventory quantity
      inventory.quantity_available -= return_qty;
      if (inventory.quantity_available < 0) {
        return res.status(400).json({
          error: `Not enough stock to return for item_id ${item_id}`
        });
      }
      await inventory.save();

      // Create PO Return Item
      const poReturnItem = await PurchaseOrderReturnItem.create({
        po_return_id: poReturn.id,
        grn_item_id,
        item_id,
        company_id: req.user.company_id,
        return_qty,
        unit_price,
        cgst,
        cgst_amount,
        sgst,
        sgst_amount,
        amount,
        tax_amount,
        total_amount,
        reason,
        notes,
        created_by: req.user.id
      });

      returnItems.push(poReturnItem);
    }

    res.status(201).json({
      message: "Purchase Order Return created successfully.",
      poReturn,
      returnItems
    });

  } catch (error) {
    console.error("Error creating PO return:", error);
    res.status(500).json({ error: "An error occurred while processing the return." });
  }
});







// create po return with calculation


v1Router.post("/purchase-order/return/gst/po", authenticateJWT, async (req, res) => {
  const { po_id, grn_id, items, reason, payment_terms, notes } = req.body;
  console.log(" req.body : ", req.body);

  try {
    // 1. Validate Purchase Order
    const purchaseOrder = await PurchaseOrder.findOne({ where: { id: po_id } });
    if (!purchaseOrder) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    // 2. Validate GRN
    const grn = await GRN.findOne({ where: { id: grn_id } });
    if (!grn) {
      return res.status(404).json({ error: 'GRN not found.' });
    }

    // 3. Initialize totals
    let total_qty = 0;
    let cgst_amount_total = 0;
    let sgst_amount_total = 0;
    let amount_total = 0;
    let tax_amount_total = 0;
    let total_amount_total = 0;

    const returnItems = [];

    // 4. Process each item
    for (let item of items) {
      const { grn_item_id, item_id, return_qty, unit_price, reason, notes } = item;

      const itemData = await Item.findOne({
        where: { id: item_id }
      });

      if (!itemData) {
        return res.status(404).json({ error: `Item not found: ${item_id}` });
      }

      let cgst = itemData.cgst;
      let sgst = itemData.sgst;

      if (unit_price == null || cgst == null || sgst == null) {
        return res.status(400).json({ error: `Missing unit price or tax values for item ${item_id}` });
      }

      // Validate GRN Item
      const grnItem = await GRNItem.findOne({
        where: { id: grn_item_id, grn_id, item_id }
      });
      if (!grnItem) {
        return res.status(404).json({ error: `GRN item not found for item ID ${item_id}` });
      }

      // Validate Inventory
      const inventories = await Inventory.findAll({
        where: { item_id, grn_id },
        order: [['id', 'ASC']], // FIFO
      });

      if (!inventories || inventories.length === 0) {
        return res.status(404).json({ error: `Inventory not found for item ${item_id}` });
      }

      // Calculate item-level amounts
      const amount = return_qty * unit_price;
      const cgst_amount = (amount * cgst) / 100;
      const sgst_amount = (amount * sgst) / 100;
      const tax_amount = cgst_amount + sgst_amount;
      const total_amount = amount + tax_amount;
      
 // Calculate total available quantity
let totalAvailable = inventories.reduce(
  (sum, inv) => sum + parseFloat(inv.quantity_available || 0),
  0
);

if (totalAvailable < return_qty) {
  return res.status(400).json({ error: `Not enough stock for item ${item_id}` });
}

// ✅ Declare this before the loop
let remainingToDeduct = return_qty;

const deductionLog = [];

for (const inventory of inventories) {
  let available = parseFloat(inventory.quantity_available);

  if (available >= remainingToDeduct) {
    inventory.quantity_available = available - remainingToDeduct;
    await inventory.save();
    deductionLog.push({ id: inventory.id, deducted: remainingToDeduct });
    break;
  } else {
    inventory.quantity_available = 0;
    await inventory.save();
    deductionLog.push({ id: inventory.id, deducted: available });
    remainingToDeduct -= available;
  }
}

console.log(`Inventory deduction log for item ${item_id}:`, deductionLog);


      // await inventory.save();

      // Sum totals
      total_qty += return_qty;
      cgst_amount_total += cgst_amount;
      sgst_amount_total += sgst_amount;
      amount_total += amount;
      tax_amount_total += tax_amount;
      total_amount_total += total_amount;

      returnItems.push({
        grn_item_id,
        item_id,
        return_qty,
        unit_price,
        cgst,
        cgst_amount,
        sgst,
        sgst_amount,
        amount,
        tax_amount,
        total_amount,
        reason,
        notes,
        created_by: req.user.id,
        company_id: req.user.company_id,
        po_id,
        grn_id,
      });
    }

    // 5. Generate purchase return ID
    const purchase_return_generate_id = await generateId(req.user.company_id, PurchaseOrderReturn, "poReturn");

    // 6. Create PO Return
    const poReturn = await PurchaseOrderReturn.create({
      grn_id,
      po_id,
      company_id: req.user.company_id,
      total_qty,
      cgst_amount: cgst_amount_total,
      sgst_amount: sgst_amount_total,
      amount: amount_total,
      tax_amount: tax_amount_total,
      total_amount: total_amount_total,
      return_date: new Date(),
      reason,
      payment_terms,
      notes,
      status: 'initiated',
      decision: 'approve',
      created_by: req.user.id,
      purchase_return_generate_id: purchase_return_generate_id
    });

    // 7. Save return items
    for (const item of returnItems) {
      item.po_return_id = poReturn.id;
      await PurchaseOrderReturnItem.create(item); 
      
      ///
      await Inventory.update(
        { po_return_id: poReturn.id },
        {
          where: {
            item_id: item.item_id,
            po_id: poReturn.po_id,
            company_id: req.user.company_id
          }
        }
      );
      ///
      
    }

    // 8. Check if all received items are fully returned
    // 1. Get all PO Items for this PO
    const allPoItems = await PurchaseOrderItem.findAll({ where: { po_id }, attributes: ['id', 'quantity', 'item_id'] });

    // 2. Get all GRNs for this PO
    const allGrns = await GRN.findAll({ where: { po_id }, attributes: ['id'] });
    const allGrnIds = allGrns.map(grn => grn.id);

    // 3. Get all GRN Items for these GRNs
    const allGrnItems = await GRNItem.findAll({
      where: { grn_id: allGrnIds },
      attributes: ['po_item_id', 'item_id', 'quantity_received']
    });

    // 4. Get all PO Return Items for this PO (using po_return_id)
    const allPoReturns = await PurchaseOrderReturn.findAll({
      where: { po_id },
      attributes: ['id']
    });
    const allPoReturnIds = allPoReturns.map(r => r.id);

    const allReturnItems = await PurchaseOrderReturnItem.findAll({
      where: { po_return_id: allPoReturnIds },
      attributes: ['item_id', 'return_qty']
    });

    // 5. Check if all received items are fully returned
    let allReturned = true;
    for (const poItem of allPoItems) {
      // Total received for this item
      const totalReceived = allGrnItems
        .filter(grnItem => grnItem.item_id === poItem.item_id)
        .reduce((sum, grnItem) => sum + parseFloat(grnItem.quantity_received || 0), 0);

      // Total returned for this item
      const totalReturned = allReturnItems
        .filter(retItem => retItem.item_id === poItem.item_id)
        .reduce((sum, retItem) => sum + parseFloat(retItem.return_qty || 0), 0);

        // Debug log for troubleshooting
      console.log(`Item ${poItem.item_id}: totalReceived=${totalReceived}, totalReturned=${totalReturned}`);

      // Use a small epsilon for float comparison
      if (Math.abs(totalReturned - totalReceived) > 0.0001 && totalReturned < totalReceived) {
        allReturned = false;
        break;
      }
    }

    // 6. Update PO status accordingly
    await PurchaseOrder.update(
      { po_status: allReturned ? "returned" : "amended" },
      { where: { id: po_id } }
    );

    return res.status(201).json({
      message: 'Purchase Order Return created successfully.',
      poReturn,
      returnItems,
    });
  } catch (error) {
    console.error('Error creating PO return:', error);
    return res.status(500).json({ error: 'An error occurred while processing the return.' });
  }
});















//Download Purchase Order as PDF karthi
// v1Router.get("/purchase-order/:id/download", async (req, res) => {
//   try {
//     const poId = req.params.id;

//     const purchaseOrder = await PurchaseOrder.findOne({
//       where: { id: poId, status: "active" },
//       include: [
//         {
//           model: PurchaseOrderItem,
//           include: [
//             {
//               model: ItemMaster,
//               as: "item_info",
//               attributes: ["id", "item_generate_id", "item_name"]
//             }
//           ]
//         },
//         { model: Company }
//       ],
//     });

//     if (!purchaseOrder) {
//       return res.status(404).json({ success: false, message: "Purchase Order not found" });
//     }

//     const doc = new PDFDocument({ margin: 40, size: 'A4' });
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', `attachment; filename=purchase-order-${purchaseOrder.purchase_generate_id}.pdf`);
//     doc.pipe(res);

//     // Header
//     doc.fontSize(18).font('Helvetica-Bold').text('PURCHASE ORDER', { align: 'center' });
//     doc.moveDown(0.5);

//     // Company & PO Info
//     const leftX = 40, rightX = 320, colWidth = 250;
//     let y = doc.y;

//     // Left: PO Info
//     doc.fontSize(10).font('Helvetica').text(`PO Number: ${purchaseOrder.purchase_generate_id}`, leftX, y);
//     doc.text(`Date: ${new Date(purchaseOrder.po_date).toLocaleDateString()}`, leftX);
//     if (purchaseOrder.valid_till) {
//       doc.text(`Valid Till: ${new Date(purchaseOrder.valid_till).toLocaleDateString()}`, leftX);
//     }

//     // Right: Company Info
//     const company = purchaseOrder.Company;
//     let companyY = y;
//     if (company) {
//       doc.fontSize(10).font('Helvetica-Bold').text(company.company_name, rightX, companyY);
//       companyY = doc.y;
//       doc.font('Helvetica');
//       if (company.address) { doc.text(company.address, rightX, companyY, { width: colWidth }); companyY = doc.y; }
//       if (company.company_phone) { doc.text(`Phone: ${company.company_phone}`, rightX, companyY); companyY = doc.y; }
//       if (company.company_email) { doc.text(`Email: ${company.company_email}`, rightX, companyY); companyY = doc.y; }
//       if (company.website) { doc.text(`Website: ${company.website}`, rightX, companyY); }
//     }

//     doc.moveDown(1);

//     // Supplier & Shipping Info Box
//     const boxTop = doc.y, boxHeight = 90;
//     doc.save();
//     doc.roundedRect(leftX, boxTop, 515, boxHeight, 6).fillAndStroke('#f8f8f8', '#cccccc');
//     doc.restore();

//     // Supplier Info
//     let infoY = boxTop + 8;
//     doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('Supplier Information', leftX + 10, infoY);
//     infoY += 15;
//     doc.font('Helvetica').fontSize(9).fillColor('#333');
//     doc.text(`Name: ${purchaseOrder.supplier_name}`, leftX + 10, infoY);
//     infoY += 12;
//     if (purchaseOrder.supplier_contact) { doc.text(`Contact: ${purchaseOrder.supplier_contact}`, leftX + 10, infoY); infoY += 12; }
//     if (purchaseOrder.supplier_email) { doc.text(`Email: ${purchaseOrder.supplier_email}`, leftX + 10, infoY); infoY += 12; }

//     // Billing Address
//     let billY = boxTop + 8;
//     doc.font('Helvetica-Bold').text('Billing Address:', leftX + 200, billY);
//     billY += 15;
//     doc.font('Helvetica').fontSize(9).fillColor('#333');
//     doc.text(purchaseOrder.billing_address.replace(/,\s*/g, ',\n'), leftX + 200, billY, { width: 120 });

//     // Shipping Address
//     let shipY = boxTop + 8;
//     doc.font('Helvetica-Bold').text('Shipping Address:', leftX + 350, shipY);
//     shipY += 15;
//     doc.font('Helvetica').fontSize(9).fillColor('#333');
//     doc.text(purchaseOrder.shipping_address.replace(/,\s*/g, ',\n'), leftX + 350, shipY, { width: 140 });

//     doc.y = boxTop + boxHeight + 15;

//     // Items Table Header
//     const tableTop = doc.y;
//     doc.fontSize(10).font('Helvetica-Bold').fillColor('#000');
//     doc.rect(leftX, tableTop, 515, 20).fillAndStroke('#f0f0f0', '#cccccc');
//     doc.fillColor('#000').text('No.', leftX + 5, tableTop + 5, { width: 25 });
//     doc.text('Item', leftX + 35, tableTop + 5, { width: 120 });
//     doc.text('Qty', leftX + 160, tableTop + 5, { width: 40 });
//     doc.text('Price', leftX + 205, tableTop + 5, { width: 55 });
//     doc.text('Tax', leftX + 265, tableTop + 5, { width: 40 });
//     doc.text('Amount', leftX + 310, tableTop + 5, { width: 60 });
//     doc.text('UOM', leftX + 375, tableTop + 5, { width: 40 });
//     doc.text('Item Code', leftX + 420, tableTop + 5, { width: 90 });

//     // Table Rows
//     let rowY = tableTop + 20;
//     doc.font('Helvetica').fontSize(9);
//     const items = purchaseOrder.PurchaseOrderItems;
//     items.forEach((item, i) => {
//       if (i % 2 === 1) {
//         doc.save();
//         doc.rect(leftX, rowY, 515, 18).fill('#fafafa');
//         doc.restore();
//       }
//       const name = item.item_info?.item_name || item.item_code;
//       doc.fillColor('#000')
//         .text(i + 1, leftX + 5, rowY + 4, { width: 25 })
//         .text(name, leftX + 35, rowY + 4, { width: 120 })
//         .text(item.quantity, leftX + 160, rowY + 4, { width: 40 })
//         .text(parseFloat(item.unit_price).toFixed(2), leftX + 205, rowY + 4, { width: 55 })
//         .text(`${(parseFloat(item.cgst || 0) + parseFloat(item.sgst || 0)).toFixed(2)}%`, leftX + 265, rowY + 4, { width: 40 })
//         .text(parseFloat(item.total_amount).toFixed(2), leftX + 310, rowY + 4, { width: 60 })
//         .text(item.uom || '', leftX + 375, rowY + 4, { width: 40 })
//         .text(item.item_code || '', leftX + 420, rowY + 4, { width: 90 });
//       rowY += 18;
//     });

//     // Table Border
//     doc.rect(leftX, tableTop, 515, rowY - tableTop).stroke();

//     // Summary Box
//     const summaryTop = rowY + 10;
//     doc.rect(leftX, summaryTop, 515, 60).stroke();
//     doc.font('Helvetica-Bold').fontSize(10).text('Summary:', leftX + 10, summaryTop + 8);
//     doc.font('Helvetica').fontSize(9)
//       .text(`Sub Total: ${parseFloat(purchaseOrder.amount || 0).toFixed(2)}`, leftX + 120, summaryTop + 8)
//       .text(`CGST: ${parseFloat(purchaseOrder.cgst_amount || 0).toFixed(2)}`, leftX + 120, summaryTop + 23)
//       .text(`SGST: ${parseFloat(purchaseOrder.sgst_amount || 0).toFixed(2)}`, leftX + 120, summaryTop + 38)
//       .font('Helvetica-Bold').text(`Total: ${parseFloat(purchaseOrder.total_amount || 0).toFixed(2)}`, leftX + 320, summaryTop + 23);

//     // Terms & Conditions
//     const termsTop = summaryTop + 70;
//     doc.rect(leftX, termsTop, 515, 40).stroke();
//     doc.font('Helvetica-Bold').fontSize(10).text('Terms and Conditions:', leftX + 10, termsTop + 8);
//     doc.font('Helvetica').fontSize(9)
//       .text(`Payment Terms: ${purchaseOrder.payment_terms || ''}`, leftX + 180, termsTop + 8)
//       .text(`Freight Terms: ${purchaseOrder.freight_terms || ''}`, leftX + 180, termsTop + 23);

//     // Signatures
//     const signTop = termsTop + 55;
//     doc.font('Helvetica').fontSize(9)
//       .text('Authorized Signature', leftX + 60, signTop, { width: 120, align: 'center' })
//       .text('Received By', leftX + 320, signTop, { width: 120, align: 'center' });
//     doc.moveTo(leftX + 60, signTop + 15).lineTo(leftX + 180, signTop + 15).stroke();
//     doc.moveTo(leftX + 320, signTop + 15).lineTo(leftX + 440, signTop + 15).stroke();

//     doc.end();

//   } catch (error) {
//     console.error("Error generating PDF:", error);
//     return res.status(500).json({
//       success: false,
//       message: `Failed to generate PDF: ${error.message}`
//     });
//   }
// });





// Selva
v1Router.get("/purchase-order/:id/download", async (req, res) => {
  let browser;
  try {
    const poId = req.params.id;
    console.log('Processing PO ID:', poId);

    // Fetch purchase order data
    const purchaseOrder = await PurchaseOrder.findOne({
      where: { id: poId, status: "active" },
      include: [
        {
          model: PurchaseOrderItem,
          include: [
            {
              model: ItemMaster,
              as: "item_info",
              attributes: ["id", "item_generate_id", "item_name"]
            }
          ]
        },
        { model: Company }
      ],
    });

    if (!purchaseOrder) {
      console.log('Purchase order not found');
      return res.status(404).json({ success: false, message: "Purchase Order not found" });
    }

  //   let poTemplateId = req.query.template_id 
  // ? parseInt(req.query.template_id, 10) 
  // : (purchaseOrder.po_template_id || 1);

    // Try to fetch HTML template, fallback to default if not found
    let htmlTemplate = await HtmlTemplate.findOne({
      where: { 
        company_id: purchaseOrder.company_id,
        // po_template_id: poTemplateId,
        status: "active" 
      }
    });

    // If no template found for company, try to get a default template
    if (!htmlTemplate) {
      htmlTemplate = await HtmlTemplate.findOne({
        where: { status: "active" },
        order: [['id', 'ASC']]
      });
    }

    // If still no template, use your original PDF generation code
    if (!htmlTemplate) {
      console.log('No HTML template found, falling back to original PDF generation');
      return generateOriginalPDF(req, res, purchaseOrder);
    }

    // Prepare data for template
    const templateData = {
      purchaseOrder: {
        id: purchaseOrder.id,
        purchase_generate_id: purchaseOrder.purchase_generate_id,
        po_date: purchaseOrder.po_date,
        po_date_formatted: new Date(purchaseOrder.po_date).toLocaleDateString('en-IN'),
        valid_till: purchaseOrder.valid_till,
        valid_till_formatted: purchaseOrder.valid_till ? new Date(purchaseOrder.valid_till).toLocaleDateString('en-IN') : '',
        supplier_name: purchaseOrder.supplier_name || '',
        supplier_contact: purchaseOrder.supplier_contact || '',
        supplier_email: purchaseOrder.supplier_email || '',
        billing_address: purchaseOrder.billing_address || '',
        shipping_address: purchaseOrder.shipping_address || '',
        billing_address_formatted: purchaseOrder.billing_address ? purchaseOrder.billing_address.replace(/,\s*/g, ',<br>') : '',
        shipping_address_formatted: purchaseOrder.shipping_address ? purchaseOrder.shipping_address.replace(/,\s*/g, ',<br>') : '',
        payment_terms: purchaseOrder.payment_terms || '',
        freight_terms: purchaseOrder.freight_terms || '',
        status: purchaseOrder.status,
        amount: purchaseOrder.amount || 0,
        cgst_amount: purchaseOrder.cgst_amount || 0,
        sgst_amount: purchaseOrder.sgst_amount || 0,
        total_amount: purchaseOrder.total_amount || 0
      },
      company: purchaseOrder.Company ? {
        id: purchaseOrder.Company.id,
        company_name: purchaseOrder.Company.company_name || '',
        address: purchaseOrder.Company.address || '',
        company_phone: purchaseOrder.Company.company_phone || '',
        company_email: purchaseOrder.Company.company_email || '',
        website: purchaseOrder.Company.website || ''
      } : null,
      items: purchaseOrder.PurchaseOrderItems ? purchaseOrder.PurchaseOrderItems.map((item, index) => ({
        id: item.id,
        serial_number: index + 1,
        item_code: item.item_code || '',
        item_name: item.item_info?.item_name || item.item_code || '',
        quantity: item.quantity || 0,
        unit_price: item.unit_price || 0,
        unit_price_formatted: parseFloat(item.unit_price || 0).toFixed(2),
        total_amount: item.total_amount || 0,
        total_amount_formatted: parseFloat(item.total_amount || 0).toFixed(2),
        cgst: item.cgst || 0,
        sgst: item.sgst || 0,
        tax_percentage: (parseFloat(item.cgst || 0) + parseFloat(item.sgst || 0)).toFixed(2),
        uom: item.uom || ''
      })) : [],
      totals: {
        sub_total: parseFloat(purchaseOrder.amount || 0).toFixed(2),
        cgst_amount: parseFloat(purchaseOrder.cgst_amount || 0).toFixed(2),
        sgst_amount: parseFloat(purchaseOrder.sgst_amount || 0).toFixed(2),
        total_amount: parseFloat(purchaseOrder.total_amount || 0).toFixed(2)
      },
      current_date: new Date().toLocaleDateString('en-IN')
    };

    // Compile Handlebars template
    const template = handlebars.compile(htmlTemplate.html_template);
    const html = template(templateData);

    // Generate PDF using Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });

    await browser.close();

    // Send PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=purchase-order-${purchaseOrder.purchase_generate_id}.pdf`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);

  } catch (error) {
    console.error("Error generating PDF:", error);
    if (browser) {
      try { await browser.close(); } catch (closeError) { /* ignore */ }
    }
    return res.status(500).json({
      success: false,
      message: `Failed to generate PDF: ${error.message}`,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Fallback function using your original PDF generation
async function generateOriginalPDF(req, res, purchaseOrder) {
  try {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=purchase-order-${purchaseOrder.purchase_generate_id}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('PURCHASE ORDER', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`PO Number: ${purchaseOrder.purchase_generate_id}`, 40);
    doc.text(`Date: ${new Date(purchaseOrder.po_date).toLocaleDateString()}`, 40);
    if (purchaseOrder.Company) {
      doc.text(`Company: ${purchaseOrder.Company.company_name}`, 40);
    }
    doc.moveDown(1);
    doc.text(`Supplier: ${purchaseOrder.supplier_name}`, 40);
    doc.text(`Total Amount: ${parseFloat(purchaseOrder.total_amount || 0).toFixed(2)}`, 40);

    doc.end();
  } catch (error) {
    console.error("Error in fallback PDF generation:", error);
    return res.status(500).json({
      success: false,
      message: `Failed to generate fallback PDF: ${error.message}`
    });
  }
}









// Preview route (returns HTML)
v1Router.get("/purchase-order/:id/view", async (req, res) => {
  try {
    const poId = req.params.id;

    const purchaseOrder = await PurchaseOrder.findOne({
      where: { id: poId, status: "active" },
      include: [
        {
          model: PurchaseOrderItem,
          include: [
            {
              model: ItemMaster,
              as: "item_info",
              attributes: ["id", "item_generate_id", "item_name"]
            }
          ]
        },
        { model: Company }
      ],
    });

    if (!purchaseOrder) {
      return res.status(404).send('<h1>Purchase Order not found</h1>');
    }

// let poTemplateId = req.query.template_id 
//   ? parseInt(req.query.template_id, 10) 
//   : (purchaseOrder.po_template_id || 1);

    let htmlTemplate = await HtmlTemplate.findOne({
      where: { 
        company_id: purchaseOrder.company_id,
        // po_template_id : poTemplateId,
        status: "active" 
      }
    });

    if (!htmlTemplate) {
      htmlTemplate = await HtmlTemplate.findOne({
        where: { status: "active" },
        order: [['id', 'ASC']]
      });
    }

    if (!htmlTemplate) {
      return res.status(404).send('<h1>No HTML template found</h1>');
    }

    // Same template data preparation as above
    const templateData = {
      purchaseOrder: {
        id: purchaseOrder.id,
        purchase_generate_id: purchaseOrder.purchase_generate_id,
        po_date_formatted: new Date(purchaseOrder.po_date).toLocaleDateString('en-IN'),
        valid_till_formatted: purchaseOrder.valid_till ? new Date(purchaseOrder.valid_till).toLocaleDateString('en-IN') : '',
        supplier_name: purchaseOrder.supplier_name || '',
        supplier_contact: purchaseOrder.supplier_contact || '',
        supplier_email: purchaseOrder.supplier_email || '',
        billing_address_formatted: purchaseOrder.billing_address ? purchaseOrder.billing_address.replace(/,\s*/g, ',<br>') : '',
        shipping_address_formatted: purchaseOrder.shipping_address ? purchaseOrder.shipping_address.replace(/,\s*/g, ',<br>') : '',
        payment_terms: purchaseOrder.payment_terms || '',
        freight_terms: purchaseOrder.freight_terms || '',
        status: purchaseOrder.status
      },
      company: purchaseOrder.Company,
      items: purchaseOrder.PurchaseOrderItems ? purchaseOrder.PurchaseOrderItems.map((item, index) => ({
        serial_number: index + 1,
        item_name: item.item_info?.item_name || item.item_code || '',
        quantity: item.quantity || 0,
        unit_price_formatted: parseFloat(item.unit_price || 0).toFixed(2),
        total_amount_formatted: parseFloat(item.total_amount || 0).toFixed(2),
        tax_percentage: (parseFloat(item.cgst || 0) + parseFloat(item.sgst || 0)).toFixed(2),
        uom: item.uom || '',
        item_code: item.item_code || ''
      })) : [],
      totals: {
        sub_total: parseFloat(purchaseOrder.amount || 0).toFixed(2),
        cgst_amount: parseFloat(purchaseOrder.cgst_amount || 0).toFixed(2),
        sgst_amount: parseFloat(purchaseOrder.sgst_amount || 0).toFixed(2),
        total_amount: parseFloat(purchaseOrder.total_amount || 0).toFixed(2)
      },
      current_date: new Date().toLocaleDateString('en-IN')
    };

    const template = handlebars.compile(htmlTemplate.html_template);
    const html = template(templateData);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error("Error generating HTML preview:", error);
    return res.status(500).send(`<h1>Error: ${error.message}</h1>`);
  }
});




v1Router.get("/purchase-order/templates/rendered", async (req, res) => {
  try {
    const templates = await HtmlTemplate.findAll({ order: [['id', 'ASC']] });

    if (!templates || templates.length === 0) {
      return res.status(404).send("<h1>No HTML templates found</h1>");
    }

    // Dummy data to render inside template
    const sampleData = {
      purchaseOrder: {
        purchase_generate_id: "PO-2024-001",
        po_date_formatted: "12/06/2025",
        valid_till_formatted: "20/06/2025",
        supplier_name: "Sample Supplier",
        supplier_contact: "9876543210",
        supplier_email: "supplier@example.com",
        billing_address_formatted: "123, Main Street,<br>City",
        shipping_address_formatted: "456, Other Street,<br>City",
        payment_terms: "Net 30",
        freight_terms: "FOB",
        status: "active"
      },
      company: {
        company_name: "Sample Company",
        company_phone: "1234567890",
        company_email: "info@company.com",
        website: "www.company.com"
      },
      items: [
        {
          serial_number: 1,
          item_name: "Item A",
          quantity: 10,
          unit_price_formatted: "100.00",
          total_amount_formatted: "1000.00",
          tax_percentage: "18.00",
          uom: "PCS",
          item_code: "A001"
        }
      ],
      totals: {
        sub_total: "1000.00",
        cgst_amount: "90.00",
        sgst_amount: "90.00",
        total_amount: "1180.00"
      },
      current_date: new Date().toLocaleDateString('en-IN')
    };

    // Render all templates
    const renderedBlocks = templates.map((template, index) => {
      let renderedHTML = '';
      try {
        const compiled = handlebars.compile(template.html_template);
        renderedHTML = compiled(sampleData);
      } catch (err) {
        renderedHTML = `<div style="color:red;">Error rendering template ID ${template.id}: ${err.message}</div>`;
      }

      return `
        <div class="template-block">
          <div class="template-info"><strong>Template ID:</strong> ${template.id}</div>
          ${renderedHTML}
        </div>
        ${index !== templates.length - 1 ? '<hr/>' : ''}
      `;
    }).join('');

    // Final full HTML
    const html = `
      <html>
        <head>
          <title>Rendered Purchase Order Templates</title>
          <style>
            body { font-family: Arial, sans-serif; background: #f5f7fa; padding: 20px; }
            .template-block { margin: 40px auto; max-width: 900px; background: #fff; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 24px; }
            .template-info { margin-bottom: 10px; color: #1976d2; font-weight: bold; }
            hr { border: none; border-top: 2px solid #1976d2; margin: 40px 0; }
          </style>
        </head>
        <body>
          <h2 style="text-align:center;">All Rendered Purchase Order Templates</h2>
          ${renderedBlocks}
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error("Error rendering purchase order templates:", error);
    res.status(500).send(`<h1>Error: ${error.message}</h1>`);
  }
});







// ACtivate template
v1Router.get("/purchase-order/activate/:id", async (req, res) => {
  const templateId = req.params.id;

  try {
    // 1. Set the selected template to active
    await HtmlTemplate.update(
      { status: "active" },
      { where: { id: templateId } }
    );

    // 2. Set all other templates to inactive
    await HtmlTemplate.update(
      { status: "inactive" },
      { where: { id: { [Op.ne]: templateId } } }
    );

    return res.status(200).json({
      success: true,
      message: `Template ID ${templateId} activated successfully.`,
    });
  } catch (error) {
    console.error("Error activating template:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while activating the template.",
    });
  }
});









//purchase returned based id
v1Router.get("/purchase-order/get/id", async (req, res) => {
  try {
    const purchaseOrders = await PurchaseOrder.findAll({
      attributes: ["id", "purchase_generate_id"],
       where: {
          status: "active",
          po_status: {
            [Op.notIn]: ['created', 'returned', 'amended']
          }
        },
      order: [["id", "DESC"]]
    });

    res.status(200).json({
      success: true,
      data: purchaseOrders
    });
  } catch (error) {
    console.error("Error fetching purchase order IDs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchase order IDs"
    });
  }
});



//po_id based grn_id
v1Router.get("/purchase-order/grn/:id", async (req, res) => {
  try {

      const poId = req.params.id;

    const grnData = await GRN.findAll({
      attributes: ["id", "grn_generate_id"],
       where: {
          po_id:poId,
          status: "active",
        },
      order: [["id", "DESC"]]
    });

    res.status(200).json({
      success: true,
      data: grnData
    });
  } catch (error) {
    console.error("Error fetching purchase order IDs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchase order IDs"
    });
  }
});








//connection port
app.use("/api", v1Router);
// await db.sequelize.sync();
const PORT = process.env.PORT_PURCHASE;
app.listen(process.env.PORT_PURCHASE,'0.0.0.0', () => {
  console.log(`Purchase running on port ${process.env.PORT_PURCHASE}`);
});
