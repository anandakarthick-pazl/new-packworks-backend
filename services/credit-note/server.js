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
const credit_note = db.CreditNote;
const SalesOrder = db.SalesOrder;


dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();



// v1Router.post("/credit-note", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();

//   try {
//     const {
//       credit_note_number,
//       reference_id,
//       reason,
//       remark,
//       credit_note_date,
//       sales_order_return_id
//     } = req.body;

//     const user = req.user;

//     if (!credit_note_number) throw new Error("Credit note number is required");
//     if (!credit_note_date || isNaN(new Date(credit_note_date))) {
//       throw new Error("Valid credit note date is required");
//     }
//     if (!sales_order_return_id) throw new Error("Sales Order Return ID (sales_order_return_id) is required");

//     // Ensure credit_note_number is unique
//     const existing = await credit_note.findOne({ where: { credit_note_number } });
//     if (existing) throw new Error(`Credit Note with number ${credit_note_number} already exists`);

//     // Get SalesOrderReturn with SalesOrder (for customer ID)
//     const soReturn = await SalesOrderReturn.findOne({
//       where: { id: sales_order_return_id, company_id: user.company_id },
//       include: [
//         {
//           model: SalesOrder,
//           attributes: ["id", "customer_id"]
//         }
//       ]
//     });

//     if (!soReturn) throw new Error("Sales Order Return not found");
//     const customer_id = soReturn.SalesOrder?.customer_id;
//     if (!customer_id) throw new Error("Customer ID not found from Sales Order");

//     const rate = 0; // No items = no rate
//     const amount = parseFloat(soReturn.total_amount || 0);
//     const sub_total = amount;
//     const adjustment = 0;
//     const tax_amount = parseFloat(soReturn.tax_amount || 0);
//     const total_amount = sub_total + tax_amount;

//     const creditNote = await credit_note.create({
//       credit_note_number,
//       sales_order_return_id,
//       reference_id,
//       company_id: user.company_id,
//       customer_id,
//       rate,
//       amount,
//       sub_total,
//       adjustment,
//       tax_amount,
//       total_amount,
//       reason,
//       remark,
//       credit_note_date,
//       created_by: user.id,
//       updated_by: user.id,
//       created_at: new Date()
//     }, { transaction });

//     await transaction.commit();

//     return res.status(201).json({
//       success: true,
//       message: "Credit Note created successfully",
//       data: creditNote
//     });

//   } catch (error) {
//     await transaction.rollback();
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: `Creation failed: ${error.message}`,
//       errors: error.errors ? error.errors.map(e => e.message) : null
//     });
//   }
// });




// v1Router.get("/credit-note", authenticateJWT, async (req, res) => {
//   try {
//     const creditNotes = await credit_note.findAll({
//       include: [
//         {
//           model: SalesOrderReturn,
//           include: [
//             {
//               model: SalesOrder,
//               attributes: [
//                 "id",
//                 "customer_id",
//                 "customer_name",
//                 "customer_email",
//                 "customer_phone",
//                 "billing_address",
//                 "shipping_address",
//                 "total_qty",
//                 "amount",
//                 "tax_amount",
//                 "total_amount",
//                 "status",
//                 "payment_terms",
//                 "created_at",
//                 "updated_at",
//                 "created_by",
//                 "updated_by"
//               ]
//             }
//           ]
//         }
//       ],
//       order: [["created_at", "DESC"]]
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Fetched Credit Notes with related Sales Order data successfully",
//       data: creditNotes
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: `Failed to fetch Credit Notes: ${error.message}`,
//       errors: error.errors ? error.errors.map(e => e.message) : null
//     });
//   }
// });



// v1Router.get("/credit-note/:id", authenticateJWT, async (req, res) => {
//   try {
//     const { id } = req.params;

//     const creditNote = await credit_note.findOne({
//       where: { id },
//       include: [
//         {
//           model: SalesOrderReturn,
//           include: [
//             {
//               model: SalesOrder,
//               attributes: [
//                 "id",
//                 "customer_id",
//                 "customer_name",
//                 "customer_email",
//                 "customer_phone",
//                 "billing_address",
//                 "shipping_address",
//                 "total_qty",
//                 "amount",
//                 "tax_amount",
//                 "total_amount",
//                 "status",
//                 "payment_terms",
//                 "created_at",
//                 "updated_at",
//                 "created_by",
//                 "updated_by"
//               ]
//             }
//           ]
//         }
//       ]
//     });

//     if (!creditNote) {
//       return res.status(404).json({
//         success: false,
//         message: `Credit Note with id ${id} not found`
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Fetched Credit Note successfully",
//       data: creditNote
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: `Failed to fetch Credit Note: ${error.message}`,
//       errors: error.errors ? error.errors.map(e => e.message) : null
//     });
//   }
// });



// v1Router.put("/credit-note/:id", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();

//   try {
//     const { id } = req.params;
//     const {
//       credit_note_number,
//       reference_id,
//       reason,
//       remark,
//       credit_note_date,
//       status
//     } = req.body;

//     const creditNote = await credit_note.findByPk(id);

//     if (!creditNote) {
//       throw new Error(`Credit Note with id ${id} not found`);
//     }

//     // Optional: Validate date if provided
//     if (credit_note_date && isNaN(new Date(credit_note_date))) {
//       throw new Error("Valid credit note date is required");
//     }

