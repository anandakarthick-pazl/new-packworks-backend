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
v1Router.get("/skuDetails", async (req, res) => {
  try {
    const skus = await Sku.findAll();

    // Ensure sku_values is parsed as JSON
    const formattedSkus = skus.map((sku) => ({
      ...sku.toJSON(),
      sku_values: sku.sku_values ? JSON.parse(sku.sku_values) : null, // Fix JSON parsing
    }));

    res.status(200).json(formattedSkus);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

// 🔹 Get SKU by ID (GET)
v1Router.get("/skuDetails/:id", async (req, res) => {
  try {
    const sku = await Sku.findByPk(req.params.id);

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
    res.status(500).json({ message: "Internal Server Error", error });
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
const PORT = 3004;
app.listen(PORT, () => {
  console.log(`SKU Service running on port ${PORT}`);
});
