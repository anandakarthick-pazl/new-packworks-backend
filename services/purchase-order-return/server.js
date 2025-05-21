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
import "../../common/models/association.js";
const Company = db.Company;
const User = db.User;
const PurchaseOrder = db.PurchaseOrder;
const PurchaseOrderReturn = db.PurchaseOrderReturn;
const ItemMaster = db.ItemMaster;
const grnItem = db.GRNItem;
const purchase_order_item = db.PurchaseOrderItem;
const PurchaseOrderReturnItem = db.PurchaseOrderReturnItem;

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
      status,
      decision,
      notes,
      return_items
    } = req.body;

    const user = req.user;

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
      company_id: user.company_id
    }, { transaction });

    // Process Return Items
    for (const item of return_items) {
      const poItem = poItemsMap[item.po_item_id];
      if (!poItem) throw new Error(`PO Item not found for ID: ${item.po_item_id}`);

      // Generate purchase_return_generate_id
          const purchase_return_generate_id = await generateId(
            req.user.company_id,
            PurchaseOrderReturn,
            "purchase_order_returns"
            
          );
      const qty = item.return_qty;
      const unitPrice = poItem.unit_price;
      const itemAmount = qty * unitPrice;
      const itemCgstAmount = itemAmount * (poItem.cgst / 100);
      const itemSgstAmount = itemAmount * (poItem.sgst / 100);
      const itemTaxAmount = itemCgstAmount + itemSgstAmount;
      const itemTotalAmount = itemAmount + itemTaxAmount;

      await PurchaseOrderReturnItem.create({
        por_id: poReturn.id,
        grn_item_id: item.grn_item_id,
        item_id: poItem.item_id,
        company_id: user.company_id,
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
        }
      ],
      order: [['created_at', 'DESC']],
      limit: limitNumber,
      offset,
    });

    const approved = allReturns.filter(ret => ret.decision === 'approve');
    const disapproved = allReturns.filter(ret => ret.decision === 'disapprove');

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
          as: "items",
        }
      ]
    });

    if (!purchaseOrderReturn) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order Return not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: purchaseOrderReturn
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch Purchase Order Return: ${error.message}`
    });
  }
});


v1Router.put("/purchase-order-return/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  console.log("params", req.params);
  console.log("body", req.body);

  try {
    const { id } = req.params;
    const {
      grn_id,
      po_id,
      return_date,
      reason,
      status,
      decision,
      total_qty,
      cgst_amount,
      sgst_amount,
      amount,
      tax_amount,
      total_amount,
      notes,
      return_items
    } = req.body;

    const user = req.user;

    // Fetch main record
    const poReturn = await PurchaseOrderReturn.findOne({ where: { id }, transaction });
    if (!poReturn) throw new Error("Purchase Order Return not found");

    const grn = await GRN.findOne({ where: { id: grn_id }, transaction });
    if (!grn) throw new Error("GRN not found");

    // Update PurchaseOrderReturn
    await poReturn.update({
      grn_id: grn_id || poReturn.grn_id,
      po_id: po_id || poReturn.po_id,
      return_date: return_date || poReturn.return_date,
      reason: reason || poReturn.reason,
      status: status || poReturn.status,
      decision: decision || poReturn.decision,
      total_qty: total_qty ?? poReturn.total_qty,
      cgst_amount: cgst_amount ?? poReturn.cgst_amount,
      sgst_amount: sgst_amount ?? poReturn.sgst_amount,
      amount: amount ?? poReturn.amount,
      tax_amount: tax_amount ?? poReturn.tax_amount,
      total_amount: total_amount ?? poReturn.total_amount,
      notes: notes || poReturn.notes,
      updated_by: user.id,
      updated_at: new Date(),
    }, { transaction });

    // Validate and update return items
    if (!Array.isArray(return_items) || return_items.length === 0) {
      throw new Error("return_items must be a non-empty array");
    }

    for (const item of return_items) {
      const existingItem = await PurchaseOrderReturnItem.findOne({
        where: {
          id: item.id,
          por_id: id  // corrected key from 'por_id' to 'purchase_order_return_id'
        },
        transaction
      });

      if (!existingItem) {
        throw new Error(`Return item with ID ${item.id} not found`);
      }

      const returnQty = parseFloat(item.return_qty ?? 0);
      if (isNaN(returnQty) || returnQty < 0) {
        throw new Error(`Invalid return quantity for item ID ${item.id}`);
      }

      await existingItem.update({
        grn_item_id: item.grn_item_id,
        item_id: item.item_id,
        return_qty: returnQty,
        unit_price: parseFloat(item.unit_price ?? 0),
        cgst: parseFloat(item.cgst ?? 0),
        cgst_amount: parseFloat(item.cgst_amount ?? 0),
        sgst: parseFloat(item.sgst ?? 0),
        sgst_amount: parseFloat(item.sgst_amount ?? 0),
        amount: parseFloat(item.amount ?? 0),
        tax_amount: parseFloat(item.tax_amount ?? 0),
        total_amount: parseFloat(item.total_amount ?? 0),
        reason: item.reason?.trim() || null,
        notes: item.notes?.trim() || null,
        updated_by: user.id,
        updated_at: new Date(),
      }, { transaction });
    }

    // Fetch updated return items manually
    const updatedReturnItems = await PurchaseOrderReturnItem.findAll({
      where: { por_id: id },
      transaction
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Purchase Order Return and items updated successfully",
      data: {
        ...poReturn.toJSON(),
        return_items: updatedReturnItems
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
          por_id: id,
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
await db.sequelize.sync();

const PORT = 3029;
app.listen(PORT, () => {
  console.log(`Purchase Order Return API running on port ${PORT}`);
});
