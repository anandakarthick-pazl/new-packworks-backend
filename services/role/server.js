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
import Role from "../../common/models/designation.model.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();


// GET single work order by ID


v1Router.post("/role", authenticateJWT, async (req, res) => {
  try {
    const { name, display_name, description, status, created_by, updated_by } = req.body;

    const newRole = await Role.create({
      name,
      display_name,
      description,
      status,
      created_by,
      updated_by,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: newRole,
    });
  } catch (error) {
    console.error("Error creating role:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.get("/role", authenticateJWT, async (req, res) => {
  try {
    const roles = await Role.findAll();
    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.get("/role/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findOne({ where: { id } });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("Error fetching role:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.put("/role/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_name, description, status, updated_by } = req.body;

    const role = await Role.findOne({ where: { id } });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    await role.update({
      name,
      display_name,
      description,
      status,
      updated_by,
      updated_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: role,
    });
  } catch (error) {
    console.error("Error updating role:", error);
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
const PORT = 3012;
app.listen(PORT, () => {
  console.log(`Role Service running on port ${PORT}`);
});
