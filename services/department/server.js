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
import Department from "../../common/models/department.model.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();


// GET single work order by ID


v1Router.post("/departments", authenticateJWT, async (req, res) => {
  try {
    const { company_id, department_name, parent_id, added_by, last_updated_by } = req.body;

    const newDepartment = await Department.create({
      department_name,
      parent_id,
      added_by,
      last_updated_by,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: newDepartment,
    });
  } catch (error) {
    console.error("Error creating department:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.get("/departments", authenticateJWT, async (req, res) => {
  try {
    const departments = await Department.findAll();
    return res.status(200).json({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.get("/departments/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findOne({ where: { id } });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error("Error fetching department:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.put("/departments/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { department_name, parent_id, last_updated_by } = req.body;

    const department = await Department.findOne({ where: { id } });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    await department.update({
      department_name,
      parent_id,
      last_updated_by,
      updated_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  } catch (error) {
    console.error("Error updating department:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.delete("/departments/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findOne({ where: { id } });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    await department.destroy();

    return res.status(200).json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting department:", error);
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
const PORT = 3010;
app.listen(PORT, () => {
  console.log(`Department Service running on port ${PORT}`);
});
