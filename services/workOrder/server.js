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
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { axios } from "axios";
import FormData from "form-data";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();
const WorkOrder = db.WorkOrder;
const SalesOrder = db.SalesOrder;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FIX 1: Ensure the public directory structure is correct
const publicDir = path.join(__dirname, "../../public");
const qrCodeDir = path.join(publicDir, "qrcodes");

// Ensure directories exist
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(qrCodeDir)) {
  fs.mkdirSync(qrCodeDir, { recursive: true });
}

// FIX 2: Serve static files correctly - order matters!
// Serve the entire public directory, not just qrcodes
app.use("/public", express.static(publicDir));
// Also serve qrcodes directly for backward compatibility
app.use("/qrcodes", express.static(qrCodeDir));

// async function generateQRCode(workOrder) {
//   try {
//     const textContent = `
// Work Order: ${workOrder.work_generate_id}
// SKU: ${workOrder.sku_name || "N/A"}
// Quantity: ${workOrder.qty || "N/A"}
// Manufacture: ${workOrder.manufacture || "N/A"}
// Status: ${workOrder.status || "N/A"}
// ${workOrder.description ? `Description: ${workOrder.description}` : ""}
// ${
//   workOrder.edd
//     ? `Expected Delivery: ${new Date(workOrder.edd).toLocaleDateString()}`
//     : ""
// }
// `.trim();

//     const sanitizedId = workOrder.work_generate_id.replace(
//       /[^a-zA-Z0-9]/g,
//       "_"
//     );
//     const timestamp = Date.now();
//     const qrFileName = `wo_${sanitizedId}_${timestamp}.png`;
//     const qrFilePath = path.join(qrCodeDir, qrFileName);

//     // Debug logging
//     logger.info(
//       `Generating QR code for work order: ${workOrder.work_generate_id}`
//     );
//     logger.info(`QR code file path: ${qrFilePath}`);
//     logger.info(`QR code directory exists: ${fs.existsSync(qrCodeDir)}`);

//     await QRCode.toFile(qrFilePath, textContent, {
//       errorCorrectionLevel: "H",
//       margin: 1,
//       width: 300,
//     });

//     // Verify file creation
//     const fileExists = fs.existsSync(qrFilePath);
//     const fileStats = fileExists ? fs.statSync(qrFilePath) : null;

//     logger.info(`QR code file created: ${fileExists}`);
//     if (fileStats) {
//       logger.info(`QR code file size: ${fileStats.size} bytes`);
//     }

//     if (!fileExists) {
//       throw new Error("QR code file was not created successfully");
//     }

//     // Generate URL without /api prefix
//     const baseUrl = process.env.BASE_URL;
//     // const baseUrl = `http://localhost:${process.env.PORT_WORKORDER}`;
//     const fullUrl = `${baseUrl}/public/qrcodes/${qrFileName}`;

//     logger.info(`QR code URL generated: ${fullUrl}`);

//     return fullUrl;
//   } catch (error) {
//     logger.error("Error generating QR code:", error);
//     throw error;
//   }
// }

async function generateQRCode(workOrder, token) {
  try {
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
      }`.trim();

    const sanitizedId = workOrder.work_generate_id.replace(/[^a-zA-Z0-9]/g, "_");
    const timestamp = Date.now();
    const qrFileName = `wo_${sanitizedId}_${timestamp}.png`;
    const qrFilePath = path.join(__dirname, "qrcodes", qrFileName);

    if (!fs.existsSync(path.dirname(qrFilePath))) {
      fs.mkdirSync(path.dirname(qrFilePath), { recursive: true });
    }

    await QRCode.toFile(qrFilePath, textContent, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 300,
    });

    if (!fs.existsSync(qrFilePath)) {
      throw new Error("QR code file was not created successfully");
    }

    // Prepare form data for upload
    const form = new FormData();
    form.append("file", fs.createReadStream(qrFilePath));

    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${process.env.BASE_URL}/file/upload`,
      headers: {
        // "x-api-key": "4b3e77f648e5b9055a45f0812b3a4c3b88b08ff10b2f34ec21d11b6f678b6876a4014c88ff2a3c7e8e934c4f4790a94d3acb28d2f78a9b90f18960feaf3e4f99",
        Authorization: `Bearer ${token}`, // Replace with real token
        ...form.getHeaders(),
      },
      data: form,
    };

    const uploadResponse = await axios.request(config);

    if (uploadResponse.status !== 200 || !uploadResponse.data?.url) {
      throw new Error("Failed to upload QR code image.");
    }

    const uploadedImageUrl = uploadResponse.data.url;

    // Optional: delete local QR file after uploading
    fs.unlinkSync(qrFilePath);

    return uploadedImageUrl;

  } catch (error) {
    logger.error("Error generating and uploading QR code:", error);
    throw error;
  }
}

