import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import QRCode from "qrcode";
import ExcelJS from "exceljs";
import { Readable } from "stream";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());



// Create a public directory for storing QR code images if needed
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const qrCodeDir = path.join(__dirname, "../../public/qrcodes");

// Ensure the directory exists
if (!fs.existsSync(qrCodeDir)) {
  fs.mkdirSync(qrCodeDir, { recursive: true });
}

// Serve the QR code images statically
app.use("/qrcodes", express.static(qrCodeDir));

const v1Router = Router();

const SalesOrder = db.SalesOrder;
const WorkOrder = db.WorkOrder;
const SalesSkuDetails = db.SalesSkuDetails;
const User = db.User;

async function generateQRCode(workOrder) {
  try {
    // Create a nicely formatted plain text representation of the work order
    const textContent = `
Work Order: ${workOrder.work_generate_id}
SKU: ${workOrder.sku_name || "N/A"}
Quantity: ${workOrder.qty || "N/A"}
Manufacture: ${workOrder.manufacture || "N/A"}
Status: ${workOrder.status || "N/A"}
${workOrder.description ? `Description: ${workOrder.description}` : ""}
${
  workOrder.edd
    ? `Expected Delivery: ${new Date(workOrder.edd).toLocaleDateString()}`
    : ""
}
`.trim();

    // Generate a unique filename
    const qrFileName = `wo_${workOrder.work_generate_id.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_${Date.now()}.png`;
    const qrFilePath = path.join(qrCodeDir, qrFileName);

    // Generate QR code with the plain text
    await QRCode.toFile(qrFilePath, textContent, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 300,
    });

    // Return the URL to access the QR code
    const baseUrl = `http://localhost:${process.env.PORT || 3006}`;
    return `${baseUrl}/qrcodes/${qrFileName}`;
  } catch (error) {
    logger.error("Error generating QR code:", error);
    throw error;
  }
}


