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
const MachineProcessField = db.MachineProcessField;
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

// Get all machine process fields with pagination and search
v1Router.get("/process-fields", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, process_name_id } = req.query;
    const offset = (page - 1) * limit;
    const where = {
      company_id: req.user.company_id,
      status: "active",
    };

    // Apply process_name_id filter if provided
    if (process_name_id) {
      where.process_name_id = process_name_id;
    }

    // Apply search filter if provided
    if (search) {
      where.label = {
        [Op.like]: `%${search}%`,
      };
    }

    // Get total count for pagination
    const count = await MachineProcessField.count({ where });

    // Fetch process fields with related data
    const processFields = await MachineProcessField.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
        {
          model: User,
          as: "creator",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
      order: [["updated_at", "DESC"]],
    });

    return res.status(200).json({
      status: "success",
      data: processFields,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error(`Error fetching process fields: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch process fields",
      error: error.message,
    });
  }
});

// Get a specific process field by ID
v1Router.get("/process-fields/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const processField = await MachineProcessField.findOne({
      where: {
        id,
        company_id,
        status: "active",
      },
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
        {
          model: User,
          as: "creator",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!processField) {
      return res.status(404).json({
        status: "error",
        message: "Process field not found or access denied",
      });
    }

    return res.status(200).json({
      status: "success",
      data: processField,
    });
  } catch (error) {
    logger.error(`Error fetching process field: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch process field",
      error: error.message,
    });
  }
});

v1Router.post("/process-fields", authenticateJWT, async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();

    const {
      process_name_id,
      label,
      field_type,
      required = false,
      status = "active",
    } = req.body;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Validate required fields
    if (!process_name_id || !label || !field_type) {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message: "Process name ID, label and field type are required",
      });
    }

    // Check if the process exists and belongs to the company
    const process = await ProcessName.findOne({
      where: {
        id: process_name_id,
        company_id,
        status: "active",
      },
    });

    if (!process) {
      await transaction.rollback();
      return res.status(404).json({
        status: "error",
        message: "Process not found or access denied",
      });
    }

    // Check for duplicate label within the same process
    const existingField = await MachineProcessField.findOne({
      where: {
        company_id,
        process_name_id,
        label,
        status: "active",
      },
    });

    if (existingField) {
      await transaction.rollback();
      return res.status(409).json({
        status: "error",
        message: "Field label already exists for this process",
      });
    }

    // Create the process field
    const processField = await MachineProcessField.create(
      {
        company_id,
        process_name_id,
        label,
        field_type,
        required: required ? 1 : 0,
        status,
        created_by: user_id,
        updated_by: user_id,
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch the created field with related data
    const createdField = await MachineProcessField.findByPk(processField.id, {
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
        {
          model: User,
          as: "creator",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
    });

    return res.status(201).json({
      status: "success",
      message: "Process field created successfully",
      data: createdField,
    });
  } catch (error) {
    // If transaction exists and hasn't been committed yet, rollback
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error(`Rollback failed: ${rollbackError.message}`);
      }
    }
    logger.error(`Error creating process field: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to create process field",
      error: error.message,
    });
  }
});

v1Router.put("/process-fields/:id", authenticateJWT, async (req, res) => {
  let transaction;

  try {
    transaction = await sequelize.transaction();

    const { id } = req.params;
    const { process_name_id, label, field_type, required, status } = req.body;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Find the process field and ensure it belongs to the user's company
    const processField = await MachineProcessField.findOne({
      where: {
        id,
        company_id,
      },
    });

    if (!processField) {
      await transaction.rollback();
      return res.status(404).json({
        status: "error",
        message: "Process field not found or access denied",
      });
    }

    // If process_name_id is changing, verify the new process exists
    if (process_name_id && process_name_id !== processField.process_name_id) {
      const process = await ProcessName.findOne({
        where: {
          id: process_name_id,
          company_id,
          status: "active",
        },
      });

      if (!process) {
        await transaction.rollback();
        return res.status(404).json({
          status: "error",
          message: "New process not found or access denied",
        });
      }
    }

    // Check for duplicate label within the same process
    if (
      (label && label !== processField.label) ||
      (process_name_id && process_name_id !== processField.process_name_id)
    ) {
      const existingField = await MachineProcessField.findOne({
        where: {
          company_id,
          process_name_id: process_name_id || processField.process_name_id,
          label: label || processField.label,
          id: { [Op.ne]: id },
          status: "active",
        },
      });

      if (existingField) {
        await transaction.rollback();
        return res.status(409).json({
          status: "error",
          message: "Field label already exists for this process",
        });
      }
    }

    // Prepare the update data
    const updateData = {
      ...(process_name_id && { process_name_id }),
      ...(label && { label }),
      ...(field_type && { field_type }),
      ...(required !== undefined && { required: required ? 1 : 0 }),
      ...(status && { status }),
      updated_by: user_id,
    };

    // Update the field
    await processField.update(updateData, { transaction });
    await transaction.commit();

    // Fetch the updated field
    const updatedField = await MachineProcessField.findByPk(id, {
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
        {
          model: User,
          as: "creator",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
    });

    return res.status(200).json({
      status: "success",
      message: "Process field updated successfully",
      data: updatedField,
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error(`Rollback failed: ${rollbackError.message}`);
      }
    }

    logger.error(`Error updating process field: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to update process field",
      error: error.message,
    });
  }
});

// Delete (soft delete) a process field
v1Router.delete("/process-fields/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Check if the process field exists for the given company
    const processField = await MachineProcessField.findOne({
      where: {
        id,
        company_id,
      },
    });

    if (!processField) {
      return res.status(404).json({
        status: "error",
        message: "Process field not found or access denied",
      });
    }

    // Soft delete: explicitly update only the needed fields
    await processField.update(
      {
        status: "inactive",
        updated_by: user_id,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      status: "success",
      message: "Process field marked as inactive successfully",
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error soft-deleting process field: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete process field",
      error: error.message,
    });
  }
});

// Get all fields for a specific process
v1Router.get(
  "/process/:process_id/fields",
  authenticateJWT,
  async (req, res) => {
    try {
      const { process_id } = req.params;
      const company_id = req.user.company_id;

      // Verify the process exists and belongs to the company
      const process = await ProcessName.findOne({
        where: {
          id: process_id,
          company_id,
          status: "active",
        },
      });

      if (!process) {
        return res.status(404).json({
          status: "error",
          message: "Process not found or access denied",
        });
      }

      // Fetch all active fields for this process
      const processFields = await MachineProcessField.findAll({
        where: {
          process_name_id: process_id,
          company_id,
          status: "active",
        },
        include: [
          {
            model: User,
            as: "creator",
            foreignKey: "created_by",
            attributes: ["id", "name"],
          },
          {
            model: User,
            as: "updater",
            foreignKey: "updated_by",
            attributes: ["id", "name"],
          },
        ],
        order: [["updated_at", "ASC"]],
      });

      return res.status(200).json({
        status: "success",
        data: processFields,
        process: {
          id: process.id,
          name: process.process_name,
        },
      });
    } catch (error) {
      logger.error(`Error fetching process fields: ${error.message}`);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch process fields",
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