// ✅ PATCH: Batch update production status for multiple work orders
v1Router.patch(
  "/work-order/production/batch",
  authenticateJWT,
  async (req, res) => {
    try {
      const { workOrderIds, production } = req.body;

      // Get user details from authentication
      const userId = req.user.id;
      const companyId = req.user.company_id;

      // Validate input
      if (!Array.isArray(workOrderIds) || workOrderIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "workOrderIds must be a non-empty array",
        });
      }

      // Validate production status
      const validProductionValues = [
        "created",
        "in_production",
        "removed_from_production",
      ];
      if (!production || !validProductionValues.includes(production)) {
        return res.status(400).json({
          success: false,
          message: `Production status must be one of: ${validProductionValues.join(
            ", "
          )}`,
        });
      }

      // Validate maximum batch size (prevent too large requests)
      if (workOrderIds.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Maximum 100 work orders can be updated at once",
        });
      }

      // Find all work orders that match the criteria
      const workOrders = await WorkOrder.findAll({
        where: {
          id: {
            [Op.in]: workOrderIds,
          },
          company_id: companyId,
          status: "active", // Only allow updates to active work orders
        },
        attributes: ["id", "work_generate_id", "production"],
      });

      if (workOrders.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No valid work orders found for the provided IDs",
        });
      }

      // Track which IDs were not found
      const foundIds = workOrders.map((wo) => wo.id.toString());
      const notFoundIds = workOrderIds.filter(
        (id) => !foundIds.includes(id.toString())
      );

      // Perform batch update using transaction for data consistency
      const transaction = await sequelize.transaction();

      try {
        // Update all found work orders
        const [updatedCount] = await WorkOrder.update(
          {
            production: production,
            updated_by: userId,
            updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
          },
          {
            where: {
              id: {
                [Op.in]: foundIds,
              },
              company_id: companyId,
              status: "active",
            },
            transaction,
          }
        );

        await transaction.commit();

        // Log the batch action
        logger.info(
          `Batch production status update: ${updatedCount} work orders updated to ${production} by user ${userId}. IDs: ${foundIds.join(
            ", "
          )}`
        );

        return res.status(200).json({
          success: true,
          message: `Successfully updated production status for ${updatedCount} work orders`,
          data: {
            updated_count: updatedCount,
            updated_work_orders: workOrders.map((wo) => ({
              id: wo.id,
              work_generate_id: wo.work_generate_id,
              previous_production: wo.production,
              new_production: production,
            })),
            not_found_ids: notFoundIds.length > 0 ? notFoundIds : undefined,
          },
        });
      } catch (updateError) {
        await transaction.rollback();
        throw updateError;
      }
    } catch (error) {
      logger.error("Error batch updating work order production status:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);
v1Router.patch(
  "/work-order/production/:workOrderId",
  authenticateJWT,
  async (req, res) => {
    try {
      const { workOrderId } = req.params;
      const { production } = req.body;

      // Get user details from authentication
      const userId = req.user.id;
      const companyId = req.user.company_id;

      // Validate production status
      const validProductionValues = [
        "created",
        "in_production",
        "removed_from_production",
      ];
      if (!production || !validProductionValues.includes(production)) {
        return res.status(400).json({
          success: false,
          message: `Production status must be one of: ${validProductionValues.join(
            ", "
          )}`,
        });
      }

      // Find the work order
      const workOrder = await WorkOrder.findOne({
        where: {
          id: workOrderId,
          company_id: companyId,
          status: "active", // Only allow updates to active work orders
        },
      });

      if (!workOrder) {
        return res.status(404).json({
          success: false,
          message: "Work order not found or you don't have access to it",
        });
      }

      // Update the work order production status
      await workOrder.update({
        production: production,
        updated_by: userId,
        updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
      });

      // Reload the work order to get the actual updated timestamp
      await workOrder.reload();

      // Log the action
      logger.info(
        `Production status updated for work order ${workOrderId} to ${production} by user ${userId}`
      );

      return res.status(200).json({
        success: true,
        message: "Work order production status updated successfully",
        data: {
          id: workOrder.id,
          work_generate_id: workOrder.work_generate_id,
          production: workOrder.production,
          updated_at: workOrder.updated_at,
        },
      });
    } catch (error) {
      logger.error("Error updating work order production status:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);
v1Router.get(
  "/work-order/ungrouped-layers",
  authenticateJWT,
  async (req, res) => {
    try {
      const {
        manufacture,
        sku_name,
        status = "active",
        production,
      } = req.query;

      // Build where clause for filtering
      const whereClause = {
        company_id: req.user.company_id,
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

      // Production filtering - filter by production stage if provided
      if (production) {
        whereClause.production = production;
      }

      // Filter only production=in_production status
      whereClause.production = "in_production";

      // Include sales order information
      const includeOptions = [
        {
          model: SalesOrder,
          as: "salesOrder",
          attributes: ["id", "sales_ui_id", "sales_generate_id", "client"],
          required: false,
        },
      ];

      // Fetch all work orders without pagination
      const workOrders = await WorkOrder.findAll({
        where: whereClause,
        include: includeOptions,
        order: [["updated_at", "DESC"]],
      });

      // Helper function to parse work_order_sku_values and filter ungrouped layers
      const parseAndFilterSkuValues = (workOrderData) => {
        if (workOrderData.work_order_sku_values) {
          try {
            let skuValues = workOrderData.work_order_sku_values;

            // Parse if it's a string
            if (typeof skuValues === "string") {
              skuValues = JSON.parse(skuValues);
            }

            // Filter only ungrouped layers
            workOrderData.work_order_sku_values = skuValues.filter(
              (layer) => layer.layer_status === "ungrouped"
            );
          } catch (error) {
            logger.warn(
              `Failed to parse work_order_sku_values for work order ${workOrderData.id}:`,
              error
            );
            workOrderData.work_order_sku_values = [];
          }
        } else {
          workOrderData.work_order_sku_values = [];
        }
        return workOrderData;
      };

      // Process work orders - filter to only ungrouped layers
      const processedWorkOrders = workOrders.map((workOrder) => {
        const plainWorkOrder = workOrder.get({ plain: true });
        return parseAndFilterSkuValues(plainWorkOrder);
      });

      // Filter out work orders that have no ungrouped layers
      const workOrdersWithUngroupedLayers = processedWorkOrders.filter(
        (workOrder) => workOrder.work_order_sku_values.length > 0
      );

      res.json({
        workOrders: workOrdersWithUngroupedLayers,
        total: workOrdersWithUngroupedLayers.length,
      });
    } catch (error) {
      logger.error("Error fetching work orders with ungrouped layers:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);
v1Router.post("/work-order", authenticateJWT, async (req, res) => {
  const workDetails = req.body;
  const authHeader = req.headers.authorization;

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
      select_plant: workDetails.select_plant || null,
      // excess_qty: workDetails.excess_qty || 0,
      // pending_qty: workDetails.pending_qty || 0,
      // manufactured_qty: workDetails.manufactured_qty || 0,
      // priority: workDetails.priority || "Low",
      // progress: workDetails.progress || "Pending",
      // stage: workDetails.stage || "Production",
    });

    // Generate QR code for this work order
    // Option 1: Generate and store QR code as a file (with URL to access it)
    const authHeader = req.headers.authorization;
    const token = authHeader.split(" ")[1];
    const qrCodeUrl = await generateQRCode(newWorkOrder, token);

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

// v1Router.get("/work-order", authenticateJWT, async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 10,
//       manufacture,
//       sku_name,
//       status = "active",
//       production,
//       updateMissingQrCodes = "true",
//       sortBy,
//       sortOrder = "desc"
//     } = req.query;

//     const pageNum = parseInt(page, 10);
//     const limitNum = parseInt(limit, 10);
//     const offset = (pageNum - 1) * limitNum;

//     // Build where clause for filtering
//     const whereClause = {
//       company_id: req.user.company_id,
//     };

//     // Status filtering - default to active, but allow override
//     if (status === "all") {
//       // Don't filter by status if 'all' is specified
//     } else {
//       whereClause.status = status;
//     }

//     if (manufacture) {
//       whereClause.manufacture = manufacture;
//     }
//     if (sku_name) {
//       whereClause.sku_name = { [Op.like]: `%${sku_name}%` };
//     }

//     // Production filtering - filter by production stage if provided
//     if (production) {
//       whereClause.production = production;
//     }

//     // Build order clause - default to updated_at DESC
//     let orderClause = [["updated_at", "DESC"]];

//     // Handle sorting based on sortBy parameter
//     if (sortBy) {
//       const validSortFields = ["sku_name", "qty"];
//       const validSortOrders = ["asc", "desc"];

//       if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder.toLowerCase())) {
//         if (sortBy === "client") {
//           // For client sorting, we need to sort by the associated SalesOrder client field
//           orderClause = [[{ model: SalesOrder, as: "salesOrder" }, "client", sortOrder.toUpperCase()]];
//         } else {
//           // For sku_name and qty, sort directly on WorkOrder fields
//           orderClause = [[sortBy, sortOrder.toUpperCase()]];
//         }
//       }
//     }

//     // Special handling for client sorting - need to include SalesOrder even if not originally required
//     const includeOptions = [
//       {
//         model: SalesOrder,
//         as: "salesOrder",
//         attributes: ["id", "sales_ui_id", "sales_generate_id", "client"],
//         required: sortBy === "client" ? true : false, // Make it required only when sorting by client
//       },
//     ];

//     // Fetch from database with pagination, filters, sorting, and sales order association
//     const { count, rows } = await WorkOrder.findAndCountAll({
//       where: whereClause,
//       include: includeOptions,
//       limit: limitNum,
//       offset: offset,
//       order: orderClause,
//       distinct: true, // Important when using includes with sorting
//     });

//     // Helper function to parse work_order_sku_values
//     const parseWorkOrderSkuValues = (workOrderData) => {
//       if (workOrderData.work_order_sku_values) {
//         try {
//           if (typeof workOrderData.work_order_sku_values === "string") {
//             workOrderData.work_order_sku_values = JSON.parse(
//               workOrderData.work_order_sku_values
//             );
//           }
//         } catch (error) {
//           logger.warn(
//             `Failed to parse work_order_sku_values for work order ${workOrderData.id}:`,
//             error
//           );
//         }
//       }
//       return workOrderData;
//     };

//     // Process work orders - updating QR codes for those missing them
//     const workOrders = await Promise.all(
//       rows.map(async (workOrder) => {
//         const plainWorkOrder = workOrder.get({ plain: true });

//         // Parse work_order_sku_values
//         const parsedWorkOrder = parseWorkOrderSkuValues(plainWorkOrder);

//         // If QR code URL is missing and update flag is true, generate and update
//         if (updateMissingQrCodes === "true" && !parsedWorkOrder.qr_code_url) {
//           try {
//             const qrCodeUrl = await generateQRCode(workOrder);
//             await workOrder.update({ qr_code_url: qrCodeUrl });
//             parsedWorkOrder.qr_code_url = qrCodeUrl;
//           } catch (qrError) {
//             logger.error(
//               `Error generating QR code for work order ${parsedWorkOrder.id}:`,
//               qrError
//             );
//           }
//         }

//         return parsedWorkOrder;
//       })
//     );

//     // Calculate pagination metadata
//     const totalPages = Math.ceil(count / limitNum);

//     res.json({
//       workOrders,
//       pagination: {
//         total: count,
//         page: pageNum,
//         limit: limitNum,
//         totalPages,
//       },
//     });
//   } catch (error) {
//     logger.error("Error fetching work orders:", error);
//     res
//       .status(500)
//       .json({ message: "Internal Server Error", error: error.message });
//   }
// });
// Enhanced GET /work-order/:id endpoint with sales order details
v1Router.get("/work-order", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search, // Single search parameter like clients API
      status = "active",
      production,
      updateMissingQrCodes = "true",
      sortBy,
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const whereClause = {
      company_id: req.user.company_id,
    };

    // Status filtering - default to active, but allow override
    if (status === "all") {
      // Don't filter by status if 'all' is specified
    } else {
      whereClause.status = status;
    }

    // Production filtering - filter by production stage if provided
    if (production) {
      whereClause.production = production;
    }

    // Add unified search if provided - search across multiple fields
    if (search) {
      whereClause[Op.or] = [
        { manufacture: { [Op.like]: `%${search}%` } },
        { sku_name: { [Op.like]: `%${search}%` } },
        { work_generate_id: { [Op.like]: `%${search}%` } },
        { planned_start_date: { [Op.like]: `%${search}%` } },
        { planned_end_date: { [Op.like]: `%${search}%` } },
        { outsource_name: { [Op.like]: `%${search}%` } },
        { progress: { [Op.like]: `%${search}%` } },
      ];
    }

    // Build order clause - default to updated_at DESC
    let orderClause = [["updated_at", "DESC"]];

    // Handle sorting based on sortBy parameter
    if (sortBy) {
      const validSortFields = ["sku_name", "qty", "client"];
      const validSortOrders = ["asc", "desc"];

      if (
        validSortFields.includes(sortBy) &&
        validSortOrders.includes(sortOrder.toLowerCase())
      ) {
        if (sortBy === "client") {
          // For client sorting, we need to sort by the associated SalesOrder client field
          orderClause = [
            [
              { model: SalesOrder, as: "salesOrder" },
              "client",
              sortOrder.toUpperCase(),
            ],
          ];
        } else {
          // For sku_name and qty, sort directly on WorkOrder fields
          orderClause = [[sortBy, sortOrder.toUpperCase()]];
        }
      }
    }

    // Include options for related models
    const includeOptions = [
      {
        model: SalesOrder,
        as: "salesOrder",
        attributes: ["id", "sales_ui_id", "sales_generate_id", "client"],
        required: sortBy === "client" ? true : false, // Make it required only when sorting by client
        where: {}, // Initialize empty where clause
      },
    ];

    // Add search to related SalesOrder if search parameter is provided
    if (search) {
      includeOptions[0].where = {
        [Op.or]: [
          { client: { [Op.like]: `%${search}%` } },
          { sales_ui_id: { [Op.like]: `%${search}%` } },
          { sales_generate_id: { [Op.like]: `%${search}%` } },
        ],
      };
    }

    // If no search and not sorting by client, remove the where clause from include
    if (!search && sortBy !== "client") {
      delete includeOptions[0].where;
    }

    // Fetch from database with pagination, filters, sorting, and sales order association
    const { count, rows } = await WorkOrder.findAndCountAll({
      where: whereClause,
      include: includeOptions,
      limit: limitNum,
      offset: offset,
      order: orderClause,
      distinct: true, // Important when using includes with sorting
    });

    // Helper function to parse work_order_sku_values
    const parseWorkOrderSkuValues = (workOrderData) => {
      if (workOrderData.work_order_sku_values) {
        try {
          if (typeof workOrderData.work_order_sku_values === "string") {
            workOrderData.work_order_sku_values = JSON.parse(
              workOrderData.work_order_sku_values
            );
          }
        } catch (error) {
          logger.warn(
            `Failed to parse work_order_sku_values for work order ${workOrderData.id}:`,
            error
          );
        }
      }
      return workOrderData;
    };

    // Process work orders - updating QR codes for those missing them
    const workOrders = await Promise.all(
      rows.map(async (workOrder) => {
        const plainWorkOrder = workOrder.get({ plain: true });

        // Parse work_order_sku_values
        const parsedWorkOrder = parseWorkOrderSkuValues(plainWorkOrder);

        // If QR code URL is missing and update flag is true, generate and update
        if (updateMissingQrCodes === "true" && !parsedWorkOrder.qr_code_url) {
          try {
            const authHeader = req.headers.authorization;
            const token = authHeader.split(" ")[1];
            const qrCodeUrl = await generateQRCode(workOrder, token);
            await workOrder.update({ qr_code_url: qrCodeUrl });
            parsedWorkOrder.qr_code_url = qrCodeUrl;
          } catch (qrError) {
            logger.error(
              `Error generating QR code for work order ${parsedWorkOrder.id}:`,
              qrError
            );
          }
        }

        return parsedWorkOrder;
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
      include: [
        {
          model: SalesOrder,
          as: "salesOrder",
          attributes: ["id", "sales_ui_id", "sales_generate_id", "client"],
          required: false,
        },
      ],
    });

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    // If QR code URL doesn't exist, generate it now
    if (!workOrder.qr_code_url) {
      const authHeader = req.headers.authorization;
      const token = authHeader.split(" ")[1];
      const qrCodeUrl = await generateQRCode(workOrder, token);
      await workOrder.update({ qr_code_url: qrCodeUrl });
    }

    let result = workOrder.get({ plain: true });

    // Helper function to parse work_order_sku_values
    const parseWorkOrderSkuValues = (workOrderData) => {
      if (workOrderData.work_order_sku_values) {
        try {
          if (typeof workOrderData.work_order_sku_values === "string") {
            workOrderData.work_order_sku_values = JSON.parse(
              workOrderData.work_order_sku_values
            );
          }
        } catch (error) {
          logger.warn(
            `Failed to parse work_order_sku_values for work order ${workOrderData.id}:`,
            error
          );
        }
      }
      return workOrderData;
    };

    // Parse work_order_sku_values
    result = parseWorkOrderSkuValues(result);

    res.json(result);
  } catch (error) {
    logger.error("Error fetching work order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

v1Router.get(
  "/work-order/download/excel",
  authenticateJWT,
  async (req, res) => {
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
              const authHeader = req.headers.authorization;
              const token = authHeader.split(" ")[1];
              const qrCodeUrl = await generateQRCode(workOrder, token);
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
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "4472C4" },
        },
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
  }
);

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
        message: "You don't have permission to update this work order",
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
      select_plant: workDetails.select_plant || null,
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
        const authHeader = req.headers.authorization;
        const token = authHeader.split(" ")[1];
        const qrCodeUrl = await generateQRCode(workOrder, token);
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

v1Router.patch(
  "/work-order/status/:workOrderId",
  authenticateJWT,
  async (req, res) => {
    try {
      const { workOrderId } = req.params;
      const {
        priority,
        progress,
        excess_qty,
        pending_qty,
        manufactured_qty,
        stage,
      } = req.body;

      // Get user details from authentication
      const userId = req.user.id;
      const companyId = req.user.company_id;

      // Validate input - at least one field is required
      const updatableFields = [
        priority,
        progress,
        excess_qty,
        pending_qty,
        manufactured_qty,
        stage,
      ];
      if (
        !updatableFields.some((field) => field !== undefined && field !== null)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "At least one field (priority, progress, excess_qty, pending_qty, manufactured_qty, or stage) is required",
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
        "Raw Material Allocation",
        "Production Planned",
        "Completed",
        "Invoiced",
      ];

      if (progress && !validProgressValues.includes(progress)) {
        return res.status(400).json({
          success: false,
          message: `Progress must be one of: ${validProgressValues.join(", ")}`,
        });
      }

      // Validate quantity fields if provided (should be non-negative integers)
      const quantityFields = { excess_qty, pending_qty, manufactured_qty };
      for (const [fieldName, value] of Object.entries(quantityFields)) {
        if (value !== undefined && value !== null) {
          if (!Number.isInteger(value) || value < 0) {
            return res.status(400).json({
              success: false,
              message: `${fieldName} must be a non-negative integer`,
            });
          }
        }
      }

      // Validate stage field if provided (optional validation - adjust as needed)
      if (stage !== undefined && stage !== null && typeof stage !== "string") {
        return res.status(400).json({
          success: false,
          message: "Stage must be a string",
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
      if (priority !== undefined) updateData.priority = priority;
      if (progress !== undefined) updateData.progress = progress;
      if (excess_qty !== undefined) updateData.excess_qty = excess_qty;
      if (pending_qty !== undefined) updateData.pending_qty = pending_qty;
      if (manufactured_qty !== undefined)
        updateData.manufactured_qty = manufactured_qty;
      if (stage !== undefined) updateData.stage = stage;

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
// await db.sequelize.sync();
const PORT = process.env.PORT_WORKORDER;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`work order Service running on port ${PORT}`);
});
