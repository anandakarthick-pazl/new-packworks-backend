import { Op } from "sequelize";
import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const WorkOrderInvoice = db.WorkOrderInvoice;
const WorkOrder = db.WorkOrder;
const SalesOrder = db.SalesOrder;

// POST create new work order invoice
v1Router.post("/create", authenticateJWT, async (req, res) => {
  const invoiceDetails = req.body;

  if (!invoiceDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  try {
    const invoice_number = await generateId(
      req.user.company_id,
      WorkOrderInvoice,
      "work_invoice"
    );

    // Create Work Order Invoice
    const newInvoice = await WorkOrderInvoice.create({
      invoice_number: invoice_number,
      company_id: req.user.company_id,
      client_id: invoiceDetails.client_id,
      sku_id: invoiceDetails.sku_id || null,
      status: invoiceDetails.status || "active",
      sale_id: invoiceDetails.sale_id || null,
      work_id: invoiceDetails.work_id || null,
      due_date: invoiceDetails.due_date || null,
      total: invoiceDetails.total || 0.0,
      balance: invoiceDetails.balance || 0.0,
      payment_expected_date: invoiceDetails.payment_expected_date || null,
      transaction_type: invoiceDetails.transaction_type || null,
      discount_type: invoiceDetails.discount_type || null,
      discount: invoiceDetails.discount || 0.0,
      total_tax: invoiceDetails.total_tax || 0.0,
      total_amount: invoiceDetails.total_amount || 0.0,
      payment_status: invoiceDetails.payment_status || null,
      created_by: req.user.id,
      updated_by: req.user.id,
    });

    res.status(201).json({
      message: "Work Order Invoice created successfully",
      data: newInvoice.get({ plain: true }),
    });
  } catch (error) {
    logger.error("Error creating work order invoice:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET all work order invoices with pagination, filtering, and search
v1Router.get("/get", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      work_id,
      sale_id,
      payment_status,
      status = "active", // Default to 'active' status
      search = "", // Add search parameter
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const whereClause = {
      company_id: req.user.company_id, // Add company filter for security
    };

    // Status filtering - default to active, but allow override
    if (status === "all") {
      // Don't filter by status if 'all' is specified
    } else {
      whereClause.status = status;
    }

    if (work_id) {
      whereClause.work_id = work_id;
    }
    if (sale_id) {
      whereClause.sale_id = sale_id;
    }
    if (payment_status) {
      whereClause.payment_status = payment_status;
    }

    // Add search functionality if search parameter is provided
    if (search && search.trim() !== "") {
      const searchTerm = `%${search.trim()}%`; // Add wildcards for partial matching

      // Define search condition to look across multiple fields
      const searchCondition = {
        [Op.or]: [
          // Search in WorkOrderInvoice fields
          { invoice_number: { [Op.like]: searchTerm } },
          //   { description: { [Op.like]: searchTerm } },
          { due_date: { [Op.like]: searchTerm } },

          // Search in related WorkOrder fields using Sequelize's nested include where
          { "$workOrder.work_generate_id$": { [Op.like]: searchTerm } },
          { "$workOrder.sku_name$": { [Op.like]: searchTerm } },

          // Search in related SalesOrder fields
          { "$salesOrder.sales_generate_id$": { [Op.like]: searchTerm } },
        ],
      };

      // Add search condition to where clause
      whereClause[Op.and] = whereClause[Op.and] || [];
      whereClause[Op.and].push(searchCondition);
    }

    // Fetch from database with pagination, filters, and search
    const { count, rows } = await WorkOrderInvoice.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset: offset,
      order: [["updated_at", "DESC"]],
      include: [
        {
          model: WorkOrder,
          as: "workOrder",
          attributes: ["id", "work_generate_id", "sku_name", "qty", "status"],
        },
        {
          model: SalesOrder,
          as: "salesOrder",
          attributes: ["id", "sales_generate_id", "status"],
        },
      ],
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / limitNum);

    res.json({
      invoices: rows.map((invoice) => invoice.get({ plain: true })),
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (error) {
    logger.error("Error fetching work order invoices:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});
// GET specific work order invoice by ID
v1Router.get("/get/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { status = "active" } = req.query;

    const whereClause = {
      id: id,
      company_id: req.user.company_id,
    };

    if (status !== "all") {
      whereClause.status = status;
    }

    const invoice = await WorkOrderInvoice.findOne({
      where: whereClause,
      include: [
        {
          model: WorkOrder,
          as: "workOrder",
          attributes: ["id", "work_generate_id", "sku_name", "qty", "status"],
        },
        {
          model: SalesOrder,
          as: "salesOrder",
          attributes: ["id", "sales_generate_id", "status"],
        },
      ],
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const result = invoice.get({ plain: true });

    res.json(result);
  } catch (error) {
    logger.error("Error fetching work order invoice:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
  });
});

// Use Version 1 Router
app.use("/api/work-order-invoice", v1Router);
await db.sequelize.sync();
const PORT = 3030;
app.listen(process.env.PORT_WORK_INVOICE, '0.0.0.0', () => {
  console.log(`Work-Invoice Service running on port ${PORT}`);
});
