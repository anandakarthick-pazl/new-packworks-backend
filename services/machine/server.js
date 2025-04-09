import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";

// Import the Redis and RabbitMQ configurations
import { authenticateJWT } from "../../common/middleware/auth.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const Machine = db.Machine;
const ProcessName = db.ProcessName;
const MachineProcessValue = db.MachineProcessValue;
const Company = db.Company;
const User = db.User;
// process crud api's

v1Router.get("/process", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    const where = {
      company_id: req.user.company_id, // Use company_id from auth context
      status: "active", // Always filter by active status only
    };

    // Apply search filter if provided
    if (search) {
      where.process_name = {
        [Op.like]: `%${search}%`,
      };
    }

    // Get total count for pagination
    const count = await ProcessName.count({ where });

    // Fetch processes with company and user info
    const processes = await ProcessName.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: User, as: "process_creator", attributes: ["id", "name"] },
        { model: User, as: "process_updater", attributes: ["id", "name"] },
      ],
      order: [["updated_at", "DESC"]],
    });

    return res.status(200).json({
      status: "success",
      data: processes,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error(`Error fetching processes: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch processes",
      error: error.message,
    });
  }
});

// Create a new process
v1Router.post("/process", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { process_name, status = "active" } = req.body;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    if (!process_name) {
      return res.status(400).json({
        status: "error",
        message: "Process name is required",
      });
    }
    // Check for duplicate process name within the same company
    const existingProcess = await ProcessName.findOne({
      where: {
        company_id,
        process_name,
      },
    });

    if (existingProcess) {
      return res.status(409).json({
        status: "error",
        message: "Process name already exists for this company",
      });
    }

    const process = await ProcessName.create(
      {
        company_id,
        process_name,
        status,
        created_by: user_id,
        updated_by: user_id,
      },
      { transaction }
    );

    await transaction.commit();

    const createdProcess = await ProcessName.findByPk(process.id, {
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: User, as: "process_creator", attributes: ["id", "name"] },
        { model: User, as: "process_updater", attributes: ["id", "name"] },
      ],
    });

    return res.status(201).json({
      status: "success",
      message: "Process created successfully",
      data: createdProcess,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error creating process: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to create process",
      error: error.message,
    });
  }
});

// Update a process
v1Router.put("/process/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { process_name, status } = req.body;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Find the process and ensure it belongs to the user's company
    const process = await ProcessName.findOne({
      where: {
        id,
        company_id,
      },
    });

    if (!process) {
      return res.status(404).json({
        status: "error",
        message: "Process not found or access denied",
      });
    }

    // Check for duplicate process name within the same company if process_name is changed
    if (process_name && process_name !== process.process_name) {
      const existingProcess = await ProcessName.findOne({
        where: {
          company_id,
          process_name,
          id: { [Op.ne]: id }, // Exclude current process
        },
      });

      if (existingProcess) {
        return res.status(409).json({
          status: "error",
          message: "Process name already exists for this company",
        });
      }
    }

    // Update the process
    await process.update(
      {
        ...(process_name && { process_name }),
        ...(status && { status }),
        updated_by: user_id,
      },
      { transaction }
    );

    await transaction.commit();

    const updatedProcess = await ProcessName.findByPk(id, {
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: User, as: "process_creator", attributes: ["id", "name"] },
        { model: User, as: "process_updater", attributes: ["id", "name"] },
      ],
    });

    return res.status(200).json({
      status: "success",
      message: "Process updated successfully",
      data: updatedProcess,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error updating process: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to update process",
      error: error.message,
    });
  }
});

v1Router.delete("/process/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    // Check if the process exists for the given company
    const process = await ProcessName.findOne({
      where: { id, company_id },
    });

    if (!process) {
      return res.status(404).json({
        status: "error",
        message: "Process not found or access denied",
      });
    }

    // Check if this process is used in MachineProcessValue
    const processInUse = await MachineProcessValue.findOne({
      where: {
        process_name_id: id,
      },
    });

    if (processInUse) {
      return res.status(400).json({
        status: "error",
        message:
          "Cannot delete process as it is associated with machine process values",
      });
    }

    // Soft delete: explicitly update only the needed fields
    await process.update(
      {
        status: "inactive",
        updated_at: req.user.id,
        updated_by: req.user.id,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      status: "success",
      message: "Process marked as inactive successfully",
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error soft-deleting process: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete process",
      error: error.message,
    });
  }
});

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
  });
});

process.on("SIGINT", async () => {
  logger.info("Shutting down...");

  process.exit(0);
});

// Use Version 1 Router
app.use("/api/machines", v1Router);

await db.sequelize.sync();
const PORT = 3007;
const service = "Machine Service";
app.listen(PORT, () => {
  console.log(`${service} running on port ${PORT}`);
});

export default app;
