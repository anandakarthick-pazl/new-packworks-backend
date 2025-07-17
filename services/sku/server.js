import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import {
  publishToQueue,
  rabbitChannel,
  closeRabbitMQConnection,
} from "../../common/helper/rabbitmq.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import ExcelJS from "exceljs";
import { Readable } from "stream";
import validateUniqueKey from "../../common/inputvalidation/validteUniquKey.js";
import { generateId } from "../../common/inputvalidation/generateId.js";

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

// SETUP BRANCH FILTERING
setupBranchFiltering(sequelize);

const v1Router = Router();

// ADD MIDDLEWARE TO ROUTER
v1Router.use(branchFilterMiddleware);
v1Router.use(resetBranchFilter);

const Sku = db.Sku;
const SkuVersion = db.SkuVersion;
const User = db.User;
const SkuType = db.SkuType;
const Client = db.Client;
const SkuOptions = db.SkuOptions;
const SalesSkuDetails = db.SalesSkuDetails;

// 🔹 Create a SKU (POST)
patchModelForBranchFiltering(Sku);
patchModelForBranchFiltering(SkuVersion);
patchModelForBranchFiltering(SkuOptions);

v1Router.post(
  "/sku-details",
  authenticateJWT,
  validateUniqueKey(Sku, ["sku_name"]),
  async (req, res) => {
    const t = await sequelize.transaction();
    try {
      // Add created_by and updated_by from the authenticated user

      const sku_ui_id = await generateId(req.user.company_id, Sku, "sku");

      const skuData = {
        ...req.body,
        sku_ui_id: sku_ui_id,
        company_id: req.user.company_id,
        created_by: req.user.id,
        // updated_by: req.user.id,
        status: "active",
      };

      const newSku = await Sku.create(skuData, { transaction: t });
      await t.commit();
      await publishToQueue({
        operation: "CREATE",
        skuId: newSku.id,
        timestamp: new Date(),
        data: newSku,
      });
      res
        .status(201)
        .json({ message: "SKU created successfully", sku: newSku });
    } catch (error) {
      await t.rollback();
      res
        .status(500)
        .json({ message: "Error creating SKU", error: error.message });
    }
  }
);

