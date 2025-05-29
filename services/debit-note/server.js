import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import GRN from "../../common/models/grn/grn.model.js";
import GRNItem from "../../common/models/grn/grn_item.model.js";
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
const InvoiceSetting = db.InvoiceSetting;
const debit_note = db.DebitNote;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();




v1Router.post("/debit-note", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      debit_note_number,
      reference_id,
      reason,
      remark,
      debit_note_date,
      po_return_id
    } = req.body;

    const user = req.user;

    if (!debit_note_number) throw new Error("Debit note number is required");
    if (!debit_note_date || isNaN(new Date(debit_note_date))) {
      throw new Error("Valid debit note date is required");
    }
    if (!po_return_id) throw new Error("Purchase Order Return ID (po_return_id) is required");

    const existing = await debit_note.findOne({ where: { debit_note_number } });
    if (existing) throw new Error(`Debit Note ${debit_note_number} already exists`);

    // 🔢 Auto-generate debit_note_generate_id like DN-001
    const lastNote = await debit_note.findOne({
      where: {
        debit_note_generate_id: { [Op.like]: 'DN-%' }
      },
      order: [['created_at', 'DESC']],
      attributes: ['debit_note_generate_id']
    });

    let debit_note_generate_id = "DN-001";
    if (lastNote && lastNote.debit_note_generate_id) {
      const match = lastNote.debit_note_generate_id.match(/DN-(\d+)/);
      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        debit_note_generate_id = `DN-${String(nextNum).padStart(3, '0')}`;
      }
    }

    // Fetch PO Return with items and PO (for supplier)
    const poReturn = await PurchaseOrderReturn.findOne({
      where: { id: po_return_id, company_id: user.company_id },
      include: [
        { model: PurchaseOrderReturnItem, as: "items" },
        { model: PurchaseOrder, attributes: ["id", "supplier_id"] }
      ],
      transaction
    });

    if (!poReturn) throw new Error("Purchase Order Return not found");

    const supplier_id = poReturn.PurchaseOrder?.supplier_id;
    if (!supplier_id) throw new Error("Supplier ID not found from Purchase Order");

    const items = poReturn.items || [];
    if (!items.length) throw new Error("No Purchase Order Return Items found");

    const matchedItems = items;

    const rate = matchedItems[0]?.unit_price || 0;
    const amount = matchedItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const sub_total = amount;
    const adjustment = 0;
    const tax_amount = parseFloat(poReturn.tax_amount || 0);
    const total_amount = sub_total + tax_amount;

    const debitNote = await debit_note.create({
      debit_note_number,
      debit_note_generate_id, // ⬅️ Auto-generated field
      po_return_id,
      reference_id,
      company_id: user.company_id,
      supplier_id,
      rate,
      amount,
      sub_total,
      adjustment,
      tax_amount,
      total_amount,
      reason,
      remark,
      debit_note_date,
      created_by: user.id,
      updated_by: user.id,
      created_at: new Date()
    }, { transaction });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Debit Note created successfully",
      data: debitNote,
      matched_items: matchedItems
    });

  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({
      success: false,
      message: `Creation failed: ${error.message}`,
      errors: error.errors ? error.errors.map(e => e.message) : null
    });
  }
});



