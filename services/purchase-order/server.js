import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";

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
      include: [{ model: PurchaseOrderItem }],
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
      const inventory = await Inventory.findOne({ where: { item_id } });
      if (!inventory) {
        return res.status(404).json({ error: `Inventory not found for item ${item_id}` });
      }

      // Calculate item-level amounts
      const amount = return_qty * unit_price;
      const cgst_amount = (amount * cgst) / 100;
      const sgst_amount = (amount * sgst) / 100;
      const tax_amount = cgst_amount + sgst_amount;
      const total_amount = amount + tax_amount;

      // Update inventory stock
      inventory.quantity_available -= return_qty;
      if (inventory.quantity_available < 0) {
        return res.status(400).json({ error: `Not enough stock for item ${item_id}` });
      }
      await inventory.save();

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















//connection port
app.use("/api", v1Router);
// await db.sequelize.sync();
const PORT = process.env.PORT_PURCHASE;
app.listen(process.env.PORT_PURCHASE,'0.0.0.0', () => {
  console.log(`Purchase running on port ${process.env.PORT_PURCHASE}`);
});
