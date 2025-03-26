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
import companyScope from "../../common/middleware/companyScope.js";
import { validateSku } from "../../common/inputvalidation/validateSku.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();
const Sku = db.Sku;
const SkuType = db.SkuType;

// 🔹 Create a SKU (POST)
v1Router.post(
  "/sku-details",
  authenticateJWT,
  validateSku,
  async (req, res) => {
    const t = await sequelize.transaction();
    try {
      // Add created_by and updated_by from the authenticated user
      const skuData = {
        ...req.body,
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

v1Router.get(
  "/sku-details",
  authenticateJWT,
  companyScope,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        sku_name,
        client,
        ply,
        status = "active",
      } = req.query;

      const offset = (page - 1) * limit;

      // Build the where condition for search
      let whereCondition = {
        status: status, // Only return records with the requested status
      };

      // Handle specific field searches if provided
      if (sku_name) whereCondition.sku_name = { [Op.like]: `%${sku_name}%` };
      if (client) whereCondition.client = { [Op.like]: `%${client}%` };
      if (ply) whereCondition.ply = { [Op.like]: `%${ply}%` };

      // Handle generic search across multiple fields if no specific fields are provided
      if (search && Object.keys(whereCondition).length === 1) {
        // Only status is set
        whereCondition = {
          [Op.and]: [
            { status: status },
            {
              [Op.or]: [
                { sku_name: { [Op.like]: `%${search}%` } },
                { client: { [Op.like]: `%${search}%` } },
                { ply: { [Op.like]: `%${search}%` } },
              ],
            },
          ],
        };
      }

      // Get total count for pagination metadata
      const totalCount = await Sku.count({
        where: whereCondition,
      });

      // Fetch skus with pagination and search
      const skus = await Sku.findAll({
        where: whereCondition,
        limit: parseInt(limit),
        offset: parseInt(offset),
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

      // Ensure sku_values is parsed as JSON
      const formattedSkus = skus.map((sku) => ({
        ...sku.toJSON(),
        sku_values: sku.sku_values ? JSON.parse(sku.sku_values) : null,
      }));

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);

      const responseData = {
        data: formattedSkus,
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
  }
);

// 🔹 Get SKU by ID (GET)
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

v1Router.put(
  "/sku-details/:id",
  authenticateJWT,
  validateSku,
  async (req, res) => {
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
        "joints",
        "ups",
        "inner_outer_dimension",
        "flap_width",
        "flap_tolerance",
        "length_trimming_tolerance",
        "width_trimming_tolerance",
        "strict_adherence",
        "customer_reference",
        "reference_number",
        "internal_id",
        "board_size_cm2",
        "deckle_size",
        "minimum_order_level",
        "sku_type",
        "sku_values",
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
      updateData.updated_at= new Date();

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
      if (
        updateData.client_id &&
        updateData.client_id !== currentSku.client_id
      ) {
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
  }
);

// 🔹 Soft Delete SKU (DELETE) - changes status to inactive
v1Router.delete("/sku-details/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Update status to inactive instead of deleting
    const updatedSku = await Sku.update(
      {
        status: "inactive",
        updated_at: new Date(),
        updated_by: 10,
      },
      {
        where: { id: req.params.id },
        transaction: t,
      }
    );

    if (!updatedSku[0])
      return res.status(404).json({ message: "SKU not found" });

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

// 🔹 Get all SKU Types
v1Router.get("/sku-details/sku-type/get", authenticateJWT, async (req, res) => {
  try {
    const { status = "active", company_id } = req.query;
    console.log("object, status, company_id", status, company_id);

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
          attributes: ["id", "name"],
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

// 🔹 Soft Delete SKU Type
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
await db.sequelize.sync();
const PORT = 3004;
app.listen(PORT, () => {
  console.log(`SKU Service running on port ${PORT}`);
});
