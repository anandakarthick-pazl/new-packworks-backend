import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import GRN from "../../common/models/grn/grn.model.js";
import GRNItem from "../../common/models/grn/grn_item.model.js";
import PurchaseOrderItem from "../../common/models/po/purchase_order_item.model.js";
// import WalletHistory from "../../common/models/walletHistory.model.js";
import "../../common/models/association.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
const Company = db.Company;
const User = db.User;
const PurchaseOrder = db.PurchaseOrder;
const PurchaseOrderReturn = db.PurchaseOrderReturn;
const ItemMaster = db.ItemMaster;
const grnItem = db.GRNItem;
const purchase_order_item = db.PurchaseOrderItem;
const PurchaseOrderReturnItem = db.PurchaseOrderReturnItem;
const WalletHistory = db.WalletHistory;
const Client = db.Client;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();


v1Router.post("/purchase-order-return", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      grn_id,
      po_id,
      return_date,
      reason,
      decision,
      notes,
      return_items
    } = req.body;

    const user = req.user;
    const companyId = req.user.company_id;
    // Validate GRN
    const grn = await GRN.findOne({ where: { id: grn_id } });
    if (!grn) throw new Error("GRN not found");

    // Fetch Purchase Order with its items (no alias)
    const po = await PurchaseOrder.findOne({
      where: { po_id },
      include: [PurchaseOrderItem] // ← no alias here
    });
    if (!po) throw new Error("Purchase Order not found");

    // Map PO items by ID
    const poItemsMap = {};
    po.PurchaseOrderItems.forEach(item => {
      poItemsMap[item.id] = item;
    });

    // Aggregate totals
    let total_qty = 0, cgst_amount = 0, sgst_amount = 0, amount = 0, tax_amount = 0, total_amount = 0;

    // Create Purchase Order Return
    const purchase_return_generate_id = await generateId(
      req.user.company_id,
      PurchaseOrderReturn,
      "purchase_return"

    );
    const poReturn = await PurchaseOrderReturn.create({
      grn_id,
      po_id,
      return_date,
      reason,
      status,
      decision,
      notes,
      created_by: user.id,
      updated_by: user.id,
      company_id: companyId,
      purchase_return_generate_id
    }, { transaction });

    // Process Return Items
    for (const item of return_items) {
      const poItem = poItemsMap[item.po_item_id];
      if (!poItem) throw new Error(`PO Item not found for ID: ${item.po_item_id}`);

      // Generate purchase_return_generate_id

      const qty = item.return_qty;
      const unitPrice = poItem.unit_price;
      const itemAmount = qty * unitPrice;
      const itemCgstAmount = itemAmount * (poItem.cgst / 100);
      const itemSgstAmount = itemAmount * (poItem.sgst / 100);
      const itemTaxAmount = itemCgstAmount + itemSgstAmount;
      const itemTotalAmount = itemAmount + itemTaxAmount;

      await PurchaseOrderReturnItem.create({
        po_return_id: poReturn.id,
        grn_item_id: item.grn_item_id,
        item_id: poItem.item_id,
        company_id: companyId,
        return_qty: qty,
        unit_price: unitPrice,
        cgst: poItem.cgst,
        cgst_amount: itemCgstAmount,
        sgst: poItem.sgst,
        sgst_amount: itemSgstAmount,
        amount: itemAmount,
        tax_amount: itemTaxAmount,
        total_amount: itemTotalAmount,
        reason: item.reason,
        notes: item.notes,
        created_by: user.id,
        updated_by: user.id
      }, { transaction });

      total_qty += qty;
      amount += itemAmount;
      cgst_amount += itemCgstAmount;
      sgst_amount += itemSgstAmount;
      tax_amount += itemTaxAmount;
      total_amount += itemTotalAmount;
    }

    // Update PO Return with totals
    await poReturn.update({
      total_qty,
      cgst_amount,
      sgst_amount,
      amount,
      tax_amount,
      total_amount
    }, { transaction });

    const client = await Client.findOne({
      where: { id: po.supplier_id, company_id: companyId },
      transaction
    });
    if (!client) throw new Error("supplier Id not found");

    // Update debit_balance
    client.debit_balance = parseFloat(client.debit_balance || 0) + parseFloat(total_amount);
    await client.save({ transaction });

    // Insert wallet history record
    await WalletHistory.create({
      type: 'debit',
      client_id: client.id,
      amount: total_amount,
      company_id: companyId,
      refference_number: "Purchase Order Return " + purchase_return_generate_id, // or use a better reference like poReturn.purchase_return_generate_id
      created_by: user.id,
      created_at: new Date()
    }, { transaction });


    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Purchase Order Return created successfully",
      data: poReturn
    });

  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: `Creation failed: ${error.message}`
    });
  }
});

