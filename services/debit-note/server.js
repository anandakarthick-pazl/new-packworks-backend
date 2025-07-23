import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import "../../common/models/association.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import { Op } from "sequelize";
import { 
  branchFilterMiddleware, 
  resetBranchFilter, 
  setupBranchFiltering,
  patchModelForBranchFiltering 
} from "../../common/helper/branchFilter.js";


dotenv.config();
const app = express();
app.use(json());
app.use(cors());
setupBranchFiltering(sequelize);

const v1Router = Router();
v1Router.use(branchFilterMiddleware);
v1Router.use(resetBranchFilter);

const PurchaseOrder = db.PurchaseOrder;
const PurchaseOrderReturn = db.PurchaseOrderReturn;
const PurchaseOrderReturnItem = db.PurchaseOrderReturnItem;
const debit_note = db.DebitNote;
const Inventory = db.Inventory;
patchModelForBranchFiltering(debit_note);


// Create 
v1Router.post("/debit-note", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      reference_id,
      reason,
      remark,
      debit_note_date,
      po_return_id
    } = req.body;

    const user = req.user;

    // Validate required fields
    if (!debit_note_date || isNaN(new Date(debit_note_date))) {
      throw new Error("Valid debit note date is required");
    }
    if (!po_return_id) throw new Error("Purchase Order Return ID (po_return_id) is required");

    // Check for duplicate
    const existing = await debit_note.findOne({ where: { po_return_id } });
    if (existing) throw new Error(`Purchase order Return Based Debit Note already exists`);

    // Generate unique debit_note_generate_id
    const debit_note_generate_id = await generateId(user.company_id, debit_note, "debit_note");

    // Fetch PO Return and related data
    const poReturn = await PurchaseOrderReturn.findOne({
      where: { id: po_return_id, company_id: user.company_id },
      attributes: ["id", "grn_id", "po_id", "tax_amount"],
      include: [
        {
          model: PurchaseOrderReturnItem,
          as: "items",
          attributes: ["id", "item_id", "return_qty", "unit_price", "amount"]
        },
        {
          model: PurchaseOrder,
          as: "PurchaseOrder",
          attributes: ["id", "supplier_id"]
        }
      ],
      transaction
    });

    if (!poReturn) throw new Error("Purchase Order Return not found");

    const supplier_id = poReturn.PurchaseOrder?.supplier_id;
    if (!supplier_id) throw new Error("Supplier ID not found from Purchase Order");

    const items = poReturn.items || [];
    if (!items.length) throw new Error("No Purchase Order Return Items found");

    // const rate = items[0]?.unit_price || 0;
    const amount = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    // const sub_total = amount;
    // const adjustment = 0;
    const tax_amount = parseFloat(poReturn.tax_amount || 0);
    const total_amount = amount + tax_amount;

    // Create debit note
    const debitNote = await debit_note.create({
      debit_note_generate_id,
      po_return_id,
      reference_id,
      company_id: user.company_id,
      supplier_id,
      // rate,
      amount,
      // sub_total,
      // adjustment,
      tax_amount,
      total_amount,
      reason,
      remark,
      debit_note_date,
      created_by: user.id,
      updated_by: user.id,
      created_at: new Date()
    }, { transaction });

    await poReturn.update(
      { status: "processed" },
      { transaction }
    );

    // Update inventory per item
    for (const item of items) {
      const { item_id, return_qty } = item;
      const { grn_id, po_id } = poReturn;

      if (!item_id || !grn_id || !po_id) {
        throw new Error(`Missing identifiers: item_id=${item_id}, grn_id=${grn_id}, po_id=${po_id}`);
      }

      const quantity = parseFloat(return_qty || 0);

      const inventory = await Inventory.findOne({
        where: {
          item_id,
          grn_id,
          po_id,
          company_id: user.company_id
        },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!inventory) {
        throw new Error(`Inventory not found for item_id=${item_id}, grn_id=${grn_id}, po_id=${po_id}`);
      }

      // const currentQty = parseFloat(inventory.quantity_available || 0);

      // if (quantity > currentQty) {
      //   throw new Error(`Return quantity exceeds available: item_id=${item_id}, available=${currentQty}, return=${quantity}`);
      // }

      // const newQty = currentQty - quantity;

      await inventory.update({
        // quantity_available: newQty,
        debit_note_id: debitNote.id
      }, { transaction });
    }

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Debit Note created and inventory updated successfully",
      data: debitNote,
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Debit note creation error:", error);
    return res.status(500).json({
      success: false,
      message: `Creation failed: ${error.message}`,
      errors: error.errors ? error.errors.map(e => e.message) : null
    });
  }
});




v1Router.get("/debit-note", authenticateJWT, async (req, res) => {
    try {
      const { search = "", page = "1", limit = "10" } = req.query;

      const pageNumber = Math.max(1, parseInt(page));
      const limitNumber = Math.max(1, parseInt(limit));
      const offset = (pageNumber - 1) * limitNumber;

      // Build WHERE condition
      const whereCondition = {
        status: "active",
      };

      if (search.trim() !== "") {
        whereCondition[Op.or] = [
          {
            debit_note_generate_id: {
              [Op.like]: `%${search}%`,
            },
          },
        ];
      }

    const debitNotes = await debit_note.findAll({
      where: whereCondition,
      limit: limitNumber,
      offset,
      include: [
        {
          model: PurchaseOrderReturn,
          include: [
            {
              model: PurchaseOrderReturnItem,
              as: "items",
            },
            {
              model: PurchaseOrder, // ✅ Include Purchase Order details
              as: "PurchaseOrder",
              attributes: [ "id","supplier_id", "supplier_name", "shipping_address", "supplier_contact", "supplier_email", "payment_terms", "freight_terms", "total_qty", "cgst_amount", "sgst_amount", "amount", "tax_amount", "total_amount", "status", "decision", "created_at", "updated_at", "created_by", "updated_by"] // Add any fields you need
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });
        const totalCount = await debit_note.count({ where: whereCondition });


    return res.status(200).json({
      success: true,
      message: "Fetched Debit Notes with related Purchase Order data successfully",
      data: debitNotes,
      totalCount,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalCount / limitNumber),
        pageSize: limitNumber,
        totalRecords: totalCount
      }
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
               as: "PurchaseOrder",
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
      reference_id,
      debit_note_date,
      reason,
      remark
    } = req.body;

   

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


//get all purchase order return ids that are not used in debit note
v1Router.get("/debit-note/get/po-return-id", authenticateJWT, async (req, res) => {
  try {
    // Get all used purchase_return_ids from DebitNote
    const usedIds = await debit_note.findAll({
      attributes: ['po_return_id'],
      raw: true
    });

    const usedIdList = usedIds.map(item => item.po_return_id);

    // Get only unused PurchaseOrderReturn entries
    const purchaseOrderreturn = await PurchaseOrderReturn.findAll({
      attributes: ["id", "purchase_return_generate_id", "total_amount"],
      where: {
        id: {
          [Op.notIn]: usedIdList
        }
      },
      order: [["id", "DESC"]]
    });

    res.status(200).json({
      success: true,
      data: purchaseOrderreturn
    });
  } catch (error) {
    console.error("Error fetching purchase order return IDs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchase return order IDs"
    });
  }
});









// 🖥 Start the app
app.use("/api", v1Router);
// await db.sequelize.sync();

const PORT = process.env.PORT_DEBIT_NOTE;
app.listen(process.env.PORT_DEBIT_NOTE,'0.0.0.0', () => {
  console.log(`Debit Note running on port ${process.env.PORT_DEBIT_NOTE}`);
});