//     // Update only the fields that are provided in the request
//     creditNote.credit_note_number = credit_note_number ?? creditNote.credit_note_number;
//     creditNote.reference_id = reference_id ?? creditNote.reference_id;
//     creditNote.reason = reason ?? creditNote.reason;
//     creditNote.remark = remark ?? creditNote.remark;
//     creditNote.credit_note_date = credit_note_date ?? creditNote.credit_note_date;
//     creditNote.status = status ?? creditNote.status;
//     creditNote.updated_at = new Date();
//     creditNote.updated_by = req.user.id;

//     await creditNote.save({ transaction });
//     await transaction.commit();

//     return res.status(200).json({
//       success: true,
//       message: "Credit Note updated successfully",
//       data: creditNote
//     });

//   } catch (error) {
//     await transaction.rollback();
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: `Update failed: ${error.message}`,
//       errors: error.errors ? error.errors.map(e => e.message) : null
//     });
//   }
// });





// // Soft delete the purchase order return and its items
// v1Router.delete("/credit-note/:id", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();

//   try {
//     const { id } = req.params;

//     const creditNote = await credit_note.findByPk(id);

//     if (!creditNote) {
//       throw new Error(`Credit Note with id ${id} not found`);
//     }

//     // Soft delete: set status to 'inactive' and mark deleted_at
//     creditNote.status = "inactive";
//     creditNote.updated_at = new Date();
//     creditNote.deleted_at = new Date();

//     await creditNote.save({ transaction });
//     await transaction.commit();

//     return res.status(200).json({
//       success: true,
//       message: "Credit Note marked as inactive successfully",
//       data: creditNote
//     });

//   } catch (error) {
//     await transaction.rollback();
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: `Deletion failed: ${error.message}`,
//       errors: error.errors ? error.errors.map(e => e.message) : null
//     });
//   }
// });


v1Router.post("/credit-note", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      credit_note_number,
      sales_order_return_id,
      reference_id,
      supplier_id,
      rate,
      amount,
      sub_total,
      adjustment,
      tax_amount,
      total_amount,
      reason,
      remark,
      credit_note_date
    } = req.body;

    const user = req.user;

    // ✅ Validate required fields
    if (!credit_note_number) throw new Error("Credit note number is required");
    if (!credit_note_date || isNaN(new Date(credit_note_date))) {
      throw new Error("Valid credit note date is required");
    }

    // ✅ Check for duplicate
    const existing = await credit_note.findOne({ where: { credit_note_number } });
    if (existing) throw new Error(`Credit Note ${credit_note_number} already exists`);

    // ✅ Generate unique credit_note_generate_id
    const credit_note_generate_id = await generateId(user.company_id, credit_note, "credit_note");

    // ✅ Create the credit note
    const note = await credit_note.create({
      credit_note_number,
      credit_note_generate_id,
      sales_order_return_id: sales_order_return_id || null,
      company_id: user.company_id,
      reference_id,
      supplier_id,
      rate,
      amount,
      sub_total,
      adjustment,
      tax_amount,
      total_amount,
      reason,
      remark,
      credit_note_date,
      status: "active",
      created_by: user.id,
      updated_by: user.id,
      created_at: new Date()
    }, { transaction });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Credit Note created successfully",
      data: note
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Credit Note Error:", error);
    return res.status(500).json({
      success: false,
      message: `Creation failed: ${error.message}`,
      errors: error.errors ? error.errors.map(e => e.message) : null
    });
  }
});

v1Router.get("/credit-note", authenticateJWT, async (req, res) => {
  try {
    const notes = await credit_note.findAll({
      where: { company_id: req.user.company_id },
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: notes,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Fetch failed: ${error.message}`,
    });
  }
});


v1Router.get("/credit-note/:id", authenticateJWT, async (req, res) => {
  try {
    const note = await credit_note.findByPk(req.params.id);
    if (!note) throw new Error("Credit Note not found");

    return res.status(200).json({
      success: true,
      data: note
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: `Fetch failed: ${error.message}`
    });
  }
});

v1Router.put("/credit-note/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const creditNoteId = req.params.id;
    const user = req.user;

    const {
      // credit_note_number, ← Removed from destructuring
      sales_order_return_id,
      reference_id,
      supplier_id,
      rate,
      amount,
      sub_total,
      adjustment,
      tax_amount,
      total_amount,
      reason,
      remark,
      credit_note_date,
      status
    } = req.body;

    const note = await credit_note.findOne({
      where: { id: creditNoteId, company_id: user.company_id }
    });

    if (!note) {
      throw new Error("Credit Note not found or access denied");
    }


    await note.update({
      // credit_note_number: not updated
      sales_order_return_id,
      reference_id,
      supplier_id,
      rate,
      amount,
      sub_total,
      adjustment,
      tax_amount,
      total_amount,
      reason,
      remark,
      credit_note_date,
      status: status || note.status,
      updated_by: user.id,
      updated_at: new Date()
    }, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Credit Note updated successfully",
      data: note
    });

  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({
      success: false,
      message: `Update failed: ${error.message}`
    });
  }
});



v1Router.delete("/credit-note/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const note = await credit_note.findByPk(req.params.id);
    if (!note) throw new Error("Credit Note not found");

    note.status = "inactive";
    note.updated_at = new Date();
    note.deleted_at = new Date();

    await note.save({ transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Credit Note marked as inactive",
      data: note
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

const PORT = 3032;
app.listen(PORT,"0.0.0.0", () => {
  console.log(`credit note API running on port ${PORT}`);
});
