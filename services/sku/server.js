import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import redisClient, { clearClientCache } from "../../common/helper/redis.js";
import {
  publishToQueue,
  rabbitChannel,
  closeRabbitMQConnection,
} from "../../common/helper/rabbitmq.js";
import { authenticateJWT } from "../../common/middleware/auth.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();
const Sku = db.Sku;
const SkuType = db.SkuType;

// 🔹 Create a SKU (POST)
v1Router.post("/sku-details", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Add created_by and updated_by from the authenticated user
    const skuData = {
      ...req.body,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "active",
    };

    const newSku = await Sku.create(skuData, { transaction: t });
    await t.commit();
    await clearClientCache();
    await publishToQueue({
      operation: "CREATE",
      skuId: newSku.id,
      timestamp: new Date(),
      data: newSku,
    });
    res.status(201).json({ message: "SKU created successfully", sku: newSku });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error creating SKU", error: error.message });
  }
});

v1Router.get("/sku-details", authenticateJWT, async (req, res) => {
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

    // Create a cache key based on the query parameters
    const cacheKey = `sku-details_${page}_${limit}_${search}_${
      sku_name || ""
    }_${client || ""}_${ply || ""}_${status}`;

    // Try to get data from Redis cache first
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      logger.info(`Cache hit for ${cacheKey}`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    logger.info(`Cache miss for ${cacheKey}`);
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

    await redisClient.set(cacheKey, JSON.stringify(responseData), "EX", 3600);

    res.status(200).json(responseData);
  } catch (error) {
    logger.error("Error fetching SKUs:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// 🔹 Get SKU by ID with Redis caching (GET)
v1Router.get("/sku-details/:id", authenticateJWT, async (req, res) => {
  try {
    const cacheKey = `skuDetail_${req.params.id}`;

    // Try to get data from Redis cache first
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      logger.info(`Cache hit for ${cacheKey}`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    logger.info(`Cache miss for ${cacheKey}`);

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

    // Store in Redis cache
    await redisClient.set(cacheKey, JSON.stringify(formattedSku), "EX", 3600);

    res.status(200).json(formattedSku);
  } catch (error) {
    logger.error("Error fetching SKU by ID:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// 🔹 Update SKU (PUT)
v1Router.put("/sku-details/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Add updated_by from the authenticated user
    const skuData = {
      ...req.body,
      updated_by: req.user.id,
    };

    const updatedSku = await Sku.update(skuData, {
      where: { id: req.params.id },
      transaction: t,
    });

    if (!updatedSku[0])
      return res.status(404).json({ message: "SKU not found" });

    await t.commit();
    await clearClientCache();
    await publishToQueue({
      operation: "UPDATE",
      skuId: req.params.id,
      timestamp: new Date(),
      data: skuData,
    });
    res.status(200).json({ message: "SKU updated successfully" });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error updating SKU", error: error.message });
  }
});

// 🔹 Soft Delete SKU (DELETE) - changes status to inactive
v1Router.delete("/sku-details/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Update status to inactive instead of deleting
    const updatedSku = await Sku.update(
      {
        status: "inactive",
        updated_by: req.user.id,
      },
      {
        where: { id: req.params.id },
        transaction: t,
      }
    );

    if (!updatedSku[0])
      return res.status(404).json({ message: "SKU not found" });

    await t.commit();
    await clearClientCache();
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

// 🔹 Hard Delete SKU (for admin purposes if needed)
// v1Router.delete("/sku-details/:id/hard", authenticateJWT, async (req, res) => {
//   const t = await sequelize.transaction();
//   try {
//     const deletedSku = await Sku.destroy({
//       where: { id: req.params.id },
//       transaction: t,
//     });
//     if (!deletedSku) return res.status(404).json({ message: "SKU not found" });
//     await t.commit();
//     await clearClientCache();
//     await publishToQueue({
//       operation: "HARD_DELETE",
//       skuId: req.params.id,
//       timestamp: new Date(),
//     });
//     res.status(200).json({ message: "SKU permanently deleted successfully" });
//   } catch (error) {
//     await t.rollback();
//     res
//       .status(500)
//       .json({ message: "Error deleting SKU", error: error.message });
//   }
// });

// 🔹 Get all SKU Types
v1Router.get("/sku-type", authenticateJWT, async (req, res) => {
  try {
    const { status = "active" } = req.query;

    const skuTypes = await SkuType.findAll({
      where: { status: status },
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
      ],
    });
    res.status(200).json(skuTypes);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// 🔹 Create SKU Type
v1Router.post("/sku-type", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const skuTypeData = {
      ...req.body,
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
v1Router.put("/sku-type/:id", authenticateJWT, async (req, res) => {
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
v1Router.delete("/sku-type/:id", authenticateJWT, async (req, res) => {
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
});

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
    redis: redisClient.status === "ready" ? "connected" : "disconnected",
    rabbitmq: rabbitChannel ? "connected" : "disconnected",
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await redisClient.quit();
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
