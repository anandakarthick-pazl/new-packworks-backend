import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import "../../common/models/association.js";
import { generateId } from "../../common/inputvalidation/generateId.js";

const Company = db.Company;
const User = db.User;
const CreditNote = db.CreditNote;
const Client = db.Client;
const WorkOrderInvoice = db.WorkOrderInvoice;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();

// CREATE Credit Note
v1Router.post("/create", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      client_id,
      client_name,
      work_order_invoice_id,
      work_order_invoice_number,
      credit_reference_id,
      subject,
      invoice_total_amout,
      credit_total_amount
    } = req.body;

    const user = req.user;

    // ✅ Validate required fields
    if (!client_id) throw new Error("Client ID is required");
    if (!work_order_invoice_id) throw new Error("Work Order Invoice ID is required");
    if (!subject) throw new Error("Subject is required");

    // ✅ Validate client exists and belongs to company
    const client = await Client.findOne({
      where: { 
        client_id: client_id,
        company_id: user.company_id 
      }
    });
    if (!client) throw new Error("Client not found or access denied");

    // ✅ Validate work order invoice exists
    const workOrderInvoice = await WorkOrderInvoice.findByPk(work_order_invoice_id);
    if (!workOrderInvoice) throw new Error("Work Order Invoice not found");

    // ✅ Generate unique credit_generate_id
    const credit_generate_id = await generateId(user.company_id, CreditNote, "credit_note");

    // ✅ Create the credit note
    const creditNote = await CreditNote.create({
      company_id: user.company_id,
      client_id,
      client_name: client_name || client.name,
      work_order_invoice_id,
      work_order_invoice_number,
      credit_generate_id,
      credit_reference_id,
      subject,
      invoice_total_amout,
      credit_total_amount,
      status: "active",
      created_by: user.id,
      updated_by: user.id,
      created_at: new Date()
    }, { transaction });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Credit Note created successfully",
      data: creditNote
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Credit Note Creation Error:", error);
    return res.status(500).json({
      success: false,
      message: `Creation failed: ${error.message}`,
      errors: error.errors ? error.errors.map(e => e.message) : null
    });
  }
});

// GET All Credit Notes
v1Router.get("/get-all", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, client_id, search } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    let whereClause = { 
      company_id: req.user.company_id 
    };

    if (status) {
      whereClause.status = status;
    }

    if (client_id) {
      whereClause.client_id = client_id;
    }

    if (search) {
      whereClause[Op.or] = [
        { subject: { [Op.like]: `%${search}%` } },
        { credit_generate_id: { [Op.like]: `%${search}%` } },
        { credit_reference_id: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: creditNotes } = await CreditNote.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["client_id", "company_name", "email"]
        },
        {
          model: WorkOrderInvoice,
          as: "workOrderInvoice",
          attributes: ["id", "invoice_number"]
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "name", "email"]
        }
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.status(200).json({
      success: true,
      data: creditNotes,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: count,
        total_pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error("Get Credit Notes Error:", error);
    return res.status(500).json({
      success: false,
      message: `Fetch failed: ${error.message}`,
    });
  }
});

// GET Credit Note by ID
v1Router.get("/get-by-id/:id", authenticateJWT, async (req, res) => {
  try {
    const creditNote = await CreditNote.findOne({
      where: { 
        id: req.params.id,
        company_id: req.user.company_id 
      },
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["client_id", "company_name", "email"]
        },
        {
          model: WorkOrderInvoice,
          as: "workOrderInvoice",
          attributes: ["id", "invoice_number", "total_amount"]
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "name", "email"]
        },
        {
          model: User,
          as: "updater",
          attributes: ["id", "name", "email"]
        }
      ]
    });

    if (!creditNote) {
      throw new Error("Credit Note not found or access denied");
    }

    return res.status(200).json({
      success: true,
      data: creditNote
    });
  } catch (error) {
    console.error("Get Credit Note Error:", error);
    return res.status(404).json({
      success: false,
      message: `Fetch failed: ${error.message}`
    });
  }
});