v1Router.get("/purchase-order-return", authenticateJWT, async (req, res) => {
  try {
    const user = req.user;
    const { search = "", page = "1", limit = "10" } = req.query;

    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, parseInt(limit));
    const offset = (pageNumber - 1) * limitNumber;

    let where = {
      company_id: user.company_id,
    };

    // Optional search on supplier_name or other fields
    if (search.trim()) {
      where.supplier_name = { [Op.like]: `%${search}%` };
    }

    const { count: totalCount, rows: allReturns } = await PurchaseOrderReturn.findAndCountAll({
      where,
      include: [
        {
          model: PurchaseOrderReturnItem,
          as: "items",
        },
        {
          model: PurchaseOrder,
          as: "PurchaseOrder", // Use the correct alias if you have one in your association
          attributes: ['id', 'purchase_generate_id'] // Add any other fields you need
        }
      ],
      order: [['created_at', 'DESC']],
      limit: limitNumber,
      offset,
    });

    // Collect all unique user IDs for batch fetching
    const userIds = new Set();
    allReturns.forEach(ret => {
      if (ret.created_by) userIds.add(ret.created_by);
      if (ret.updated_by) userIds.add(ret.updated_by);
    });

    // Fetch all users in one query
    const users = await User.findAll({
      where: { id: Array.from(userIds) },
      attributes: ['id', 'name', 'email']
    });
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });

    // Attach user info to each return
    const returnsWithUsers = allReturns.map(ret => {
      const retJson = ret.toJSON();
      retJson.created_by_user = userMap[ret.created_by] || null;
      retJson.updated_by_user = userMap[ret.updated_by] || null;
      return retJson;
    });

    const approved = returnsWithUsers.filter(ret => ret.decision === 'approve');
    const disapproved = returnsWithUsers.filter(ret => ret.decision === 'disapprove');

    return res.status(200).json({
      success: true,
      message: "Purchase order returns fetched",
      approved,
      disapproved,
      totalCount,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch Purchase Order Returns: ${error.message}`
    });
  }
});



v1Router.get("/purchase-order-return/:id", authenticateJWT, async (req, res) => {

  try {
    const user = req.user;
    const returnId = req.params.id;

    const purchaseOrderReturn = await PurchaseOrderReturn.findOne({
      where: {
        id: returnId,
        company_id: user.company_id
      },
      include: [
        {
          model: PurchaseOrderReturnItem,
          as: "items"
        },
        {
          model: PurchaseOrder,
          as: "PurchaseOrder", // must match your model association alias
          attributes: ["id", "purchase_generate_id"]
        },      
      ]
    });

    if (!purchaseOrderReturn) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order Return not found"
      });
    }

    const itemIds = purchaseOrderReturn.items.map(item => item.item_id);

    // Step 3: Get all matching ItemMaster records
    const itemMasterData = await ItemMaster.findAll({
      where: { id: itemIds },
      attributes: ["id", "item_generate_id", "item_name"]
    });

    // // Step 4: Map itemMasterData by id for fast lookup
    // const itemMap = {};
    // itemMasterData.forEach(item => {
    //   itemMap[item.id] = item;
    // });

    // // Step 5: Append itemMaster info manually to each return item
    // purchaseOrderReturn.items = purchaseOrderReturn.items.map(item => {
    //   return {
    //     ...item.toJSON(),
    //     item_info: itemMap[item.item_id] || null
    //   };
    // });

  return res.status(200).json({
      success: true,
      data: purchaseOrderReturn,
      item_data : itemMasterData
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch Purchase Order Return: ${error.message}`
    });
  }
});