v1Router.get("/sku-details", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sku_name,
      client,
      ply,
      sku_type,
      status = "active",
    } = req.query;

    const offset = (page - 1) * limit;

    // Build the where condition for search
    let whereCondition = {
      status: status,
    };

    // Handle specific field searches if provided
    if (sku_name) whereCondition.sku_name = { [Op.like]: `%${sku_name}%` };
    if (ply) whereCondition.ply = { [Op.like]: `%${ply}%` };

    if (client) whereCondition.client = { [Op.like]: `%${client}%` };
    if (sku_type) whereCondition.sku_type = { [Op.like]: `%${sku_type}%` };

    // Apply filters for client and sku_type if provided
    if (client) whereCondition.client = client;
    if (sku_type) whereCondition.sku_type = sku_type;

    // Handle generic search across multiple fields if no specific fields are provided
    if (search) {
      whereCondition = {
        [Op.and]: [
          { status: status },
          {
            [Op.or]: [
              { sku_name: { [Op.like]: `%${search}%` } },
              { client: { [Op.like]: `%${search}%` } },
              { ply: { [Op.like]: `%${ply}%` } },
              { sku_type: { [Op.like]: `%${search}%` } },
              { sku_ui_id: { [Op.like]: `%${search}%` } },
              { length: { [Op.like]: `%${search}%` } },
              { width: { [Op.like]: `%${search}%` } },
              { height: { [Op.like]: `%${search}%` } },
              { lwh: { [Op.like]: `%${search}%` } },
              { length_board_size_cm2: { [Op.like]: `%${search}%` } },
              { width_board_size_cm2: { [Op.like]: `%${search}%` } },
              { board_size_cm2: { [Op.like]: `%${search}%` } },
            ],
          },
        ],
      };
    }

    // Get total count for pagination metadata
    const totalCount = await Sku.count({ where: whereCondition });

    // Fetch skus with pagination and search
    // Add order parameter to sort by created_at in descending order (newest first)
    const skus = await Sku.findAll({
      where: whereCondition,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
      include: [
        {
          model: db.User,
          as: "sku_creator",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: db.User,
          as: "sku_updater",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    // Calculate dashboard values dynamically
    const skuTypeCounts = await Sku.findAll({
      attributes: [
        "sku_type",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: { status: "active" },
      group: ["sku_type"],
      raw: true,
    });

    // Create a dashboard object with dynamic SKU type counts
    const dashboard = skuTypeCounts.reduce((acc, item) => {
      // Convert SKU type to lowercase first
      const skuTypeLowerCase = item.sku_type.toLowerCase();

      // Map SKU type to a more readable key if needed (with lowercase keys)
      const keyMap = {
        "RSC box": "rscBox",
        Board: "board",
        "Die Cut box": "dieCutBox",
        Composite: "composite",
        "Custom Item": "customItem",
      };

      // Use the mapped key or fallback to a camelCased version of the sku_type
      const key =
        keyMap[skuTypeLowerCase] ||
        skuTypeLowerCase
          .replace(/\s+/g, "")
          .replace(/^./, (char) => char.toLowerCase());

      acc[key] = parseInt(item.count);
      return acc;
    }, {});

    const formattedSkus = skus.map((sku) => ({
      ...sku.toJSON(),
      sku_values: sku.sku_values ? JSON.parse(sku.sku_values) : null,
      part_value: sku.part_value ? JSON.parse(sku.part_value) : null,
      tags: sku.tags ? JSON.parse(sku.tags) : null,
      documents: sku.documents ? JSON.parse(sku.documents) : null,
      created_at: sku.created_at, // Include created_at timestamp
      updated_at: sku.updated_at, // Include updated_at timestamp
    }));

    const totalPages = Math.ceil(totalCount / limit);

    const responseData = {
      data: formattedSkus,
      dashboard: dashboard,
      pagination: {
        totalCount,
        totalPages,
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    logger.error("Error fetching SKUs:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});
// 🔹 Get SKU by ID (GET)
v1Router.put("/sku-details/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    // Define allowed fields to update
    const allowedFields = [
      "client_id",
      "sku_name",
      "ply",
      "length",
      "width",
      "height",
      "lwh",
      "joints",
      "ups",
      "select_dies",
      "inner_outer_dimension",
      "flap_width",
      "flap_tolerance",
      "length_trimming_tolerance",
      "width_trimming_tolerance",
      "strict_adherence",
      "customer_reference",
      "reference_number",
      "internal_id",
      "length_board_size_cm2",
      "width_board_size_cm2",
      "board_size_cm2",
      "deckle_size",
      "minimum_order_level",
      "sku_type",
      "sku_values",
      "sku_version_limit",
      "composite_type",
      "part_count",
      "part_value",
      "route",
      "print_type",
      "documents",
      "total_weight",
      "total_bursting_strength",
      "total_weight",
      "total_bursting_strength",
      "estimate_composite_item",
      "description",
      "default_sku_details",
      "tags",
      "gst_percentage",
      // "status",
    ];

    // Find the current SKU
    const currentSku = await Sku.findByPk(req.params.id);

    if (!currentSku) {
      await transaction.rollback();
      return res.status(404).json({ message: "SKU not found" });
    }

    // Filter request body to only include allowed fields
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Add updated_by
    updateData.updated_by = req.user.id;
    updateData.updated_at = new Date();

    // Special handling for sku_name
    if (updateData.sku_name) {
      if (
        updateData.sku_name !== currentSku.sku_name &&
        updateData.id !== req.params.id
      ) {
        // Check for duplicate SKU name for the same client, excluding the current SKU
        const existingSku = await Sku.findOne({
          where: {
            sku_name: updateData.sku_name,
            client_id: currentSku.client_id,
            id: { [Op.ne]: req.params.id },
          },
          transaction,
        });
        if (existingSku) {
          await transaction.rollback();
          return res.status(400).json({
            message:
              "SKU name already exists for this client. Please use a different name.",
          });
        }
      }
    }

    // If client_id is provided, ensure it matches the current SKU's client
    if (updateData.client_id && updateData.client_id !== currentSku.client_id) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Cannot change client for an existing SKU.",
      });
    }

    // Check if no valid fields to update
    if (Object.keys(updateData).length <= 1) {
      // 1 is for updated_by
      await transaction.rollback();
      return res.status(400).json({
        message: "No updatable fields provided.",
      });
    }

    // Perform the update
    const [updatedCount] = await Sku.update(updateData, {
      where: { id: req.params.id },
      transaction,
    });

    if (updatedCount === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "SKU not found." });
    }

    // Fetch the updated SKU to return to the client
    const updatedSku = await Sku.findByPk(req.params.id, { transaction });

    // Convert sku_values from string to JSON if needed
    if (updatedSku.sku_values) {
      try {
        updatedSku.sku_values = JSON.parse(updatedSku.sku_values);
      } catch (error) {
        console.error("Error parsing sku_values:", error.message);
        await transaction.rollback();
        return res.status(500).json({
          message: "Error parsing sku_values.",
          error: error.message,
        });
      }
    }

    // Parse part_value JSON if it exists
    if (updatedSku.part_value) {
      try {
        updatedSku.part_value = JSON.parse(updatedSku.part_value);
      } catch (error) {
        console.error("Error parsing part_value:", error.message);
        await transaction.rollback();
        return res.status(500).json({
          message: "Error parsing part_value.",
          error: error.message,
        });
      }
    }
    if (updatedSku.route) {
      try {
        updatedSku.route = JSON.parse(updatedSku.route);
      } catch (error) {
        console.error("Error parsing part_value:", error.message);
        await transaction.rollback();
        return res.status(500).json({
          message: "Error parsing part_value.",
          error: error.message,
        });
      }
    }

    // Commit the transaction
    await transaction.commit();

    // Publish update to queue (optional)
    await publishToQueue({
      operation: "UPDATE",
      skuId: req.params.id,
      timestamp: new Date(),
      data: updateData,
    });

    return res.status(200).json({
      message: "SKU updated successfully.",
      updatedData: updatedSku,
    });
  } catch (error) {
    console.log(error, "Error in SKU Update");
    // Rollback the transaction on error
    await transaction.rollback();
    return res.status(500).json({
      message: "Error updating SKU.",
      error: error.message,
    });
  }
});

v1Router.delete("/sku-details/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Check if SKU exists in SalesSkuDetails table
    const salesReference = await SalesSkuDetails.findOne({
      where: { sku_id: req.params.id },
      transaction: t,
    });

    if (salesReference) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Cannot delete SKU. It is referenced in sales records.",
        error: "SKU has associated sales data"
      });
    }

    // Update status to inactive instead of deleting
    const updatedSku = await Sku.update(
      {
        status: "inactive",
        updated_at: new Date(),
        updated_by: req.user.id,
      },
      {
        where: { id: req.params.id },
        transaction: t,
      }
    );

    if (!updatedSku[0]) {
      await t.rollback();
      return res.status(404).json({ message: "SKU not found" });
    }

    await t.commit();
    await publishToQueue({
      operation: "SOFT_DELETE",
      skuId: req.params.id,
      timestamp: new Date(),
      data: { status: "inactive" },
    });
    
    res.status(200).json({ message: "SKU marked as inactive successfully" });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error deactivating SKU", error: error.message });
  }
});

