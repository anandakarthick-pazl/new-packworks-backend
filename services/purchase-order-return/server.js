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
import { generateId } from "../../common/inputvalidation/generateId.js";
const Company = db.Company;
const User = db.User;
const PurchaseOrder = db.PurchaseOrder;
const PurchaseOrderReturn = db.PurchaseOrderReturn;
const ItemMaster = db.ItemMaster;
const grnItem = db.GRNItem;
const purchase_order_item = db.PurchaseOrderItem;
const PurchaseOrderReturnItem = db.PurchaseOrderReturnItem;
const Inventory = db.Inventory;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();


v1Router.post("/purchase-order-return", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const user = req.user;
    const {
      grn_id,
      po_id,
      return_date,
      reason,
      decision,
      notes,
      items = []
    } = req.body;

    // ✅ Generate unique Purchase Return ID
const purchaseReturnGenerateId = await generateId(
      user.company_id,
      PurchaseOrderReturn,
      "purchase_order_return"
    );
    // ✅ Create Purchase Order Return
    const poReturn = await PurchaseOrderReturn.create({
      grn_id,
      po_id,
      return_date,
      reason,
      decision,
      notes,
      company_id: user.company_id,
      created_by: user.id,
      updated_by: user.id,
      purchase_order_return_: purchaseReturnGenerateId
    }, { transaction: t });

    // ✅ Create associated return items
    for (const item of items) {
      await PurchaseOrderReturnItem.create({
        po_return_id: poReturn.id,
        grn_item_id: item.grn_item_id,
        item_id: item.item_id,
        company_id: user.company_id,
        return_qty: item.return_qty,
        unit_price: item.unit_price,
        cgst: item.cgst,
        cgst_amount: item.cgst_amount,
        sgst: item.sgst,
        sgst_amount: item.sgst_amount,
        amount: item.amount,
        tax_amount: item.tax_amount,
        total_amount: item.total_amount,
        reason: item.reason,
        notes: item.notes,
        created_by: user.id,
        updated_by: user.id
      }, { transaction: t });
    }

    await t.commit();

    // ✅ Optional: Return full record with associations
    const finalReturn = await PurchaseOrderReturn.findOne({
      where: { id: poReturn.id },
      include: [
        { model: PurchaseOrderReturnItem, as: "items" }
      ]
    });

    return res.status(201).json({
      success: true,
      message: "Purchase Order Return created successfully",
      data: finalReturn
    });

  } catch (error) {
    await t.rollback();
    console.error("Error creating purchase order return:", error);
    return res.status(500).json({
      success: false,
      message: `Failed to create Purchase Order Return: ${error.message}`
    });
  }
});



v1Router.get("/purchase-order-return", authenticateJWT, async (req, res) => {
  console.log("Fetching Purchase Order Returns");

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
      where.supplier_name = { [Op.like]: `%${search}%` }; // ✅ Fixed this line
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

    return res.status(200).json({
      success: true,
      message: "Purchase order returns fetched",
      data: allReturns,
      totalCount,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch Purchase Order Returns: ${error.message}` // ✅ Fixed this line
    });
  }
});



v1Router.get("/purchase-order-return/:id", authenticateJWT, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const purchaseOrderReturn = await PurchaseOrderReturn.findOne({
      where: {
        id,
        company_id: user.company_id,
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
        message: "Purchase Order Return not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Purchase order return fetched",
      data: purchaseOrderReturn,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch Purchase Order Return: ${error.message}`,
    });
  }
});



v1Router.put("/purchase-order-return/:id", authenticateJWT, async (req, res) => {
   console.log("Update PO Request Body:", req.params.id);
  const transaction = await sequelize.transaction();

  try {
    const id  = parseInt(req.params.id);
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
    const poReturn = await PurchaseOrderReturn.findOne({ where: { id : id }, transaction });
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
//get id,generateId 
v1Router.get("/purchaseorder-return/ids", authenticateJWT, async (req, res) => {
  try {
    const user = req.user;

    const allReturns = await PurchaseOrderReturn.findAll({
      where: { company_id: user.company_id },
      attributes: ['id', 'purchase_return_generate_id'],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      message: "Purchase order returns fetched successfully",
      data: allReturns
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch Purchase Order Returns: ${error.message}`
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
