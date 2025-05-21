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

const WorkOrder = db.WorkOrder;

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
${workOrder.edd
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
// Alternative: Generate QR code as data URL (no file storage required)
// async function generateQRCodeDataURL(workOrder) {
//   try {
//     // The data to encode in the QR code
//     const qrData = JSON.stringify({
//       work_id: workOrder.id,
//       work_generate_id: workOrder.work_generate_id,
//       sku_name: workOrder.sku_name,
//       qty: workOrder.qty,
//       manufacture: workOrder.manufacture,
//       status: workOrder.status,
//     });

//     // Generate QR code as data URL
//     const dataURL = await QRCode.toDataURL(qrData, {
//       errorCorrectionLevel: "H",
//       margin: 1,
//       width: 300,
//     });

//     return dataURL;
//   } catch (error) {
//     logger.error("Error generating QR code data URL:", error);
//     throw error;
//   }
// }

// POST create new work order
v1Router.post("/work-order", authenticateJWT, async (req, res) => {
  const workDetails = req.body;

  if (!workDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  try {
    const work_generate_id = await generateId(
      req.user.company_id,
      WorkOrder,
      "work"
    );

    // Create Work Order
    const newWorkOrder = await WorkOrder.create({
      work_generate_id: work_generate_id,
      company_id: req.user.company_id,
      client_id: workDetails.client_id,
      sales_order_id: workDetails.sales_order_id || null,
      manufacture: workDetails.manufacture,
      sku_id: workDetails.sku_id || null,
      sku_name: workDetails.sku_name || null,
      sku_version: workDetails.sku_version || null,
      qty: workDetails.qty || null,
      edd: workDetails.edd || null,
      description: workDetails.description || null,
      acceptable_excess_units: workDetails.acceptable_excess_units || null,
      planned_start_date: workDetails.planned_start_date || null,
      planned_end_date: workDetails.planned_end_date || null,
      outsource_name:
        workDetails.manufacture === "outsource"
          ? workDetails.outsource_name
          : null,
      status: workDetails.status || "active",
      created_by: req.user.id,
      updated_by: req.user.id,
      work_order_sku_values: workDetails.work_order_sku_values || null,
    });

    // Generate QR code for this work order
    // Option 1: Generate and store QR code as a file (with URL to access it)
    const qrCodeUrl = await generateQRCode(newWorkOrder);

    // Option 2: Generate QR code as data URL (no file storage)
    // const qrCodeDataUrl = await generateQRCodeDataURL(newWorkOrder);

    // Update work order with QR code URL
    await newWorkOrder.update({
      qr_code_url: qrCodeUrl,
      // qr_code_data_url: qrCodeDataUrl, // Uncomment if using Option 2
    });

    res.status(201).json({
      message: "Work Order created successfully",
      data: {
        ...newWorkOrder.get({ plain: true }),
        qr_code_url: qrCodeUrl,
        // qr_code_data_url: qrCodeDataUrl, // Uncomment if using Option 2
      },
    });
  } catch (error) {
    logger.error("Error creating work order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

v1Router.get("/work-order", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      manufacture,
      sku_name,
      status = "active", // Default to 'active' status
      updateMissingQrCodes = "true", // New parameter to update missing QR codes
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

    if (manufacture) {
      whereClause.manufacture = manufacture;
    }
    if (sku_name) {
      whereClause.sku_name = { [Op.like]: `%${sku_name}%` };
    }

    // Fetch from database with pagination and filters
    const { count, rows } = await WorkOrder.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset: offset,
      order: [["updated_at", "DESC"]],
    });

    // Process work orders - updating QR codes for those missing them
    const workOrders = await Promise.all(
      rows.map(async (workOrder) => {
        const plainWorkOrder = workOrder.get({ plain: true });

        // If QR code URL is missing and update flag is true, generate and update
        if (updateMissingQrCodes === "true" && !plainWorkOrder.qr_code_url) {
          try {
            const qrCodeUrl = await generateQRCode(workOrder);
            await workOrder.update({ qr_code_url: qrCodeUrl });
            plainWorkOrder.qr_code_url = qrCodeUrl;
          } catch (qrError) {
            logger.error(
              `Error generating QR code for work order ${plainWorkOrder.id}:`,
              qrError
            );
            // Continue with the process even if QR generation fails for this item
          }
        }

        return plainWorkOrder;
      })
    );

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / limitNum);

    res.json({
      workOrders,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (error) {
    logger.error("Error fetching work orders:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

v1Router.get("/work-order/download/excel", authenticateJWT, async (req, res) => {
  try {
    const {
      manufacture,
      sku_name,
      status = "active",
      updateMissingQrCodes = "true",
    } = req.query;

    // Build where clause for filtering
    const whereClause = {
      company_id: req.user.company_id,
    };

    // Status filtering - default to active, but allow 
    if (status === "all") {
      // Don't filter by status if 'all' is specified
    } else {
      whereClause.status = status;
    }

    if (manufacture) {
      whereClause.manufacture = manufacture;
    }
    if (sku_name) {
      whereClause.sku_name = { [Op.like]: `%${sku_name}%` };
    }

    // Fetch all work orders without pagination but with filters
    const { rows: workOrders } = await WorkOrder.findAndCountAll({
      where: whereClause,
      order: [["updated_at", "DESC"]],
    });

    // Process work orders - updating QR codes for those missing them if requested
    const processedWorkOrders = await Promise.all(
      workOrders.map(async (workOrder) => {
        const plainWorkOrder = workOrder.get({ plain: true });

        // If QR code URL is missing and update flag is true, generate and update
        if (updateMissingQrCodes === "true" && !plainWorkOrder.qr_code_url) {
          try {
            const qrCodeUrl = await generateQRCode(workOrder);
            await workOrder.update({ qr_code_url: qrCodeUrl });
            plainWorkOrder.qr_code_url = qrCodeUrl;
          } catch (qrError) {
            logger.error(
              `Error generating QR code for work order ${plainWorkOrder.id}:`,
              qrError
            );
            // Continue with the process even if QR generation fails for this item
          }
        }

        return plainWorkOrder;
      })
    );

    // Create a new Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Work Orders");

    // Set up work order sheet headers
    worksheet.columns = [
      { header: "Work Order ID", key: "id", width: 15 },
      { header: "Company ID", key: "company_id", width: 10 },
      { header: "Sales Order ID", key: "sales_order_id", width: 15 },
      { header: "Manufacture", key: "manufacture", width: 30 },
      { header: "WO Number", key: "wo_number", width: 15 },
      { header: "Product Name", key: "product_name", width: 30 },
      { header: "SKU Name", key: "sku_name", width: 20 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Target Date", key: "target_date", width: 15 },
      { header: "QR Code URL", key: "qr_code_url", width: 40 },
      { header: "Description", key: "description", width: 30 },
      { header: "Notes", key: "notes", width: 30 },
      { header: "Status", key: "status", width: 10 },
      { header: "Created At", key: "created_at", width: 20 },
      { header: "Updated At", key: "updated_at", width: 20 },
    ];

    // Add styles to header row
    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } },
    };

    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Add data to worksheet
    processedWorkOrders.forEach((workOrder) => {
      worksheet.addRow({
        id: workOrder.id,
        company_id: workOrder.company_id,
        sales_order_id: workOrder.sales_order_id || "N/A",
        manufacture: workOrder.manufacture,
        wo_number: workOrder.wo_number,
        product_name: workOrder.product_name,
        sku_name: workOrder.sku_name,
        quantity: workOrder.quantity,
        target_date: workOrder.target_date
          ? new Date(workOrder.target_date).toLocaleDateString()
          : "N/A",
        qr_code_url: workOrder.qr_code_url || "Not Generated",
        description: workOrder.description,
        notes: workOrder.notes,
        status: workOrder.status,
        created_at: workOrder.created_at
          ? new Date(workOrder.created_at).toLocaleString()
          : "N/A",
        updated_at: workOrder.updated_at
          ? new Date(workOrder.updated_at).toLocaleString()
          : "N/A",
      });
    });

    // Apply alternating row colors for better readability
    worksheet.eachRow((row, rowNumber) => {
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
    const manufactureSuffix = manufacture ? `-${manufacture}` : "";
    const skuSuffix = sku_name ? `-${sku_name}` : "";
    const statusSuffix = status !== "active" ? `-${status}` : "";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    const filename = `work-orders${manufactureSuffix}${skuSuffix}${statusSuffix}-${timestamp}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    // Pipe the stream to response
    stream.pipe(res);

    // Log the download
    logger.info(
      `Work Orders Excel download initiated by user ${req.user.id
      } with filters: ${JSON.stringify({
        manufacture,
        sku_name,
        status,
        updateMissingQrCodes,
      })}`
    );
  } catch (error) {
    logger.error("Excel Download Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// Update the other endpoints to return the QR code information
v1Router.get("/work-order/:id", authenticateJWT, async (req, res) => {
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

    const workOrder = await WorkOrder.findOne({
      where: whereClause,
    });

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    // If QR code URL doesn't exist, generate it now
    if (!workOrder.qr_code_url) {
      const qrCodeUrl = await generateQRCode(workOrder);
      await workOrder.update({ qr_code_url: qrCodeUrl });
    }

    const result = workOrder.get({ plain: true });

    res.json(result);
  } catch (error) {
    logger.error("Error fetching work order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// Dedicated endpoint to generate QR code for existing work orders
// v1Router.get("/work-order/:id/qrcode", authenticateJWT, async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { format = "url" } = req.query;

//     const workOrder = await WorkOrder.findOne({
//       where: {
//         id: id,
//         company_id: req.user.company_id,
//       },
//     });

//     if (!workOrder) {
//       return res.status(404).json({ message: "Work order not found" });
//     }

//     let qrCode;

//     if (format === "dataurl") {
//       // Generate data URL QR code
//       qrCode = await generateQRCodeDataURL(workOrder);
//     } else {
//       // Generate file-based QR code with URL
//       if (!workOrder.qr_code_url) {
//         qrCode = await generateQRCode(workOrder);
//         await workOrder.update({ qr_code_url: qrCode });
//       } else {
//         qrCode = workOrder.qr_code_url;
//       }
//     }

//     res.json({
//       success: true,
//       qrCode: qrCode,
//     });
//   } catch (error) {
//     logger.error("Error generating QR code:", error);
//     res
//       .status(500)
//       .json({ message: "Internal Server Error", error: error.message });
//   }
// });

// PUT update existing work order
v1Router.put("/work-order/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const workDetails = req.body;

  if (!workDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  try {
    // Find the work order
    const workOrder = await WorkOrder.findByPk(id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    // Check if the user has permission to update this work order (same company)
    if (workOrder.company_id !== req.user.company_id) {
      return res.status(403).json({
        message: "You don't have permission to update this work order"
      });
    }

    // Store original values for comparison to determine if we need a new QR code
    const originalSku = workOrder.sku_name;
    const originalQty = workOrder.qty;
    const originalManufacture = workOrder.manufacture;
    const originalStatus = workOrder.status;
    const originalDescription = workOrder.description;
    const originalEdd = workOrder.edd;

    // Update work order
    await workOrder.update({
      company_id: req.user.company_id,
      client_id: workDetails.client_id,
      sales_order_id: workDetails.sales_order_id || null,
      manufacture: workDetails.manufacture,
      sku_id: workDetails.sku_id || null,
      sku_name: workDetails.sku_name || null,
      sku_version: workDetails.sku_version || null,
      qty: workDetails.qty || null,
      edd: workDetails.edd || null,
      description: workDetails.description || null,
      acceptable_excess_units: workDetails.acceptable_excess_units || null,
      planned_start_date: workDetails.planned_start_date || null,
      planned_end_date: workDetails.planned_end_date || null,
      outsource_name: workDetails.outsource_name || null,
      status: workDetails.status || workOrder.status,
      updated_by: req.user.id,
      work_order_sku_values: workDetails.work_order_sku_values || null,
    });

    // Check if any QR code-relevant fields have changed
    const needsNewQrCode =
      originalSku !== workDetails.sku_name ||
      originalQty !== workDetails.qty ||
      originalManufacture !== workDetails.manufacture ||
      originalStatus !== (workDetails.status || workOrder.status) ||
      originalDescription !== workDetails.description ||
      originalEdd !== workDetails.edd;

    // Generate new QR code if needed
    if (needsNewQrCode || !workOrder.qr_code_url) {
      try {
        const qrCodeUrl = await generateQRCode(workOrder);
        await workOrder.update({ qr_code_url: qrCodeUrl });
      } catch (qrError) {
        logger.error(`Error generating QR code for work order ${id}:`, qrError);
        // Continue with response even if QR generation fails
      }
    }

    // Reload the work order to get the latest data including the QR code URL
    await workOrder.reload();

    res.json({
      message: "Work Order updated successfully",
      data: workOrder.get({ plain: true }),
    });
  } catch (error) {
    logger.error("Error updating work order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// DELETE work order (soft delete)
v1Router.delete("/work-order/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { updated_by } = req.user.id;

  try {
    // Find the work order
    const workOrder = await WorkOrder.findByPk(id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    // Soft delete - update status to inactive
    await workOrder.update({
      status: "inactive",
      updated_by: updated_by,
      updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
    });

    res.json({
      message: "Work Order successfully marked as inactive",
      data: workOrder.get({ plain: true }),
    });
  } catch (error) {
    logger.error("Error soft deleting work order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

v1Router.get(
  "/sale-order/:salesOrderId/work-orders",
  authenticateJWT,
  async (req, res) => {
    try {
      const { salesOrderId } = req.params;
      const { status = "active" } = req.query; // Default to active status
      const companyId = req.user.company_id;

      // Build where clause
      const where = {
        sales_order_id: salesOrderId,
        company_id: companyId,
      };

      // Filter by status unless "all" is specified
      if (status !== "all") {
        where.status = status;
      }

      // Fetch from database
      const workOrders = await WorkOrder.findAll({
        where,
        order: [["created_at", "DESC"]],
      });

      const result = workOrders.map((wo) => wo.get({ plain: true }));

      res.json(result);
    } catch (error) {
      logger.error("Error fetching work orders by sales order:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

// PUT update work order status (priority and progress only)
v1Router.put(
  "/work-order/status/:workOrderId",
  authenticateJWT,
  async (req, res) => {
    try {
      const { workOrderId } = req.params;
      const { priority, progress } = req.body;

      // Get user details from authentication
      const userId = req.user.id;
      const companyId = req.user.company_id;

      // Validate input
      if (!priority && !progress) {
        return res.status(400).json({
          success: false,
          message: "At least one field (priority or progress) is required",
        });
      }

      // Validate priority value if provided
      if (priority && !["High", "Medium", "Low"].includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "Priority must be High, Medium, or Low",
        });
      }

      // Validate progress value if provided
      const validProgressValues = [
        "Pending",
        "Product Planning",
        "Procurement Sourcing",
        "Production Planning",
        "Production",
        "Quality Control",
        "Packaging",
        "Shipping",
      ];

      if (progress && !validProgressValues.includes(progress)) {
        return res.status(400).json({
          success: false,
          message: `Progress must be one of: ${validProgressValues.join(", ")}`,
        });
      }

      // Find the work order
      const workOrder = await WorkOrder.findOne({
        where: {
          id: workOrderId,
          company_id: companyId,
        },
      });

      if (!workOrder) {
        return res.status(404).json({
          success: false,
          message: "Work order not found or you don't have access to it",
        });
      }

      // Create update object with only the provided fields
      const updateData = {};
      if (priority) updateData.priority = priority;
      if (progress) updateData.progress = progress;

      // Add audit fields
      updateData.updated_by = userId;
      updateData.updated_at = sequelize.literal("CURRENT_TIMESTAMP");

      // Update the work order with new status information
      await workOrder.update(updateData);

      return res.status(200).json({
        success: true,
        message: "Work order status updated successfully",
        data: workOrder.get({ plain: true }),
      });
    } catch (error) {
      logger.error("Error updating work order status:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

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
const PORT = 3006;
app.listen(process.env.PORT_WORK_ORDER, '0.0.0.0', () => {
  console.log(`work order Service running on port ${process.env.PORT_WORK_ORDER}`);
});