v1Router.get("/debit-note", authenticateJWT, async (req, res) => {
  try {
    const debitNotes = await debit_note.findAll({
      include: [
        {
          model: PurchaseOrderReturn,
          include: [
            {
              model: PurchaseOrderReturnItem,
              as: "items"
            },
            {
              model: PurchaseOrder, // ✅ Include Purchase Order details
              attributes: [ "id","supplier_id", "supplier_name", "shipping_address", "supplier_contact", "supplier_email", "payment_terms", "freight_terms", "total_qty", "cgst_amount", "sgst_amount", "amount", "tax_amount", "total_amount", "status", "decision", "created_at", "updated_at", "created_by", "updated_by"] // Add any fields you need
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      message: "Fetched Debit Notes with related Purchase Order data successfully",
      data: debitNotes
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: `Failed to fetch Debit Notes: ${error.message}`,
      errors: error.errors ? error.errors.map(e => e.message) : null
    });
  }
});




v1Router.get("/debit-note/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const debitNote = await debit_note.findOne({
      where: { id },
      include: [
        {
          model: PurchaseOrderReturn,
          include: [
            {
              model: PurchaseOrderReturnItem,
              as: "items"
            },
            {
              model: PurchaseOrder,
              attributes: [
                "id",
                "purchase_generate_id",
                "po_code",
                "company_id",
                "po_date",
                "valid_till",
                "supplier_id",
                "supplier_name",
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
                "decision",
                "created_at",
                "updated_at",
                "created_by",
                "updated_by"
              ]
            }
          ]
        }
      ]
    });

    if (!debitNote) {
      return res.status(404).json({
        success: false,
        message: "Debit Note not found"
      });
    }

    const plainNote = debitNote.get({ plain: true });

    if (plainNote.item_details && typeof plainNote.item_details === 'string') {
      try {
        plainNote.item_details = JSON.parse(plainNote.item_details);
      } catch {
        // skip parsing error
      }
    }

    return res.status(200).json({
      success: true,
      message: "Fetched Debit Note with related Purchase Order data successfully",
      data: plainNote
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: `Failed to fetch Debit Note: ${error.message}`,
      errors: error.errors ? error.errors.map(e => e.message) : null
    });
  }
});



v1Router.put("/debit-note/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      po_return_id,
      debit_note_number,
      reference_id,
      debit_note_date,
      reason,
      remark
    } = req.body;

    // Validate required fields if needed
    if (debit_note_number !== undefined && !debit_note_number.trim()) {
      throw new Error("Debit note number cannot be empty");
    }

    if (debit_note_date !== undefined && isNaN(new Date(debit_note_date))) {
      throw new Error("Valid debit note date is required");
    }

    const debitNote = await debit_note.findByPk(id);

    if (!debitNote) {
      throw new Error(`Debit Note with id ${id} not found`);
    }

    // If updating po_return_id, you might want to check if the new po_return_id exists (optional)
    if (po_return_id !== undefined) {
      // Optionally validate po_return_id existence here
      // const poReturnExists = await PurchaseOrderReturn.findByPk(po_return_id);
      // if (!poReturnExists) throw new Error(`Purchase Order Return with id ${po_return_id} not found`);
      debitNote.po_return_id = po_return_id;
    }

    if (debit_note_number !== undefined) debitNote.debit_note_number = debit_note_number;
    if (reference_id !== undefined) debitNote.reference_id = reference_id;
    if (debit_note_date !== undefined) debitNote.debit_note_date = debit_note_date;
    if (reason !== undefined) debitNote.reason = reason;
    if (remark !== undefined) debitNote.remark = remark;

    debitNote.updated_at = new Date();

    await debitNote.save({ transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Debit Note updated successfully",
      data: debitNote
    });

  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({
      success: false,
      message: `Update failed: ${error.message}`,
      errors: error.errors ? error.errors.map(e => e.message) : null
    });
  }
});






// Soft delete the purchase order return and its items
v1Router.delete("/debit-note/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const debitNote = await debit_note.findByPk(id);

    if (!debitNote) {
      throw new Error(`Debit Note with id ${id} not found`);
    }

    // Soft delete: set status to 'inactive' and update updated_at
    debitNote.status = "inactive";
    debitNote.updated_at = new Date();
    debitNote.deleted_at = new Date(); // Set the deleted_at timestamp

    await debitNote.save({ transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Debit Note marked as inactive successfully",
      data: debitNote
    });

  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({
      success: false,
      message: `Deletion failed: ${error.message}`,
      errors: error.errors ? error.errors.map(e => e.message) : null
    });
  }
});








// 🖥 Start the app
app.use("/api", v1Router);
await db.sequelize.sync();

const PORT = 3031;
app.listen(PORT, () => {
  console.log(`debit note API running on port ${PORT}`);
});
