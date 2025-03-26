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
import User from "../../common/models/user.model.js";
import Company from "../../common/models/company.model.js";
import Designation from "../../common/models/designation.model.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();


// GET single work order by ID


v1Router.post("/designations", authenticateJWT, async (req, res) => {
  try {
    const { name, parent_id, added_by, last_updated_by } = req.body;

    const newDesignation = await Designation.create({
      name,
      parent_id,
      added_by,
      last_updated_by,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Designation created successfully",
      data: newDesignation,
    });
  } catch (error) {
    console.error("Error creating Designation:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.get("/designations", authenticateJWT, async (req, res) => {
  try {
    const Designations = await Designation.findAll();
    return res.status(200).json({
      success: true,
      data: Designations,
    });
  } catch (error) {
    console.error("Error fetching Designations:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.get("/designations/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const Designation = await Designation.findOne({ where: { id } });

    if (!Designation) {
      return res.status(404).json({
        success: false,
        message: "Designation not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: Designation,
    });
  } catch (error) {
    console.error("Error fetching Designation:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.put("/designations/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parent_id, last_updated_by } = req.body;

    const Designation = await Designation.findOne({ where: { id } });

    if (!Designation) {
      return res.status(404).json({
        success: false,
        message: "Designation not found",
      });
    }

    await Designation.update({
      name,
      parent_id,
      last_updated_by,
      updated_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Designation updated successfully",
      data: Designation,
    });
  } catch (error) {
    console.error("Error updating Designation:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.delete("/designations/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const Designation = await Designation.findOne({ where: { id } });

    if (!Designation) {
      return res.status(404).json({
        success: false,
        message: "Designation not found",
      });
    }

    await Designation.destroy();

    return res.status(200).json({
      success: true,
      message: "Designation deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting Designation:", error);
    return res.status(500).json({ success: false, error: error.message });
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
const PORT = 3011;
app.listen(PORT, () => {
  console.log(`Designations Service running on port ${PORT}`);
});