v1Router.put("/update/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const creditNoteId = req.params.id;
    const user = req.user;

    const {
      client_id,
      client_name,
      work_order_invoice_id,
      work_order_invoice_number,
      credit_reference_id,
      subject,
      invoice_total_amout,
      credit_total_amount,
      status
    } = req.body;

    // Find the credit note
    const creditNote = await CreditNote.findOne({
      where: { 
        id: creditNoteId, 
        company_id: user.company_id 
      },
      transaction // Add transaction to the query
    });

    if (!creditNote) {
      throw new Error("Credit Note not found or access denied");
    }

    // Validate client if client_id is being updated
    if (client_id && client_id !== creditNote.client_id) {
      const client = await Client.findOne({
        where: { 
          client_id: client_id,
          company_id: user.company_id 
        },
        transaction // Add transaction to the query
      });
      if (!client) throw new Error("Client not found or access denied");
    }

    // Validate work order invoice if being updated
    if (work_order_invoice_id && work_order_invoice_id !== creditNote.work_order_invoice_id) {
      const workOrderInvoice = await WorkOrderInvoice.findByPk(work_order_invoice_id, {
        transaction // Add transaction to the query
      });
      if (!workOrderInvoice) throw new Error("Work Order Invoice not found");
    }

    // Update the credit note
    await creditNote.update({
      client_id: client_id || creditNote.client_id,
      client_name: client_name || creditNote.client_name,
      work_order_invoice_id: work_order_invoice_id || creditNote.work_order_invoice_id,
      work_order_invoice_number: work_order_invoice_number || creditNote.work_order_invoice_number,
      credit_reference_id: credit_reference_id || creditNote.credit_reference_id,
      subject: subject || creditNote.subject,
      invoice_total_amout: invoice_total_amout || creditNote.invoice_total_amout,
      credit_total_amount: credit_total_amount || creditNote.credit_total_amount,
      status: status || creditNote.status,
      updated_by: user.id,
      updated_at: new Date()
    }, { transaction });

    // Fetch updated credit note with associations WITHIN the transaction
    const updatedCreditNote = await CreditNote.findOne({
      where: { id: creditNoteId },
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["client_id", "company_name", "email"]
        },
        {
          model: WorkOrderInvoice,
          as: "workOrderInvoice",
          attributes: ["id", "invoice_number"]
        }
      ],
      transaction // Add transaction to the query
    });

    // Commit the transaction
    await transaction.commit();

    // Return the response after successful commit
    return res.status(200).json({
      success: true,
      message: "Credit Note updated successfully",
      data: updatedCreditNote
    });

  } catch (error) {
    // Only rollback if the transaction hasn't been finished
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Update Credit Note Error:", error);
    return res.status(500).json({
      success: false,
      message: `Update failed: ${error.message}`
    });
  }
});

// DELETE Credit Note (Soft Delete)
v1Router.delete("/delete/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const creditNote = await CreditNote.findOne({
      where: { 
        id: req.params.id,
        company_id: req.user.company_id 
      }
    });

    if (!creditNote) {
      throw new Error("Credit Note not found or access denied");
    }

    // Soft delete by updating status
    await creditNote.update({
      status: "inactive",
      updated_by: req.user.id,
      updated_at: new Date()
    }, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Credit Note deleted successfully",
      data: creditNote
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Delete Credit Note Error:", error);
    return res.status(500).json({
      success: false,
      message: `Deletion failed: ${error.message}`
    });
  }
});

// RESTORE Credit Note
v1Router.patch("/:id/restore", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const creditNote = await CreditNote.findOne({
      where: { 
        id: req.params.id,
        company_id: req.user.company_id,
        status: "inactive"
      }
    });

    if (!creditNote) {
      throw new Error("Inactive Credit Note not found or access denied");
    }

    await creditNote.update({
      status: "active",
      updated_by: req.user.id,
      updated_at: new Date()
    }, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Credit Note restored successfully",
      data: creditNote
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Restore Credit Note Error:", error);
    return res.status(500).json({
      success: false,
      message: `Restore failed: ${error.message}`
    });
  }
});

// GET Credit Notes by Client
v1Router.get("/client/:client_id", authenticateJWT, async (req, res) => {
  try {
    const { client_id } = req.params;
    const { status = "active" } = req.query;

    const creditNotes = await CreditNote.findAll({
      where: { 
        client_id,
        company_id: req.user.company_id,
        status
      },
      include: [
        {
          model: WorkOrderInvoice,
          as: "workOrderInvoice",
          attributes: ["id", "invoice_number", "total_amount"]
        }
      ],
      order: [["created_at", "DESC"]]
    });

    return res.status(200).json({
      success: true,
      data: creditNotes,
      count: creditNotes.length
    });
  } catch (error) {
    console.error("Get Client Credit Notes Error:", error);
    return res.status(500).json({
      success: false,
      message: `Fetch failed: ${error.message}`
    });
  }
});

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Credit Note Service is running",
    timestamp: new Date(),
  });
});

// Use Version 1 Router
app.use("/api/debit-note", v1Router);

// Start server
app.listen(process.env.PORT_DEBIT_NOTE, "0.0.0.0", () => {
  console.log(
    `Debit Note Service running on port ${process.env.PORT_DEBIT_NOTE} 🚀`
  );
});