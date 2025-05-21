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
    const { grn_id, po_id } = req.body;
    const user = req.user;

    const grn = await GRN.findOne({
      where: { grn_id },
      include: [
        {
          model: PurchaseOrder,
          attributes: { exclude: ['created_at', 'updated_at'] },
          include: [
            {
              model: PurchaseOrderItem,
              attributes: { exclude: ['created_at', 'updated_at'] }
            }
          ]
        }
      ]
    });

    if (!grn) throw new Error("GRN not found");

    const purchaseOrder = grn.PurchaseOrder;

    if (po_id && purchaseOrder?.po_id !== po_id) {
      throw new Error("Provided PO ID does not match GRN's Purchase Order");
    }

    const purchaseOrderItems = purchaseOrder?.PurchaseOrderItems || [];

    const total_qty = purchaseOrderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

    const poReturn = await PurchaseOrderReturn.create({
      grn_id,
      po_id,
      total_qty,
      return_date: new Date(),
      reason: "Auto-filled return",
      status: "initiated",
      decision: "approve",
      payment_terms: purchaseOrder?.payment_terms || null,
      created_by: user.id,
      
      company_id: user.company_id
    }, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Purchase Order Return created successfully",
      data: {
        purchaseOrderReturn: {
          id: poReturn.id,
          grn_id: poReturn.grn_id,
          po_id: poReturn.po_id,
          total_qty: poReturn.total_qty,
          return_date: poReturn.return_date,
          reason: poReturn.reason,
          status: poReturn.status,
          decision: poReturn.decision,
          payment_terms: poReturn.payment_terms,
          created_by: poReturn.created_by,
          company_id: poReturn.company_id,
          created_at: poReturn.created_at
          // ✅ updated_at is intentionally excluded
        },
        purchaseOrder,
        purchaseOrderItems
      }
    });

  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: `Creation Failed: ${error.message}`
    });
  }
});



// v1Router.get("/purchase-order-return", authenticateJWT, async (req, res) => {
//   try {
//     const user = req.user;

//     const allReturns = await PurchaseOrderReturn.findAll({
//       where: {
//         company_id: user.company_id
        
//       },
      
//       order: [['created_at', 'DESC']]
//     });

//     // Group into approved and disapproved
//     const approved = allReturns.filter(ret => ret.decision === 'approve');
//     const disapproved = allReturns.filter(ret => ret.decision === 'disapprove');

//     return res.status(200).json({
//       success: true,
//       approved,
//       disapproved
//     });

//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: `Failed to fetch Purchase Order Returns: ${error.message}`
//     });
//   }
// });

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

    // Fetch the PurchaseOrderReturn record
    const poReturn = await PurchaseOrderReturn.findOne({ where: { id } });
    if (!poReturn) throw new Error("Purchase Order Return not found");

    // Fetch GRN for validation (optional but kept for consistency)
    const grn = await GRN.findOne({ where: { grn_id } });
    if (!grn) throw new Error("GRN not found");

    // Update fields
    poReturn.grn_id = grn_id || poReturn.grn_id;
    poReturn.po_id = po_id || poReturn.po_id;
    poReturn.return_date = return_date || poReturn.return_date;
    poReturn.reason = reason || poReturn.reason;
    poReturn.status = status || poReturn.status;
    poReturn.decision = decision || poReturn.decision;
    poReturn.total_qty = total_qty ?? poReturn.total_qty;
    poReturn.cgst_amount = cgst_amount ?? poReturn.cgst_amount;
    poReturn.sgst_amount = sgst_amount ?? poReturn.sgst_amount;
    poReturn.amount = amount ?? poReturn.amount;
    poReturn.tax_amount = tax_amount ?? poReturn.tax_amount;
    poReturn.total_amount = total_amount ?? poReturn.total_amount;
    poReturn.notes = req.body.notes || poReturn.notes; 
    poReturn.updated_by = user.id;

    await poReturn.save({ transaction });

    // Handle return items update
    if (return_items && Array.isArray(return_items)) {
      await PurchaseOrderReturnItem.destroy({
        where: { purchase_order_return_id: id },
        transaction
      });

      for (const item of return_items) {
        await PurchaseOrderReturnItem.create({
          purchase_order_return_id: poReturn.id,
          grn_item_id: item.grn_item_id,
          item_id: item.item_id,
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
        }, { transaction });
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Purchase Order Return and Return Items updated successfully",
      data: poReturn
    });

  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: `Update Failed: ${error.message}`
    });
  }
});








v1Router.delete("/purchase-order-return/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const user = req.user;

    // Find the purchase order return by ID and company
    const poReturn = await PurchaseOrderReturn.findOne({
      where: {
        id: id,  // ✅ use 'id', not 'por_id'
        company_id: user.company_id,
        deleted_at: null
      }
    });
      
    if (!poReturn) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order Return not found"
      });
    }

    // Soft delete: update status and decision, and set deleted_at
    await poReturn.update({
      status: "cancelled",
      decision: "disapprove",
      deleted_at: new Date()
    }, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Purchase Order Return cancelled (soft deleted)"
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

const PORT = 3028;
app.listen(process.env.PORT_PURCHASE_RETURN,'0.0.0.0', () => {
  console.log(`Purchase Order Return API running on port ${process.env.PORT_PURCHASE_RETURN}`);
});