// POST create new sales order - with SalesSkuDetails table
// POST create new sales order - with SalesSkuDetails table
v1Router.post("/sale-order", authenticateJWT, async (req, res) => {
  const { salesDetails, skuDetails, workDetails } = req.body;

  if (
    !salesDetails ||
    !skuDetails ||
    !Array.isArray(skuDetails) ||
    !workDetails ||
    !Array.isArray(workDetails)
  ) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  const transaction = await sequelize.transaction();

  try {
    const sales_generate_id = await generateId(
      req.user.company_id,
      SalesOrder,
      "sale"
    );
    // Create Sales Order - get company_id and user info from JWT token
    const newSalesOrder = await SalesOrder.create(
      {
        sales_generate_id: sales_generate_id,
        company_id: req.user.company_id,
        sales_ui_id: salesDetails.sales_ui_id || null,
        client_id: salesDetails.client_id,
        estimated: salesDetails.estimated,
        client: salesDetails.client,
        credit_period: salesDetails.credit_period,
        freight_paid: salesDetails.freight_paid,
        confirmation: salesDetails.confirmation,
        confirmation_email: salesDetails.confirmation_email || null,
        confirmation_name: salesDetails.confirmation_name || null,
        confirmation_mobile: salesDetails.confirmation_mobile || null,
        sales_status: salesDetails.sales_status,
        total_amount: salesDetails.total_amount,
        sgst: salesDetails.sgst,
        cgst: salesDetails.cgst,
        igst: salesDetails.igst || null,
        total_incl_gst: salesDetails.total_incl_gst,
        created_by: req.user.id,
        updated_by: req.user.id,
        status: "active", // Set default status to active
      },
      { transaction }
    );

    // Create Sales SKU Details
    const skuRecords = skuDetails.map((sku) => ({
      company_id: req.user.company_id,
      client_id: salesDetails.client_id,
      sales_order_id: newSalesOrder.id,
      sku: sku.sku,
      quantity_required: sku.quantity_required,
      rate_per_sku: sku.rate_per_sku,
      acceptable_sku_units: sku.acceptable_sku_units,
      total_amount: sku.total_amount,
      sgst: sku.sgst,
      sgst_amount: sku.sgst_amount,
      cgst: sku.cgst,
      igst: sku.igst || null,
      cgst_amount: sku.cgst_amount,
      total_incl__gst: sku.total_incl__gst,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "active",
    }));

    const createdSkuDetails = await SalesSkuDetails.bulkCreate(skuRecords, {
      transaction,
    });

    // Prepare work orders with work_generate_id
    const workOrdersWithIds = await Promise.all(
      workDetails.map(async (work) => {
        const work_generate_id = await generateId(req.user.company_id, WorkOrder, "work");
        return {
          work_generate_id: work_generate_id,
          company_id: req.user.company_id, // Get from token
          client_id: work.client_id,
          sales_order_id: newSalesOrder.id,
          manufacture: work.manufacture,
          sku_id: work.sku_id || null,
          sku_name: work.sku_name || null,
          sku_version: work.sku_version || null,
          qty: work.qty || null,
          edd: work.edd || null,
          description: work.description || null,
          acceptable_excess_units: work.acceptable_excess_units || null,
          planned_start_date: work.planned_start_date || null,
          planned_end_date: work.planned_end_date || null,
          outsource_name: work.outsource_name || null,
          priority: work.priority || null,
          progress: work.progress || null,
          created_by: req.user.id,
          updated_by: req.user.id,
          status: "active",
          work_order_sku_values: work.work_order_sku_values || null,
        };
      })
    );

    // Create work orders
    const createdWorkOrders = await WorkOrder.bulkCreate(workOrdersWithIds, {
      transaction,
    });

    // Generate QR codes and update each work order
    for (const workOrder of createdWorkOrders) {
      try {
        const qrCodeUrl = await generateQRCode(workOrder);
        await workOrder.update({ qr_code_url: qrCodeUrl }, { transaction });
      } catch (error) {
        logger.error(`Error generating QR code for work order ${workOrder.id}:`, error);
        // Continue with the next work order even if this one fails
      }
    }

    // Commit transaction
    await transaction.commit();

    // Reload work orders to get updated data including QR code URLs
    const updatedWorkOrders = await WorkOrder.findAll({
      where: { sales_order_id: newSalesOrder.id },
      transaction: null // No longer in transaction after commit
    });

    // Get the complete data with workOrders and skuDetails
    const completeData = {
      ...newSalesOrder.get({ plain: true }),
      skuDetails: createdSkuDetails.map((sku) => sku.get({ plain: true })),
      workOrders: updatedWorkOrders.map((work) => work.get({ plain: true })),
    };

    res.status(201).json({
      message: "Sales Order created successfully",
      data: completeData,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error creating sales order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

v1Router.get("/sale-order", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      client,
      sku,
      manufacture,
      confirmation,
      sales_status,
      status = "active",
    } = req.query;
    const offset = (page - 1) * limit;

    // Build base filter conditions for SalesOrder
    const where = {
      status: status,
      company_id: req.user.company_id, // Filter by the company ID from JWT token
    };

    // Add client search if provided
    if (client) where.client = { [Op.like]: `%${client}%` };

    // Add confirmation filter if provided
    if (confirmation !== undefined) where.confirmation = confirmation;

    // Add sales_status filter if provided
    if (sales_status) where.sales_status = sales_status;

    // Include conditions for related models
    const includeConditions = [
      {
        model: WorkOrder,
        as: "workOrders",
        where: { status: "active" }, // Only include active work orders
        required: false, // Don't require work orders by default (LEFT JOIN)
        separate: true, // Use separate query to ensure work orders are properly fetched
      },
      {
        model: SalesSkuDetails,
        where: { status: "active" }, // Only include active SKU details
        required: false, // Don't require SKU details by default (LEFT JOIN)
        separate: true, // Use separate query to ensure SKU details are properly fetched
      },
      {
        model: User,
        as: "creator_sales",
        attributes: ["id", "name", "email"],
      },
      {
        model: User,
        as: "updater_sales",
        attributes: ["id", "name", "email"],
      },
    ];

    // Add SKU search if provided
    if (sku) {
      includeConditions[1].where = {
        ...includeConditions[1].where,
        sku: { [Op.like]: `%${sku}%` },
      };
      includeConditions[1].required = true; // Make this association required when filtering
    }

    // Add manufacture search if provided
    if (manufacture) {
      includeConditions[0].where = {
        ...includeConditions[0].where,
        manufacture: { [Op.like]: `%${manufacture}%` },
      };
      includeConditions[0].required = true; // Make this association required when filtering
    }

    // Fetch data from database with all filters applied
    const { count, rows } = await SalesOrder.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: includeConditions,
      order: [["created_at", "DESC"]],
      distinct: true,
    });

    // Transform data
    const result = {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      data: rows.map((order) => order.get({ plain: true })),
    };

    // Log for debugging - check if work orders are present
    if (rows.length > 0) {
      logger.info(`First sales order ID: ${rows[0].id}`);
      logger.info(
        `Work orders count: ${
          rows[0].workOrders ? rows[0].workOrders.length : 0
        }`
      );
    }

    res.json(result);
  } catch (error) {
    logger.error("Error fetching sales orders:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});



v1Router.get("/sale-order/download/excel", authenticateJWT, async (req, res) => {
  try {
    const {
      client,
      sku,
      manufacture,
      confirmation,
      sales_status,
      status = "active",
    } = req.query;

    // Build base filter conditions for SalesOrder
    const where = {
      status: status,
      company_id: req.user.company_id, // Filter by the company ID from JWT token
    };

    // Add client search if provided
    if (client) where.client = { [Op.like]: `%${client}%` };

    // Add confirmation filter if provided
    if (confirmation !== undefined) where.confirmation = confirmation;

    // Add sales_status filter if provided
    if (sales_status) where.sales_status = sales_status;

    // Include conditions for related models
    const includeConditions = [
      {
        model: WorkOrder,
        as: "workOrders",
        where: { status: "active" }, // Only include active work orders
        required: false, // Don't require work orders by default (LEFT JOIN)
        separate: true, // Use separate query to ensure work orders are properly fetched
      },
      {
        model: SalesSkuDetails,
        where: { status: "active" }, // Only include active SKU details
        required: false, // Don't require SKU details by default (LEFT JOIN)
        separate: true, // Use separate query to ensure SKU details are properly fetched
      },
      {
        model: User,
        as: "creator_sales",
        attributes: ["id", "name", "email"],
      },
      {
        model: User,
        as: "updater_sales",
        attributes: ["id", "name", "email"],
      },
    ];

    // Add SKU search if provided
    if (sku) {
      includeConditions[1].where = {
        ...includeConditions[1].where,
        sku: { [Op.like]: `%${sku}%` },
      };
      includeConditions[1].required = true; // Make this association required when filtering
    }

    // Add manufacture search if provided
    if (manufacture) {
      includeConditions[0].where = {
        ...includeConditions[0].where,
        manufacture: { [Op.like]: `%${manufacture}%` },
      };
      includeConditions[0].required = true; // Make this association required when filtering
    }

    // Fetch all sales orders with filters (without pagination)
    const { rows: salesOrders } = await SalesOrder.findAndCountAll({
      where,
      include: includeConditions,
      order: [["created_at", "DESC"]],
      distinct: true,
    });

    // Create a new Excel workbook
    const workbook = new ExcelJS.Workbook();
    const salesOrderSheet = workbook.addWorksheet("Sales Orders");
    const workOrderSheet = workbook.addWorksheet("Work Orders");
    const skuDetailsSheet = workbook.addWorksheet("SKU Details");

    // Set up sales order sheet headers
    salesOrderSheet.columns = [
      { header: "Sale Order ID", key: "id", width: 15 },
      { header: "Company ID", key: "company_id", width: 10 },
      { header: "Client", key: "client", width: 30 },
      { header: "SO Number", key: "so_number", width: 15 },
      { header: "PO Number", key: "po_number", width: 15 },
      { header: "Delivery Date", key: "delivery_date", width: 20 },
      { header: "Confirmation", key: "confirmation", width: 15 },
      { header: "Sales Status", key: "sales_status", width: 15 },
      { header: "Total Amount", key: "total_amount", width: 15 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Notes", key: "notes", width: 30 },
      { header: "Status", key: "status", width: 10 },
      { header: "Created By", key: "created_by_name", width: 20 },
      { header: "Created At", key: "created_at", width: 20 },
      { header: "Updated By", key: "updated_by_name", width: 20 },
      { header: "Updated At", key: "updated_at", width: 20 },
    ];

    // Set up work order sheet headers
    workOrderSheet.columns = [
      { header: "Work Order ID", key: "id", width: 15 },
      { header: "Sales Order ID", key: "sales_order_id", width: 15 },
      { header: "Manufacture", key: "manufacture", width: 30 },
      { header: "WO Number", key: "wo_number", width: 15 },
      { header: "Product Name", key: "product_name", width: 30 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Status", key: "status", width: 10 },
      { header: "Created At", key: "created_at", width: 20 },
      { header: "Updated At", key: "updated_at", width: 20 },
    ];

    // Set up SKU details sheet headers
    skuDetailsSheet.columns = [
      { header: "SKU Detail ID", key: "id", width: 15 },
      { header: "Sales Order ID", key: "sales_order_id", width: 15 },
      { header: "SKU", key: "sku", width: 20 },
      { header: "Description", key: "description", width: 30 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Unit Price", key: "unit_price", width: 15 },
      { header: "Total Price", key: "total_price", width: 15 },
      { header: "Status", key: "status", width: 10 },
      { header: "Created At", key: "created_at", width: 20 },
      { header: "Updated At", key: "updated_at", width: 20 },
    ];

    // Add styles to header rows
    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } },
    };

    salesOrderSheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    workOrderSheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    skuDetailsSheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Add data to sales order sheet and related sheets
    salesOrders.forEach((order) => {
      // Add sales order data
      salesOrderSheet.addRow({
        id: order.id,
        company_id: order.company_id,
        client: order.client,
        so_number: order.so_number,
        po_number: order.po_number,
        delivery_date: order.delivery_date 
          ? new Date(order.delivery_date).toLocaleDateString() 
          : "N/A",
        confirmation: order.confirmation ? "Yes" : "No",
        sales_status: order.sales_status,
        total_amount: order.total_amount,
        currency: order.currency,
        notes: order.notes,
        status: order.status,
        created_by_name: order.creator_sales ? order.creator_sales.name : "N/A",
        created_at: order.created_at
          ? new Date(order.created_at).toLocaleString()
          : "N/A",
        updated_by_name: order.updater_sales ? order.updater_sales.name : "N/A",
        updated_at: order.updated_at
          ? new Date(order.updated_at).toLocaleString()
          : "N/A",
      });

      // Add work orders data if available
      if (order.workOrders && order.workOrders.length > 0) {
        order.workOrders.forEach((workOrder) => {
          workOrderSheet.addRow({
            id: workOrder.id,
            sales_order_id: order.id,
            manufacture: workOrder.manufacture,
            wo_number: workOrder.wo_number,
            product_name: workOrder.product_name,
            quantity: workOrder.quantity,
            status: workOrder.status,
            created_at: workOrder.created_at
              ? new Date(workOrder.created_at).toLocaleString()
              : "N/A",
            updated_at: workOrder.updated_at
              ? new Date(workOrder.updated_at).toLocaleString()
              : "N/A",
          });
        });
      }

      // Add SKU details data if available
      if (order.SalesSkuDetails && order.SalesSkuDetails.length > 0) {
        order.SalesSkuDetails.forEach((skuDetail) => {
          skuDetailsSheet.addRow({
            id: skuDetail.id,
            sales_order_id: order.id,
            sku: skuDetail.sku,
            description: skuDetail.description,
            quantity: skuDetail.quantity,
            unit_price: skuDetail.unit_price,
            total_price: skuDetail.total_price,
            status: skuDetail.status,
            created_at: skuDetail.created_at
              ? new Date(skuDetail.created_at).toLocaleString()
              : "N/A",
            updated_at: skuDetail.updated_at
              ? new Date(skuDetail.updated_at).toLocaleString()
              : "N/A",
          });
        });
      }
    });

    // Apply alternating row colors for better readability
    salesOrderSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const fillColor = rowNumber % 2 === 0 ? "F2F2F2" : "FFFFFF";
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fillColor },
          };
        });
      }
    });

    workOrderSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const fillColor = rowNumber % 2 === 0 ? "F2F2F2" : "FFFFFF";
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fillColor },
          };
        });
      }
    });

    skuDetailsSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const fillColor = rowNumber % 2 === 0 ? "F2F2F2" : "FFFFFF";
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fillColor },
          };
        });
      }
    });

    // Create a readable stream for the workbook
    const buffer = await workbook.xlsx.writeBuffer();
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Set response headers for file download
    const clientSuffix = client ? `-${client}` : "";
    const skuSuffix = sku ? `-${sku}` : "";
    const manufactureSuffix = manufacture ? `-${manufacture}` : "";
    const statusSuffix = sales_status ? `-${sales_status}` : "";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    const filename = `sales-orders${clientSuffix}${skuSuffix}${manufactureSuffix}${statusSuffix}-${timestamp}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    // Pipe the stream to response
    stream.pipe(res);

    // Log the download
    logger.info(
      `Sales Orders Excel download initiated by user ${
        req.user.id
      } with filters: ${JSON.stringify({
        client,
        sku,
        manufacture,
        confirmation,
        sales_status,
        status,
      })}`
    );
  } catch (error) {
    logger.error("Excel Download Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});
// GET single sales order by ID (including associated records)

v1Router.get("/sale-order/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch from database
    const salesOrder = await SalesOrder.findByPk(id, {
      include: [
        {
          model: WorkOrder,
          as: "workOrders",
          where: { status: "active" },
          required: false,
        },
        {
          model: SalesSkuDetails,
          where: { status: "active" },
          required: false,
        },
        {
          model: User,
          as: "creator_sales",
          attributes: ["id", "name", "email"],
          foreignKey: "created_by",
        },
        {
          model: User,
          as: "updater_sales",
          attributes: ["id", "name", "email"],
          foreignKey: "updated_by",
        },
      ],
    });

    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    // Verify user has access to this sales order (from the same company)
    if (salesOrder.company_id !== req.user.company_id) {
      return res
        .status(403)
        .json({ message: "Access denied to this sales order" });
    }

    // Transform data
    const result = salesOrder.get({ plain: true });

    res.json(result);
  } catch (error) {
    logger.error("Error fetching sales order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// PUT update existing sales order - modified to update existing records

v1Router.put("/sale-order/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { salesDetails, skuDetails, workDetails } = req.body;

  if (
    !salesDetails ||
    !skuDetails ||
    !Array.isArray(skuDetails) ||
    !workDetails ||
    !Array.isArray(workDetails)
  ) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  const transaction = await sequelize.transaction();

  try {
    // Find the sales order
    const salesOrder = await SalesOrder.findByPk(id, { transaction });

    if (!salesOrder) {
      await transaction.rollback();
      return res.status(404).json({ message: "Sales order not found" });
    }

    // Verify user has access to this sales order (from the same company)
    if (salesOrder.company_id !== req.user.company_id) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ message: "Access denied to this sales order" });
    }

    // Update Sales Order
    await salesOrder.update(
      {
        client_id: salesDetails.client_id,
        sales_ui_id: salesDetails.sales_ui_id || null, // Update if provided
        estimated: salesDetails.estimated,
        client: salesDetails.client,
        credit_period: salesDetails.credit_period,
        freight_paid: salesDetails.freight_paid,
        confirmation: salesDetails.confirmation,
        confirmation_email: salesDetails.confirmation_email || null,
        confirmation_name: salesDetails.confirmation_name || null,
        confirmation_mobile: salesDetails.confirmation_mobile || null,
        sales_status: salesDetails.sales_status,
        total_amount: salesDetails.total_amount,
        sgst: salesDetails.sgst,
        cgst: salesDetails.cgst,
        igst: salesDetails.igst || null,
        total_incl_gst: salesDetails.total_incl_gst,
        status: salesDetails.status || salesOrder.status, // Keep existing status if not provided
        updated_by: req.user.id, // Update with current user ID from token
        updated_at: new Date(), // Update the timestamp
      },
      { transaction }
    );

    // Get existing SKU details for this sales order
    const existingSkuDetails = await SalesSkuDetails.findAll({
      where: {
        sales_order_id: id,
        status: "active",
      },
      transaction,
    });

    // Create a map of existing SKU details by ID or some unique identifier
    // You need to ensure skuDetails from the request include IDs of existing records
    const existingSkuMap = new Map();
    existingSkuDetails.forEach((sku) => {
      existingSkuMap.set(sku.id, sku);
    });

    // Process each SKU detail - update existing or create new
    for (const sku of skuDetails) {
      if (sku.id && existingSkuMap.has(sku.id)) {
        // Update existing SKU detail
        const existingSku = existingSkuMap.get(sku.id);
        await existingSku.update(
          {
            company_id: req.user.company_id,
            client_id: salesDetails.client_id,
            sku: sku.sku,
            quantity_required: sku.quantity_required,
            rate_per_sku: sku.rate_per_sku,
            acceptable_sku_units: sku.acceptable_sku_units,
            total_amount: sku.total_amount,
            sgst: sku.sgst,
            sgst_amount: sku.sgst_amount,
            cgst: sku.cgst,
            igst: sku.igst || null,
            cgst_amount: sku.cgst_amount,
            total_incl__gst: sku.total_incl__gst,
            updated_by: req.user.id,
            updated_at: new Date(),
          },
          { transaction }
        );

        // Remove from map to track what's been processed
        existingSkuMap.delete(sku.id);
      } else {
        // Create new SKU detail
        await SalesSkuDetails.create(
          {
            company_id: req.user.company_id,
            client_id: salesDetails.client_id,
            sales_order_id: id,
            sku: sku.sku,
            quantity_required: sku.quantity_required,
            rate_per_sku: sku.rate_per_sku,
            acceptable_sku_units: sku.acceptable_sku_units,
            total_amount: sku.total_amount,
            sgst: sku.sgst,
            sgst_amount: sku.sgst_amount,
            cgst: sku.cgst,
            igst: sku.igst || null,
            cgst_amount: sku.cgst_amount,
            total_incl__gst: sku.total_incl__gst,
            created_by: req.user.id,
            updated_by: req.user.id,
            status: "active",
          },
          { transaction }
        );
      }
    }

    // Set remaining unprocessed SKUs to inactive (they were removed in the update)
    for (const [id, sku] of existingSkuMap.entries()) {
      await sku.update(
        {
          status: "inactive",
          updated_by: req.user.id,
          updated_at: new Date(),
        },
        { transaction }
      );
    }

    // Do the same for work orders
    const existingWorkOrders = await WorkOrder.findAll({
      where: {
        sales_order_id: id,
        status: "active",
      },
      transaction,
    });

    const existingWorkMap = new Map();
    existingWorkOrders.forEach((work) => {
      existingWorkMap.set(work.id, work);
    });

    // Array to track all updated and new work orders
    const updatedAndNewWorkOrders = [];

    for (const work of workDetails) {
      if (work.id && existingWorkMap.has(work.id)) {
        // Update existing work order
        const existingWork = existingWorkMap.get(work.id);
        await existingWork.update(
          {
            company_id: req.user.company_id,
            client_id: work.client_id,
            manufacture: work.manufacture,
            sku_id: work.sku_id || null,
            sku_name: work.sku_name || null,
            sku_version: work.sku_version || null,
            qty: work.qty || null,
            edd: work.edd || null,
            description: work.description || null,
            acceptable_excess_units: work.acceptable_excess_units || null,
            planned_start_date: work.planned_start_date || null,
            planned_end_date: work.planned_end_date || null,
            outsource_name:
              work.manufacture === "outsource" ? work.outsource_name : null,
            priority: work.priority || null,
            progress: work.progress || null,
            updated_by: req.user.id,
            updated_at: new Date(),
            work_order_sku_values: work.work_order_sku_values || null,
          },
          { transaction }
        );

        updatedAndNewWorkOrders.push(existingWork);
        existingWorkMap.delete(work.id);
      } else {
        // Create new work order with a generated ID
        const work_generate_id = await generateId(req.user.company_id, WorkOrder, "work");
        
        const newWorkOrder = await WorkOrder.create(
          {
            work_generate_id: work_generate_id,
            sales_order_id: id,
            company_id: req.user.company_id,
            client_id: work.client_id,
            manufacture: work.manufacture,
            sku_id: work.sku_id || null,
            sku_name: work.sku_name || null,
            sku_version: work.sku_version || null,
            qty: work.qty || null,
            edd: work.edd || null,
            description: work.description || null,
            acceptable_excess_units: work.acceptable_excess_units || null,
            planned_start_date: work.planned_start_date || null,
            planned_end_date: work.planned_end_date || null,
            outsource_name:
              work.manufacture === "outsource" ? work.outsource_name : null,
            priority: work.priority || null,
            progress: work.progress || null,
            created_by: req.user.id,
            updated_by: req.user.id,
            status: "active",
            work_order_sku_values: work.work_order_sku_values || null,
          },
          { transaction }
        );
        
        updatedAndNewWorkOrders.push(newWorkOrder);
      }
    }

    // Set remaining unprocessed work orders to inactive
    for (const [id, work] of existingWorkMap.entries()) {
      await work.update(
        {
          status: "inactive",
          updated_by: req.user.id,
          updated_at: new Date(),
        },
        { transaction }
      );
    }
    
    // Generate or update QR codes for all updated and new work orders
    for (const workOrder of updatedAndNewWorkOrders) {
      try {
        // Skip if the work order already has a QR code URL and its data hasn't changed
        if (workOrder.qr_code_url && !workOrder.changed('sku_name') && !workOrder.changed('qty') && 
            !workOrder.changed('manufacture') && !workOrder.changed('status') && 
            !workOrder.changed('description') && !workOrder.changed('edd')) {
          continue;
        }
        
        // Generate a new QR code
        const qrCodeUrl = await generateQRCode(workOrder);
        
        // Update the work order with the QR code URL
        await workOrder.update({ qr_code_url: qrCodeUrl }, { transaction });
      } catch (error) {
        logger.error(`Error generating QR code for work order ${workOrder.id}:`, error);
        // Continue with other work orders even if this one fails
      }
    }

    // Commit transaction
    await transaction.commit();

    // Fetch the updated complete data
    const updatedSalesOrder = await SalesOrder.findByPk(id, {
      include: [
        {
          model: WorkOrder,
          as: "workOrders",
          where: { status: "active" },
          required: false,
        },
        {
          model: SalesSkuDetails,
          where: { status: "active" },
          required: false,
        },
      ],
    });

    res.json({
      message: "Sales Order updated successfully",
      data: updatedSalesOrder.get({ plain: true }),
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error updating sales order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});
// DELETE sales order - changed to soft delete including associated records

v1Router.delete("/sale-order/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const transaction = await sequelize.transaction();

  try {
    // Find the sales order
    const salesOrder = await SalesOrder.findByPk(id, {
      include: [
        { model: WorkOrder, as: "workOrders" },
        { model: SalesSkuDetails },
      ],
      transaction,
    });

    if (!salesOrder) {
      await transaction.rollback();
      return res.status(404).json({ message: "Sales order not found" });
    }

    // Verify user has access to this sales order (from the same company)
    if (salesOrder.company_id !== req.user.company_id) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ message: "Access denied to this sales order" });
    }

    // Store data for notification
    const salesOrderData = salesOrder.get({ plain: true });

    // Update WorkOrder status to 'inactive' for related work orders
    if (salesOrder.workOrders && salesOrder.workOrders.length > 0) {
      await WorkOrder.update(
        {
          status: "inactive",
          updated_by: req.user.id,
          updated_at: new Date(),
        },
        { where: { sales_order_id: id }, transaction }
      );
    }

    // Update SalesSkuDetails status to 'inactive'
    await SalesSkuDetails.update(
      {
        status: "inactive",
        updated_by: req.user.id,
        updated_at: new Date(),
      },
      { where: { sales_order_id: id }, transaction }
    );

    // Soft delete - Update sales order status to 'inactive'
    await salesOrder.update(
      {
        status: "inactive",
        updated_by: req.user.id, // Get from token
        updated_at: new Date(),
      },
      { transaction }
    );

    // Commit transaction
    await transaction.commit();

    res.json({
      message: "Sales Order and associated records set to inactive",
      data: {
        ...salesOrderData,
        status: "inactive",
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error soft-deleting sales order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// Add this new route to the v1Router section in your file

// PATCH update sales_status only
v1Router.patch("/sale-order/:id/status", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { sales_status } = req.body;

  // Validate input
  if (!sales_status) {
    return res.status(400).json({
      message: "sales_status is required",
    });
  }

  // Check if status is valid
  const validStatuses = ["Pending", "In-progress", "Completed", "Rejected"];
  if (!validStatuses.includes(sales_status)) {
    return res.status(400).json({
      message:
        "Invalid sales_status. Must be one of: Pending, In-progress, Completed, Rejected",
    });
  }

  try {
    // Find the sales order
    const salesOrder = await SalesOrder.findByPk(id);

    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    // Verify user has access to this sales order (from the same company)
    if (salesOrder.company_id !== req.user.company_id) {
      return res
        .status(403)
        .json({ message: "Access denied to this sales order" });
    }

    // Update only the sales_status and updated_by fields
    await salesOrder.update({
      sales_status: sales_status,
      updated_by: req.user.id,
      updated_at: new Date(),
    });

    res.json({
      message: "Sales status updated successfully",
      data: {
        id: salesOrder.id,
        sales_status: sales_status,
        updated_at: salesOrder.updated_at,
      },
    });
  } catch (error) {
    logger.error("Error updating sales status:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
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
app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3005;
app.listen(process.env.PORT_SALESORDER,'0.0.0.0', () => {
  console.log(`Sales order Service running on port ${process.env.PORT_SALESORDER}`);
});