v1Router.get("/sku-details/:id", authenticateJWT, async (req, res) => {
  console.log("req.params.id", req.params.id);
  try {
    const sku = await Sku.findByPk(req.params.id, {
      include: [
        {
          model: db.User,
          as: "sku_creator",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: db.User,
          as: "sku_updater",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    if (!sku) {
      return res.status(404).json({ message: "SKU not found" });
    }

    // Parse sku_values if it's stored as a JSON string
    const formattedSku = {
      ...sku.toJSON(),
      sku_values: sku.sku_values ? JSON.parse(sku.sku_values) : null,
      part_value: sku.part_value ? JSON.parse(sku.part_value) : null,
      tags: sku.tags ? JSON.parse(sku.tags) : null,
      documents: sku.documents ? JSON.parse(sku.documents) : null,
    };

    res.status(200).json(formattedSku);
  } catch (error) {
    logger.error("Error fetching SKU by ID:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

v1Router.get(
  "/sku-details/download/excel",
  authenticateJWT,
  async (req, res) => {
    try {
      const {
        search = "",
        status = "active",
        sku_type,
        client,
        includeInactive = false,
      } = req.query;

      // Build the where condition
      const whereCondition = {};

      // Status handling
      if (includeInactive !== "true") {
        whereCondition.status = status;
      }

      // Additional filters
      if (sku_type) whereCondition.sku_type = sku_type;
      if (client) whereCondition.client = client;

      // Search across multiple fields
      if (search) {
        whereCondition[Op.or] = [
          { sku_name: { [Op.like]: `%${search}%` } },
          { client: { [Op.like]: `%${search}%` } },
          { sku_type: { [Op.like]: `%${search}%` } },
          { reference_number: { [Op.like]: `%${search}%` } },
        ];
      }

      // Fetch SKUs with related data
      const { rows: skus } = await Sku.findAndCountAll({
        where: whereCondition,
        include: [
          {
            model: db.User,
            as: "sku_creator",
            attributes: ["id", "name", "email"],
          },
          {
            model: db.User,
            as: "sku_updater",
            attributes: ["id", "name", "email"],
          },
          {
            model: db.Client,
            attributes: [],
          },
        ],
        order: [["id", "ASC"]],
      });

      // Create a new Excel workbook
      const workbook = new ExcelJS.Workbook();
      const skuSheet = workbook.addWorksheet("SKU Details");

      // Define columns with comprehensive SKU details
      skuSheet.columns = [
        { header: "SKU ID", key: "id", width: 10 },
        { header: "SKU UI ID", key: "sku_ui_id", width: 15 },
        { header: "SKU Name", key: "sku_name", width: 20 },
        { header: "Client", key: "client", width: 20 },
        { header: "SKU Type", key: "sku_type", width: 15 },
        { header: "Ply", key: "ply", width: 10 },
        { header: "Length (cm)", key: "length", width: 12 },
        { header: "Width (cm)", key: "width", width: 12 },
        { header: "Height (cm)", key: "height", width: 12 },
        { header: "Unit", key: "unit", width: 10 },
        {
          header: "Estimate Composite Item",
          key: "estimate_composite_item",
          width: 20,
        },
        { header: "Description", key: "description", width: 20 },
        {
          header: "Default SKU Details",
          key: "default_sku_details",
          width: 20,
        },
        { header: "Tags", key: "tags", width: 20 },
        { header: "route", key: "route", width: 20 },
        { header: "Print Type", key: "print_type", width: 20 },
        { header: "documents", key: "documents", width: 200 },
        
        { header: "Joints", key: "joints", width: 10 },
        { header: "UPS", key: "ups", width: 10 },
        { header: "Select Dies", key: "select_dies", width: 10 },
        { header: "Inner/Outer", key: "inner_outer_dimension", width: 15 },
        { header: "Flap Width", key: "flap_width", width: 12 },
        { header: "Flap Tolerance", key: "flap_tolerance", width: 15 },
        {
          header: "Length Trimming Tolerance",
          key: "length_trimming_tolerance",
          width: 20,
        },
        {
          header: "Width Trimming Tolerance",
          key: "width_trimming_tolerance",
          width: 20,
        },
        { header: "Strict Adherence", key: "strict_adherence", width: 15 },
        { header: "Customer Reference", key: "customer_reference", width: 20 },
        { header: "Reference Number", key: "reference_number", width: 20 },
        { header: "Internal ID", key: "internal_id", width: 15 },
        { header: "Board Size (cm²)", key: "board_size_cm2", width: 15 },
        { header: "Deckle Size", key: "deckle_size", width: 15 },
        {
          header: "Minimum Order Level",
          key: "minimum_order_level",
          width: 20,
        },
        { header: "GST Percentage", key: "gst_percentage", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "Created By", key: "created_by_name", width: 20 },
        { header: "Created At", key: "created_at", width: 20 },
        { header: "Updated By", key: "updated_by_name", width: 20 },
        { header: "Updated At", key: "updated_at", width: 20 },
      ];

      // Header styling
      const headerStyle = {
        font: { bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "4472C4" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
      };

      // Apply header style
      skuSheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Add data to sheet
      skus.forEach((sku) => {
        skuSheet.addRow({
          id: sku.id,
          sku_ui_id: sku.sku_ui_id,
          sku_name: sku.sku_name,
          client: sku.client,
          sku_type: sku.sku_type,
          composite_type: sku.composite_type,
          ply: sku.ply,
          length: sku.length,
          width: sku.width,
          height: sku.height,
          unit: sku.unit,
          estimate_composite_item: sku.estimate_composite_item,
          description: sku.description,
          default_sku_details: sku.default_sku_details,
          tags: sku.tags,
          route: sku.route,
          print_type: sku.print_type,
          documents: sku.documents,
          joints: sku.joints,
          ups: sku.ups,
          select_dies: sku.select_dies,
          inner_outer_dimension: sku.inner_outer_dimension,
          flap_width: sku.flap_width,
          flap_tolerance: sku.flap_tolerance,
          length_trimming_tolerance: sku.length_trimming_tolerance,
          width_trimming_tolerance: sku.width_trimming_tolerance,
          strict_adherence: sku.strict_adherence ? "Yes" : "No",
          customer_reference: sku.customer_reference,
          gst_percentage: sku.gst_percentage,
          reference_number: sku.reference_number,
          internal_id: sku.internal_id,
          board_size_cm2: sku.board_size_cm2,
          deckle_size: sku.deckle_size,
          minimum_order_level: sku.minimum_order_level,
          status: sku.status,
          created_by_name: sku.sku_creator ? sku.sku_creator.name : "N/A",
          created_at: sku.created_at
            ? new Date(sku.created_at).toLocaleString()
            : "N/A",
          updated_by_name: sku.sku_updater ? sku.sku_updater.name : "N/A",
          updated_at: sku.updated_at
            ? new Date(sku.updated_at).toLocaleString()
            : "N/A",
        });
      });

      // Create SKU Values sheet with flattened JSON structure
      const skuValuesSheet = workbook.addWorksheet("SKU Values");

      // First, collect all possible keys from sku_values across all SKUs
      const skuValuesKeys = new Set();
      skuValuesKeys.add("SKU ID");
      skuValuesKeys.add("SKU Name");

      skus.forEach((sku) => {
        if (sku.sku_values) {
          try {
            const valuesObj =
              typeof sku.sku_values === "string"
                ? JSON.parse(sku.sku_values)
                : sku.sku_values;
            // Get all keys recursively
            const getAllKeys = (obj, prefix = "") => {
              if (typeof obj !== "object" || obj === null) return;

              Object.keys(obj).forEach((key) => {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                if (
                  typeof obj[key] === "object" &&
                  obj[key] !== null &&
                  !Array.isArray(obj[key])
                ) {
                  getAllKeys(obj[key], fullKey);
                } else {
                  skuValuesKeys.add(fullKey);
                }
              });
            };

            getAllKeys(valuesObj);
          } catch (e) {
            console.error("Error parsing SKU values:", e);
          }
        }
      });

      // Convert set to array and define columns
      const skuValuesColumns = Array.from(skuValuesKeys).map((key) => ({
        header: key,
        key: key,
        width: 15,
      }));

      skuValuesSheet.columns = skuValuesColumns;

      // Apply header style
      skuValuesSheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Add flattened data rows
      skus.forEach((sku) => {
        if (sku.sku_values) {
          try {
            const valuesObj =
              typeof sku.sku_values === "string"
                ? JSON.parse(sku.sku_values)
                : sku.sku_values;
            const rowData = {
              "SKU ID": sku.id,
              "SKU Name": sku.sku_name,
            };

            // Flatten the object
            const flattenObject = (obj, prefix = "") => {
              if (typeof obj !== "object" || obj === null) return {};

              return Object.keys(obj).reduce((acc, key) => {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                if (
                  typeof obj[key] === "object" &&
                  obj[key] !== null &&
                  !Array.isArray(obj[key])
                ) {
                  Object.assign(acc, flattenObject(obj[key], fullKey));
                } else {
                  acc[fullKey] = Array.isArray(obj[key])
                    ? obj[key].join(", ")
                    : obj[key];
                }
                return acc;
              }, {});
            };

            const flatData = flattenObject(valuesObj);
            Object.assign(rowData, flatData);

            skuValuesSheet.addRow(rowData);
          } catch (e) {
            console.error("Error adding SKU values row:", e);
            skuValuesSheet.addRow({
              "SKU ID": sku.id,
              "SKU Name": sku.sku_name,
              Error: "Error parsing JSON",
            });
          }
        }
      });

      // Create Part Values sheet with flattened JSON structure
      const partValuesSheet = workbook.addWorksheet("Part Values");

      // First, collect all possible keys from part_value across all SKUs
      const partValuesKeys = new Set();
      partValuesKeys.add("SKU ID");
      partValuesKeys.add("SKU Name");
      partValuesKeys.add("Part Number");

      skus.forEach((sku) => {
        if (sku.part_value) {
          try {
            const partsObj =
              typeof sku.part_value === "string"
                ? JSON.parse(sku.part_value)
                : sku.part_value;

            // For each part in the object
            Object.keys(partsObj).forEach((partKey) => {
              const part = partsObj[partKey];

              // Get all keys for this part
              if (typeof part === "object" && part !== null) {
                Object.keys(part).forEach((key) => {
                  partValuesKeys.add(key);
                });
              }
            });
          } catch (e) {
            console.error("Error parsing part values:", e);
          }
        }
      });

      // Convert set to array and define columns
      const partValuesColumns = Array.from(partValuesKeys).map((key) => ({
        header: key,
        key: key,
        width: 15,
      }));

      partValuesSheet.columns = partValuesColumns;

      // Apply header style
      partValuesSheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Add data rows - one row per part
      skus.forEach((sku) => {
        if (sku.part_value) {
          try {
            const partsObj =
              typeof sku.part_value === "string"
                ? JSON.parse(sku.part_value)
                : sku.part_value;

            // For each part in the object, create a new row
            Object.keys(partsObj).forEach((partKey, index) => {
              const part = partsObj[partKey];

              if (typeof part === "object" && part !== null) {
                const rowData = {
                  "SKU ID": sku.id,
                  "SKU Name": sku.sku_name,
                  "Part Number": index + 1,
                };

                // Add all properties of this part
                Object.keys(part).forEach((key) => {
                  rowData[key] = part[key];
                });

                partValuesSheet.addRow(rowData);
              }
            });
          } catch (e) {
            console.error("Error adding part values row:", e);
            partValuesSheet.addRow({
              "SKU ID": sku.id,
              "SKU Name": sku.sku_name,
              "Part Number": 1,
              Error: "Error parsing JSON",
            });
          }
        }
      });

      // Apply alternating row colors to all sheets
      [skuSheet, skuValuesSheet, partValuesSheet].forEach((sheet) => {
        sheet.eachRow((row, rowNumber) => {
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
      });

      // Create a readable stream for the workbook
      const buffer = await workbook.xlsx.writeBuffer();
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      // Set response headers for file download
      const searchSuffix = search ? `-${search}` : "";
      const skuTypeSuffix = sku_type ? `-${sku_type}` : "";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `sku-details${searchSuffix}${skuTypeSuffix}-${timestamp}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

      // Pipe the stream to response
      stream.pipe(res);

      // Log the download
      logger.info(
        `SKU Excel download initiated by user ${
          req.user.id
        } with filters: ${JSON.stringify({
          search,
          status,
          sku_type,
          client,
        })}`
      );
    } catch (error) {
      logger.error("SKU Excel Download Error:", error);
      return res.status(500).json({ status: false, message: error.message });
    }
  }
);

v1Router.get(
  "/sku-details/client-sku/:client_id",
  authenticateJWT,
  async (req, res) => {
    try {
      const { client_id } = req.params;
      const { sku_name } = req.query;

      // Build the where condition with client_id
      let whereCondition = {
        client_id: client_id,
        status: "active", // Default to active SKUs
      };

      // Add sku_name search if provided
      if (sku_name) {
        whereCondition.sku_name = { [Op.like]: `%${sku_name}%` };
      }

      // Fetch all matching SKUs without pagination
      const skus = await Sku.findAll({
        where: whereCondition,
        include: [
          {
            model: db.User,
            as: "sku_creator",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: db.User,
            as: "sku_updater",
            attributes: ["id", "name"],
            required: false,
          },
        ],
      });

      // Format the SKU data
      const formattedSkus = skus.map((sku) => ({
        ...sku.toJSON(),
        sku_values: sku.sku_values ? JSON.parse(sku.sku_values) : null,
        part_value: sku.part_value ? JSON.parse(sku.part_value) : null,
        tags: sku.tags ? JSON.parse(sku.tags) : null,
      }));

      res.status(200).json({
        data: formattedSkus,
        count: formattedSkus.length,
      });
    } catch (error) {
      logger.error("Error fetching client SKUs:", error);
      res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);

v1Router.post("/sku-details/sku-version", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Check if the referenced SKU exists
    const existingSku = await Sku.findByPk(req.body.sku_id);
    if (!existingSku) {
      await t.rollback();
      return res.status(404).json({ message: "Referenced SKU not found" });
    }

    // Prepare the data for creation with user info
    const skuVersionData = {
      ...req.body,
      company_id: req.user.company_id,
      created_by: req.user.id,
      status: "active",
    };

    // Convert sku_values to string if it's an object or array
    if (
      skuVersionData.sku_values &&
      typeof skuVersionData.sku_values === "object"
    ) {
      skuVersionData.sku_values = JSON.stringify(skuVersionData.sku_values);
    }

    const newSkuVersion = await SkuVersion.create(skuVersionData, {
      transaction: t,
    });
    await t.commit();

    // Publish to queue if needed
    await publishToQueue({
      operation: "CREATE_VERSION",
      skuVersionId: newSkuVersion.id,
      skuId: newSkuVersion.sku_id,
      timestamp: new Date(),
      data: newSkuVersion,
    });

    // Parse sku_values back to an object before sending response
    if (
      newSkuVersion.sku_values &&
      typeof newSkuVersion.sku_values === "string"
    ) {
      try {
        newSkuVersion.sku_values = JSON.parse(newSkuVersion.sku_values);
      } catch (parseError) {
        console.error("Error parsing sku_values:", parseError);
        // Keep as string if parsing fails
      }
    }

    res.status(201).json({
      message: "SKU Version created successfully",
      skuVersion: newSkuVersion,
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({
      message: "Error creating SKU Version",
      error: error.message,
    });
  }
});

v1Router.put(
  "/sku-details/sku-version/:id",
  authenticateJWT,
  async (req, res) => {
    const t = await sequelize.transaction();
    try {
      // Check if the SKU version exists
      const existingSkuVersion = await SkuVersion.findByPk(req.params.id);
      if (!existingSkuVersion) {
        await t.rollback();
        return res.status(404).json({ message: "SKU Version not found" });
      }

      // Prepare the data for update with user info
      const updateData = {
        ...req.body,
        updated_by: req.user.id,
        updated_at: new Date(),
      };

      // Convert sku_values to string if it's an object or array
      if (updateData.sku_values && typeof updateData.sku_values === "object") {
        updateData.sku_values = JSON.stringify(updateData.sku_values);
      }

      // Update the SKU Version
      await SkuVersion.update(updateData, {
        where: { id: req.params.id },
        transaction: t,
      });

      // Fetch the updated version to return in response
      const updatedSkuVersion = await SkuVersion.findByPk(req.params.id, {
        transaction: t,
        include: [
          {
            model: Sku,
            attributes: ["id", "sku_name"],
            required: false,
          },
          {
            model: Client,
            attributes: ["client_id", "company_name"],
            required: false,
          },
          {
            model: User,
            as: "version_creator",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: User,
            as: "version_updater",
            attributes: ["id", "name"],
            required: false,
          },
        ],
      });

      await t.commit();

      // Publish to queue if needed
      await publishToQueue({
        operation: "UPDATE_VERSION",
        skuVersionId: updatedSkuVersion.id,
        skuId: updatedSkuVersion.sku_id,
        timestamp: new Date(),
        data: updatedSkuVersion,
      });

      // Parse sku_values back to an object before sending response
      let responseData = updatedSkuVersion.toJSON();
      if (
        responseData.sku_values &&
        typeof responseData.sku_values === "string"
      ) {
        try {
          responseData.sku_values = JSON.parse(responseData.sku_values);
        } catch (parseError) {
          console.error("Error parsing sku_values:", parseError);
          // Keep as string if parsing fails
        }
      }

      res.status(200).json({
        message: "SKU Version updated successfully",
        skuVersion: responseData,
      });
    } catch (error) {
      await t.rollback();
      logger.error("Error updating SKU Version:", error);
      res.status(500).json({
        message: "Error updating SKU Version",
        error: error.message,
      });
    }
  }
);

// 🔹 Get SKU Versions (GET)

v1Router.get(
  "/sku-details/sku-version/get",
  authenticateJWT,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        sku_id,
        client_id,
        status = "active",
      } = req.query;

      const offset = (page - 1) * limit;

      // Build the where condition for search
      let whereCondition = {
        status: status,
      };

      // Apply specific filters if provided
      if (sku_id) whereCondition.sku_id = sku_id;
      if (client_id) whereCondition.client_id = client_id;

      // Handle generic search across multiple fields
      if (search) {
        whereCondition = {
          [Op.and]: [
            { status: status },
            {
              [Op.or]: [
                { sku_version: { [Op.like]: `%${search}%` } },
                // Add other searchable fields as needed
              ],
            },
          ],
        };
      }

      // Get total count for pagination metadata
      const totalCount = await SkuVersion.count({ where: whereCondition });

      // Fetch sku versions with pagination and search
      const skuVersions = await SkuVersion.findAll({
        where: whereCondition,
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [
          {
            model: Sku,
            attributes: ["id", "sku_name"],
            required: false,
          },
          {
            model: Client,
            attributes: ["client_id", "company_name"],
            required: false,
          },
          {
            model: User,
            as: "version_creator",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: User,
            as: "version_updater",
            attributes: ["id", "name"],
            required: false,
          },
        ],
        order: [["created_at", "DESC"]],
      });

      const formattedSkuVersions = skuVersions.map((skuVersion) => ({
        ...skuVersion.toJSON(),
        sku_values: skuVersion.sku_values
          ? JSON.parse(skuVersion.sku_values)
          : null,
        created_at: skuVersion.created_at,
        updated_at: skuVersion.updated_at,
      }));

      const totalPages = Math.ceil(totalCount / limit);

      const responseData = {
        data: formattedSkuVersions,
        pagination: {
          totalCount,
          totalPages,
          currentPage: parseInt(page),
          pageSize: parseInt(limit),
          // hasNextPage: parseInt(page) < totalPages,
          // hasPrevPage: parseInt(page) > 1,
        },
      };

      res.status(200).json(responseData);
    } catch (error) {
      logger.error("Error fetching SKU Versions:", error);
      res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);

// 🔹 Get SKU Versions by SKU ID (GET)

v1Router.get(
  "/sku-details/sku-version/sku/:skuId",
  authenticateJWT,
  async (req, res) => {
    try {
      const { page = 1, limit = 10, status = "active" } = req.query;

      const skuId = req.params.skuId;
      const offset = (page - 1) * limit;

      // Check if the SKU exists
      const existingSku = await Sku.findByPk(skuId);
      if (!existingSku) {
        return res.status(404).json({ message: "SKU not found" });
      }

      // Get total count for pagination metadata
      const totalCount = await SkuVersion.count({
        where: {
          sku_id: skuId,
          status: status,
        },
      });

      // Fetch all versions for a specific SKU
      const skuVersions = await SkuVersion.findAll({
        where: {
          sku_id: skuId,
          status: status,
        },
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [
          {
            model: User,
            as: "version_creator",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: User,
            as: "version_updater",
            attributes: ["id", "name"],
            required: false,
          },
        ],
        order: [["created_at", "DESC"]],
      });

      const formattedSkuVersions = skuVersions.map((skuVersion) => ({
        ...skuVersion.toJSON(),
        sku_values: skuVersion.sku_values
          ? JSON.parse(skuVersion.sku_values)
          : null,
        created_at: skuVersion.created_at,
        updated_at: skuVersion.updated_at,
      }));

      const totalPages = Math.ceil(totalCount / limit);

      const responseData = {
        data: formattedSkuVersions,
        pagination: {
          totalCount,
          totalPages,
          currentPage: parseInt(page),
          pageSize: parseInt(limit),
          // hasNextPage: parseInt(page) < totalPages,
          // hasPrevPage: parseInt(page) > 1,
        },
      };

      res.status(200).json(responseData);
    } catch (error) {
      logger.error("Error fetching SKU Versions:", error);
      res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);

// 🔹 Get SKU Version by ID (GET)
v1Router.get(
  "/sku-details/sku-version/:id",
  authenticateJWT,
  async (req, res) => {
    try {
      const skuVersion = await SkuVersion.findByPk(req.params.id, {
        include: [
          {
            model: Sku,
            attributes: ["id", "sku_name"],
            required: false,
          },
          {
            model: Client,
            attributes: ["client_id", "company_name"],
            required: false,
          },
          {
            model: User,
            as: "version_creator",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: User,
            as: "version_updater",
            attributes: ["id", "name"],
            required: false,
          },
        ],
      });

      if (!skuVersion) {
        return res.status(404).json({ message: "SKU Version not found" });
      }

      // Format the response data
      const formattedSkuVersion = {
        ...skuVersion.toJSON(),
        sku_values: skuVersion.sku_values
          ? JSON.parse(skuVersion.sku_values)
          : null,
      };

      res.status(200).json(formattedSkuVersion);
    } catch (error) {
      logger.error("Error fetching SKU Version:", error);
      res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);

v1Router.delete(
  "/sku-details/sku-version/:id",
  authenticateJWT,
  async (req, res) => {
    const t = await sequelize.transaction();
    try {
      // Update status to inactive instead of deleting
      const updatedSkuVersion = await SkuVersion.update(
        {
          status: "inactive",
          updated_at: new Date(),
          updated_by: req.user.id,
        },
        {
          where: { id: req.params.id },
          transaction: t,
        }
      );

      if (!updatedSkuVersion[0]) {
        await t.rollback();
        return res.status(404).json({ message: "SKU Version not found" });
      }

      await t.commit();

      // Publish to queue if needed
      await publishToQueue({
        operation: "SOFT_DELETE_VERSION",
        skuVersionId: req.params.id,
        timestamp: new Date(),
        data: { status: "inactive" },
      });

      res
        .status(200)
        .json({ message: "SKU Version marked as inactive successfully" });
    } catch (error) {
      await t.rollback();
      res.status(500).json({
        message: "Error deactivating SKU Version",
        error: error.message,
      });
    }
  }
);

v1Router.post("/sku-details/options", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Check if the referenced SKU exists
    const existingSku = await Sku.findByPk(req.body.sku_id);
    if (!existingSku) {
      await t.rollback();
      return res.status(404).json({ message: "Referenced SKU not found" });
    }

    // Check if sku_version_id exists if provided
    if (req.body.sku_version_id) {
      const existingVersion = await SkuVersion.findByPk(
        req.body.sku_version_id
      );
      if (!existingVersion) {
        await t.rollback();
        return res
          .status(404)
          .json({ message: "Referenced SKU Version not found" });
      }
    }

    // Validate that field_options is provided
    if (
      !req.body.field_options ||
      !Array.isArray(req.body.field_options) ||
      req.body.field_options.length === 0
    ) {
      await t.rollback();
      return res.status(400).json({ message: "Field options are required" });
    }

    // Prepare the options for creation
    const options = req.body.field_options.map((option) => ({
      sku_id: req.body.sku_id,
      sku_version_id: req.body.sku_version_id || null,
      field_path: option.field_path,
      field_name: option.field_name,
      field_value: option.field_value,
      company_id: req.user.company_id,
      created_by: req.user.id,
      status: "active",
    }));

    // Create all options
    const newOptions = await SkuOptions.bulkCreate(options, { transaction: t });
    await t.commit();

    // Publish to queue if needed
    await publishToQueue({
      operation: "CREATE_OPTIONS",
      skuId: req.body.sku_id,
      skuVersionId: req.body.sku_version_id,
      timestamp: new Date(),
      data: newOptions,
    });

    res.status(201).json({
      message: "SKU Options created successfully",
      options: newOptions,
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({
      message: "Error creating SKU Options",
      error: error.message,
    });
  }
});

// 3. Add a endpoint to retrieve options for a specific SKU:

v1Router.get(
  "/sku-details/:skuId/options",
  authenticateJWT,
  async (req, res) => {
    try {
      const { skuId } = req.params;
      const { field_path, field_name } = req.query;

      // Build query filters
      const filter = {
        sku_id: skuId,
        company_id: req.user.company_id,
        status: "active",
      };

      // Add optional filters if provided
      if (field_path) filter.field_path = field_path;
      if (field_name) filter.field_name = field_name;

      // Get all options for the SKU with optional filters
      const options = await SkuOptions.findAll({
        where: filter,
        order: [["created_at", "DESC"]],
      });

      // Group options by field_path for easier frontend handling
      const groupedOptions = options.reduce((acc, option) => {
        if (!acc[option.field_path]) {
          acc[option.field_path] = [];
        }
        // Prevent duplicates
        if (
          !acc[option.field_path].some(
            (o) => o.field_value === option.field_value
          )
        ) {
          acc[option.field_path].push({
            id: option.id,
            field_name: option.field_name,
            field_value: option.field_value,
          });
        }
        return acc;
      }, {});

      res.status(200).json({
        message: "SKU Options retrieved successfully",
        options: groupedOptions,
      });
    } catch (error) {
      res.status(500).json({
        message: "Error retrieving SKU Options",
        error: error.message,
      });
    }
  }
);

// sku-type apis
v1Router.get("/sku-details/sku-type/get", authenticateJWT, async (req, res) => {
  try {
    const { status = "active", company_id } = req.query;

    // Prepare where conditions
    const whereConditions = {
      status: status,
    };

    // Add company_id filter if provided
    if (company_id) {
      whereConditions.company_id = company_id;
    }

    // Find SKU types with associated data
    const skuTypes = await SkuType.findAll({
      where: whereConditions,
      include: [
        {
          model: db.User,
          as: "creator_sku_types",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: db.User,
          as: "updater_sku_types",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: db.Company,
          attributes: ["id"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]], // Order by creation date
    });

    // If no SKU types found, return meaningful response
    if (skuTypes.length === 0) {
      return res.status(404).json({
        message: "No SKU types found",
        data: [],
      });
    }

    // Send response with SKU types
    res.status(200).json({
      data: skuTypes,
    });
  } catch (error) {
    console.error("Error in SKU Type Fetch:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});
// 🔹 Create SKU Type
v1Router.post("/sku-details/sku-type", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const skuTypeData = {
      ...req.body,
      company_id: req.user.company_id,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "active",
    };

    const newSkuType = await SkuType.create(skuTypeData, { transaction: t });
    await t.commit();
    res
      .status(201)
      .json({ message: "SKU Type created successfully", skuType: newSkuType });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error creating SKU Type", error: error.message });
  }
});
// 🔹 Update SKU Type
v1Router.put("/sku-details/sku-type/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { sku_type } = req.body; // Extract only sku_type

    if (!sku_type) {
      return res.status(400).json({ message: "sku_type is required" });
    }

    const updatedSkuType = await SkuType.update(
      {
        sku_type,
        updated_at: new Date(),
        updated_by: req.user.id,
      },
      {
        where: { id: req.params.id },
        transaction: t,
      }
    );

    if (!updatedSkuType[0]) {
      await t.rollback();
      return res
        .status(404)
        .json({ message: "SKU Type not found or no changes made" });
    }

    // Fetch the updated record after update
    const updatedRecord = await SkuType.findOne({
      where: { id: req.params.id },
      transaction: t,
    });

    await t.commit();
    res.status(200).json({
      message: "SKU Type updated successfully",
      updated_sku_type: updatedRecord,
    });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error updating SKU Type", error: error.message });
  }
});
v1Router.delete(
  "/sku-details/sku-type/:id",
  authenticateJWT,
  async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const updatedSkuType = await SkuType.update(
        {
          status: "inactive",
          updated_by: req.user.id,
        },
        {
          where: { id: req.params.id },
          transaction: t,
        }
      );

      if (!updatedSkuType[0])
        return res.status(404).json({ message: "SKU Type not found" });

      await t.commit();
      res
        .status(200)
        .json({ message: "SKU Type marked as inactive successfully" });
    } catch (error) {
      await t.rollback();
      res
        .status(500)
        .json({ message: "Error deactivating SKU Type", error: error.message });
    }
  }
);

//get sku generate id
v1Router.get("/sku-details/get/generate-id", authenticateJWT, async (req, res) => {
  try {
     const whereClause = {
      company_id: req.user.company_id,
      status: "active",
    };

    const sku = await Sku.findAll({
      attributes: ["id", "sku_ui_id"],
      where: whereClause,
    });

    return res.status(200).json({
      success: true,
      data: sku,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Sku Details",
    });
  }
});



// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
    rabbitmq: rabbitChannel ? "connected" : "disconnected",
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await closeRabbitMQConnection();
  process.exit(0);
});

// Use Version 1 Router
app.use("/api", v1Router);
// await db.sequelize.sync();
const PORT = 3004;
app.listen(process.env.PORT_SKU, "0.0.0.0", () => {
  console.log(`SKU Service running on port ${process.env.PORT_SKU}`);
});
