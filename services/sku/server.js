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
import { cli } from "winston/lib/winston/config/index.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();
const Sku = db.Sku;
const SkuType = db.SkuType;

// 🔹 Create a SKU (POST)
v1Router.post("/skuDetails", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const newSku = await Sku.create(req.body, { transaction: t });
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

// 🔹 Get All SKUs (GET)
// 🔹 Get All SKUs with Multi-field Search and Pagination (GET)
// 🔹 Get All SKUs with Multi-field Search, Pagination and Redis Caching (GET)
v1Router.get("/skuDetails", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sku_name,
      client,
      ply,
    } = req.query;

    // Create a cache key based on the query parameters
    const cacheKey = `skuDetails_${page}_${limit}_${search}_${sku_name || ""}_${
      client || ""
    }_${ply || ""}`;

    // Try to get data from Redis cache first
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      logger.info(`Cache hit for ${cacheKey}`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    logger.info(`Cache miss for ${cacheKey}`);
    const offset = (page - 1) * limit;

    // Build the where condition for search
    let whereCondition = {};

    // Handle specific field searches if provided
    if (sku_name) whereCondition.sku_name = { [Op.like]: `%${sku_name}%` };
    if (client) whereCondition.client = { [Op.like]: `%${client}%` };
    if (ply)
      whereCondition.ply = { [Op.like]: `%${ply}%` };

    // Handle generic search across multiple fields if no specific fields are provided
    if (search && Object.keys(whereCondition).length === 0) {
      whereCondition = {
        [Op.or]: [
          { sku_name: { [Op.like]: `%${search}%` } },
          { client: { [Op.like]: `%${search}%` } },
          { ply: { [Op.like]: `%${search}%` } },
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

    // Store the result in Redis cache with expiration time (e.g., 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(responseData), {
      EX: 3600, // Cache expiry time in seconds (1 hour)
    });

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
v1Router.get("/skuDetails/:id", async (req, res) => {
  try {
    const cacheKey = `skuDetail_${req.params.id}`;

    // Try to get data from Redis cache first
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      logger.info(`Cache hit for ${cacheKey}`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    logger.info(`Cache miss for ${cacheKey}`);

    const sku = await Sku.findByPk(req.params.id);

    if (!sku) {
      return res.status(404).json({ message: "SKU not found" });
    }

    // Parse sku_values if it's stored as a JSON string
    const formattedSku = {
      ...sku.toJSON(),
      sku_values: sku.sku_values ? JSON.parse(sku.sku_values) : null,
    };

    // Store in Redis cache
    await redisClient.set(cacheKey, JSON.stringify(formattedSku), {
      EX: 3600, // Cache expiry time in seconds (1 hour)
    });

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
v1Router.put("/skuDetails/:id", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const updatedSku = await Sku.update(req.body, {
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
      data: req.body,
    });
    res.status(200).json({ message: "SKU updated successfully" });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error updating SKU", error: error.message });
  }
});

// 🔹 Delete SKU (DELETE)
v1Router.delete("/skuDetails/:id", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const deletedSku = await Sku.destroy({
      where: { id: req.params.id },
      transaction: t,
    });
    if (!deletedSku) return res.status(404).json({ message: "SKU not found" });
    await t.commit();
    await clearClientCache();
    await publishToQueue({
      operation: "DELETE",
      skuId: req.params.id,
      timestamp: new Date(),
    });
    res.status(200).json({ message: "SKU deleted successfully" });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error deleting SKU", error: error.message });
  }
});

// sku type

v1Router.get("/skuType", async (req, res) => {
  try {
    const skuTypes = await SkuType.findAll();
    res.status(200).json(skuTypes);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
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
app.use("/v1", v1Router);
await db.sequelize.sync();
const PORT = 3003;
app.listen(PORT, () => {
  console.log(`SKU Service running on port ${PORT}`);
});