v1Router.put("/purchase-order-return/:id", authenticateJWT, async (req, res) => {
  console.log("Update PO Request Body:", req.params.id);
  const transaction = await sequelize.transaction();

  try {
    const id = parseInt(req.params.id);
    console.log("Update PO Request ID:", id);
    const {
      grn_id,
      po_id,
      return_date,
      reason,
      status,
      decision,
      notes,
      return_items
    } = req.body;

    const user = req.user;

    console.log("User ID:", user.id);

    console.log("Request IF:", id);

    // Fetch and validate main record
    const poReturn = await PurchaseOrderReturn.findOne({ where: { id: id }, transaction });
    if (!poReturn) throw new Error("Purchase Order Return not found");

    console.log("PO Return:", poReturn);

    const grn = await GRN.findOne({ where: { id: grn_id }, transaction });
    if (!grn) throw new Error("GRN not found");

    console.log("GRN:", grn);

    // Validate and update return items
    if (!Array.isArray(return_items) || return_items.length === 0) {
      throw new Error("return_items must be a non-empty array");
    }

    // Totals
    let total_qty = 0;
    let cgst_amount_total = 0;
    let sgst_amount_total = 0;
    let amount_total = 0;
    let tax_amount_total = 0;
    let total_amount_total = 0;

    for (const item of return_items) {
      console.log("Processing item:", item);
      const existingItem = await PurchaseOrderReturnItem.findOne({
        where: {
          id: item.item_id,
          po_return_id: id
        },
        transaction
      });

      console.log("Existing Item:", existingItem);

      if (!existingItem) {
        throw new Error(`Return item with ID ${item.id} not found`);
      }

      const itemData = await ItemMaster.findOne({ where: { id: item.item_id }, transaction });
      if (!itemData) throw new Error(`Item not found: ${item.item_id}`);

      const cgst = itemData.cgst ?? 0;
      const sgst = itemData.sgst ?? 0;

      const returnQty = parseFloat(item.return_qty ?? 0);
      const unitPrice = parseFloat(item.unit_price ?? 0);

      const amount = returnQty * unitPrice;
      const cgst_amount = (amount * cgst) / 100;
      const sgst_amount = (amount * sgst) / 100;
      const tax_amount = cgst_amount + sgst_amount;
      const total_amount = amount + tax_amount;

      // Update item
      await existingItem.update({
        grn_item_id: item.grn_item_id,
        item_id: item.item_id,
        return_qty: returnQty,
        unit_price: unitPrice,
        cgst,
        cgst_amount,
        sgst,
        sgst_amount,
        amount,
        tax_amount,
        total_amount,
        reason: item.reason?.trim() || null,
        notes: item.notes?.trim() || null,
        updated_by: user.id,
        updated_at: new Date(),
      }, { transaction });

      // Add to totals
      total_qty += returnQty;
      cgst_amount_total += cgst_amount;
      sgst_amount_total += sgst_amount;
      amount_total += amount;
      tax_amount_total += tax_amount;
      total_amount_total += total_amount;
    }

    // Update PO Return master record
    await poReturn.update({
      grn_id,
      po_id,
      return_date: return_date || poReturn.return_date,
      reason: reason || poReturn.reason,
      status: status || poReturn.status,
      decision: decision || poReturn.decision,
      total_qty,
      cgst_amount: cgst_amount_total,
      sgst_amount: sgst_amount_total,
      amount: amount_total,
      tax_amount: tax_amount_total,
      total_amount: total_amount_total,
      notes: notes || poReturn.notes,
      updated_by: user.id,
      updated_at: new Date(),
    }, { transaction });

    // Fetch updated items
    const updatedItems = await PurchaseOrderReturnItem.findAll({
      where: { po_return_id: id },
      transaction
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Purchase Order Return updated successfully",
      data: {
        ...poReturn.toJSON(),
        return_items: updatedItems
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Error updating Purchase Order Return:", error);
    return res.status(500).json({
      success: false,
      message: `Update Failed: ${error.message}`
    });
  }
});



// Soft delete the purchase order return and its items


v1Router.delete("/purchase-order-return/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const user = req.user;

    // Find the purchase order return
    const poReturn = await PurchaseOrderReturn.findOne({
      where: {
        id: id,
        company_id: user.company_id,
        deleted_at: null
      },
      transaction
    });

    if (!poReturn) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order Return not found"
      });
    }

    // Soft delete the main return record
    await poReturn.update({
      status: "cancelled",
      decision: "disapprove",
      deleted_at: new Date(),
      updated_at: new Date(),
    }, { transaction });

    // Soft delete associated return items
    await PurchaseOrderReturnItem.update(
      {
        deleted_at: new Date(),
        updated_at: new Date(),
        updated_by: user.id
      },
      {
        where: {
          po_return_id: id,
          deleted_at: null
        },
        transaction
      }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Purchase Order Return and its items cancelled successfully (soft deleted)"
    });

  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: `Deletion failed: ${error.message}`
    });
  }
});





// 🖥 Start the app
app.use("/api", v1Router);
// await db.sequelize.sync();

const PORT = process.env.PORT_PURCHASE_RETURN;
app.listen(process.env.PORT_PURCHASE_RETURN, () => {
  console.log(`Purchase Order Return API running on port ${process.env.PORT_PURCHASE_RETURN}`);
});
