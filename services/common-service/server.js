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
import Country from "../../common/models/country.model.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const DropdownName = db.DropdownName;
const DropdownValue = db.DropdownValue;

// Redis cache keys for dropdowns
const DROPDOWN_CACHE_KEYS = {
  DROPDOWN_NAME_LIST: "dropdown_names:all",
  DROPDOWN_NAME_DETAIL: "dropdown_name:",
  DROPDOWN_VALUE_LIST: "dropdown_values:all",
  DROPDOWN_VALUE_DETAIL: "dropdown_value:",
};

// RabbitMQ queues for dropdowns
const DROPDOWN_QUEUES = {
  DROPDOWN_NAME_CREATED: "dropdown_name.created",
  DROPDOWN_NAME_UPDATED: "dropdown_name.updated",
  DROPDOWN_NAME_DELETED: "dropdown_name.deleted",
  DROPDOWN_VALUE_CREATED: "dropdown_value.created",
  DROPDOWN_VALUE_UPDATED: "dropdown_value.updated",
  DROPDOWN_VALUE_DELETED: "dropdown_value.deleted",
};

// ===== DROPDOWN NAME APIs =====

// POST create new dropdown name - Modified to handle null created_by and updated_by
v1Router.post("/dropdown-name", authenticateJWT, async (req, res) => {
  const dropdownDetails = req.body;

  if (!dropdownDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  // Validate required fields - only dropdown_name is strictly required
  if (!dropdownDetails.dropdown_name) {
    return res.status(400).json({
      message: "Missing required field: dropdown_name is required",
    });
  }

  try {
    // Create Dropdown Name - allowing null values for created_by and updated_by
    const newDropdownName = await DropdownName.create({
      company_id: dropdownDetails.company_id,
      client_id: dropdownDetails.client_id,
      dropdown_name: dropdownDetails.dropdown_name,
      status: dropdownDetails.status || "active",
      created_by: dropdownDetails.created_by, // Can be null
      updated_by: dropdownDetails.updated_by, // Can be null
    });

    // Clear cache
    await clearClientCache(`${DROPDOWN_CACHE_KEYS.DROPDOWN_NAME_LIST}:*`);

    // Send to RabbitMQ
    await publishToQueue(
      DROPDOWN_QUEUES.DROPDOWN_NAME_CREATED,
      newDropdownName.get({ plain: true })
    );

    res.status(201).json({
      message: "Dropdown Name created successfully",
      data: newDropdownName,
    });
  } catch (error) {
    logger.error("Error creating dropdown name:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// PUT update existing dropdown name - Modified to handle null updated_by
v1Router.put("/dropdown-name/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const dropdownDetails = req.body;

  if (!dropdownDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  // No validation check for updated_by - allowing it to be null

  try {
    // Find the dropdown name
    const dropdownName = await DropdownName.findByPk(id);

    if (!dropdownName) {
      return res.status(404).json({ message: "Dropdown name not found" });
    }

    // Update dropdown name
    await dropdownName.update({
      company_id: dropdownDetails.company_id || dropdownName.company_id,
      client_id: dropdownDetails.client_id || dropdownName.client_id,
      dropdown_name:
        dropdownDetails.dropdown_name || dropdownName.dropdown_name,
      status: dropdownDetails.status || dropdownName.status,
      updated_by: dropdownDetails.updated_by,
      updated_at: dropdownDetails.updated_at,
    });

    // Clear caches
    await clearClientCache(`${DROPDOWN_CACHE_KEYS.DROPDOWN_NAME_LIST}:*`);
    await clearClientCache(`${DROPDOWN_CACHE_KEYS.DROPDOWN_NAME_DETAIL}${id}`);

    // Send to RabbitMQ
    await publishToQueue(
      DROPDOWN_QUEUES.DROPDOWN_NAME_UPDATED,
      dropdownName.get({ plain: true })
    );

    res.json({
      message: "Dropdown Name updated successfully",
      data: dropdownName,
    });
  } catch (error) {
    logger.error("Error updating dropdown name:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET all dropdown names with pagination and filtering
v1Router.get("/dropdown-name", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      dropdown_name,
      company_id,
      client_id,
      status = "active", // Default to showing only active records
    } = req.query;

    const offset = (page - 1) * limit;

    // Try to get from cache first
    const cacheKey = `${
      DROPDOWN_CACHE_KEYS.DROPDOWN_NAME_LIST
    }:${page}:${limit}:${dropdown_name || ""}:${company_id || ""}:${
      client_id || ""
    }:${status || ""}`;

    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // Build filter conditions
    const where = {};
    if (dropdown_name)
      where.dropdown_name = { [Op.like]: `%${dropdown_name}%` };
    if (company_id) where.company_id = company_id;
    if (client_id) where.client_id = client_id;

    // Filter by status - allow "all" to return both active and inactive records
    if (status && status !== "all") {
      where.status = status;
    }

    // Fetch data from database
    const { count, rows } = await DropdownName.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    // Prepare result
    const result = {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      data: rows.map((dropdownName) => dropdownName.get({ plain: true })),
    };

    // Cache the result
    await redisClient.set(cacheKey, JSON.stringify(result)); // Cache for 5 minutes

    res.json(result);
  } catch (error) {
    logger.error("Error fetching dropdown names:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// DELETE dropdown name (soft delete)
v1Router.delete("/dropdown-name/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { updated_by } = req.body;

  // Validate updated_by field
  if (!updated_by) {
    return res.status(400).json({
      message: "Missing required field: updated_by is required",
    });
  }

  try {
    // Find the dropdown name
    const dropdownName = await DropdownName.findByPk(id);

    if (!dropdownName) {
      return res.status(404).json({ message: "Dropdown name not found" });
    }

    // Soft delete - update status to inactive
    await dropdownName.update({
      status: "inactive",
      updated_by: updated_by,
      updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
    });

    // Clear caches
    await clearClientCache(`${DROPDOWN_CACHE_KEYS.DROPDOWN_NAME_LIST}:*`);
    await clearClientCache(`${DROPDOWN_CACHE_KEYS.DROPDOWN_NAME_DETAIL}${id}`);

    // Send to RabbitMQ
    await publishToQueue(DROPDOWN_QUEUES.DROPDOWN_NAME_DELETED, {
      ...dropdownName.get({ plain: true }),
      soft_deleted: true,
    });

    res.json({
      message: "Dropdown Name successfully marked as inactive",
      data: dropdownName.get({ plain: true }),
    });
  } catch (error) {
    logger.error("Error soft deleting dropdown name:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// POST create new dropdown value
v1Router.post("/dropdown-value", authenticateJWT, async (req, res) => {
  const valueDetails = req.body;

  if (!valueDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  // Validate required fields
  if (
    !valueDetails.dropdown_id ||
    !valueDetails.dropdown_value ||
    !valueDetails.created_by ||
    !valueDetails.updated_by
  ) {
    return res.status(400).json({
      message:
        "Missing required fields: dropdown_id, dropdown_value, created_by and updated_by are required",
    });
  }

  try {
    // Check if dropdown name exists
    const dropdownName = await DropdownName.findByPk(valueDetails.dropdown_id);
    if (!dropdownName) {
      return res.status(404).json({ message: "Dropdown name not found" });
    }

    // Create Dropdown Value
    const newDropdownValue = await DropdownValue.create({
      company_id: valueDetails.company_id,
      client_id: valueDetails.client_id,
      dropdown_id: valueDetails.dropdown_id,
      dropdown_value: valueDetails.dropdown_value,
      status: valueDetails.status || "active",
      created_by: valueDetails.created_by,
      updated_by: valueDetails.updated_by,
    });

    // Clear cache
    await clearClientCache(`${DROPDOWN_CACHE_KEYS.DROPDOWN_VALUE_LIST}:*`);

    // Send to RabbitMQ
    await publishToQueue(
      DROPDOWN_QUEUES.DROPDOWN_VALUE_CREATED,
      newDropdownValue.get({ plain: true })
    );

    res.status(201).json({
      message: "Dropdown Value created successfully",
      data: newDropdownValue,
    });
  } catch (error) {
    logger.error("Error creating dropdown value:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

v1Router.put("/dropdown-value/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const valueDetails = req.body;

  if (!valueDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  // Validate updated_by field
  if (!valueDetails.updated_by) {
    return res.status(400).json({
      message: "Missing required field: updated_by is required",
    });
  }

  try {
    // Find the dropdown value
    console.log(id, "123");
    const dropdownValue = await DropdownValue.findByPk(id);

    if (!dropdownValue) {
      return res.status(404).json({ message: "Dropdown value not found" });
    }

    // If dropdown_id is being changed, check if new dropdown name exists
    if (
      valueDetails.dropdown_id &&
      valueDetails.dropdown_id !== dropdownValue.dropdown_id
    ) {
      const dropdownName = await DropdownName.findByPk(
        valueDetails.dropdown_id
      );
      if (!dropdownName) {
        return res.status(404).json({ message: "New dropdown name not found" });
      }
    }

    // Update dropdown value
    await dropdownValue.update({
      company_id: valueDetails.company_id || dropdownValue.company_id,
      client_id: valueDetails.client_id || dropdownValue.client_id,
      dropdown_id: valueDetails.dropdown_id || dropdownValue.dropdown_id,
      dropdown_value:
        valueDetails.dropdown_value || dropdownValue.dropdown_value,
      status: valueDetails.status || dropdownValue.status,
      updated_by: valueDetails.updated_by,
      updated_at: valueDetails.updated_at,
    });

    // Clear caches
    await clearClientCache(`${DROPDOWN_CACHE_KEYS.DROPDOWN_VALUE_LIST}:*`);
    await clearClientCache(`${DROPDOWN_CACHE_KEYS.DROPDOWN_VALUE_DETAIL}${id}`);

    // Send to RabbitMQ
    await publishToQueue(
      DROPDOWN_QUEUES.DROPDOWN_VALUE_UPDATED,
      dropdownValue.get({ plain: true })
    );

    res.json({
      message: "Dropdown Value updated successfully",
      data: dropdownValue,
    });
  } catch (error) {
    logger.error("Error updating dropdown value:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET all dropdown values with pagination and filtering
v1Router.get("/dropdown-value", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      dropdown_id,
      dropdown_value,
      company_id,
      client_id,
      status = "active", // Default to showing only active records
    } = req.query;

    const offset = (page - 1) * limit;

    // Try to get from cache first
    const cacheKey = `${
      DROPDOWN_CACHE_KEYS.DROPDOWN_VALUE_LIST
    }:${page}:${limit}:${dropdown_id || ""}:${dropdown_value || ""}:${
      company_id || ""
    }:${client_id || ""}:${status || ""}`;

    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // Build filter conditions
    const where = {};
    if (dropdown_id) where.dropdown_id = dropdown_id;
    if (dropdown_value)
      where.dropdown_value = { [Op.like]: `%${dropdown_value}%` };
    if (company_id) where.company_id = company_id;
    if (client_id) where.client_id = client_id;

    // Filter by status - allow "all" to return both active and inactive records
    if (status && status !== "all") {
      where.status = status;
    }

    // Fetch data from database
    const { count, rows } = await DropdownValue.findAndCountAll({
      where,
      include: [
        {
          model: DropdownName,
          attributes: ["dropdown_name"],
          as: "dropdownName", // Add this line with the correct alias
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    // Prepare result
    const result = {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      data: rows.map((dropdownValue) => dropdownValue.get({ plain: true })),
    };

    // Cache the result
    await redisClient.set(cacheKey, JSON.stringify(result)); // Cache for 5 minutes

    res.json(result);
  } catch (error) {
    logger.error("Error fetching dropdown values:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// DELETE dropdown value (soft delete)
v1Router.delete("/dropdown-value/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { updated_by } = req.body;

  // Validate updated_by field
  if (!updated_by) {
    return res.status(400).json({
      message: "Missing required field: updated_by is required",
    });
  }

  try {
    // Find the dropdown value
    const dropdownValue = await DropdownValue.findByPk(id);

    if (!dropdownValue) {
      return res.status(404).json({ message: "Dropdown value not found" });
    }

    // Soft delete - update status to inactive
    await dropdownValue.update({
      status: "inactive",
      updated_by: updated_by,
      updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
    });

    // Clear caches
    await clearClientCache(`${DROPDOWN_CACHE_KEYS.DROPDOWN_VALUE_LIST}:*`);
    await clearClientCache(`${DROPDOWN_CACHE_KEYS.DROPDOWN_VALUE_DETAIL}${id}`);

    // Send to RabbitMQ
    await publishToQueue(DROPDOWN_QUEUES.DROPDOWN_VALUE_DELETED, {
      ...dropdownValue.get({ plain: true }),
      soft_deleted: true,
    });

    res.json({
      message: "Dropdown Value successfully marked as inactive",
      data: dropdownValue.get({ plain: true }),
    });
  } catch (error) {
    logger.error("Error soft deleting dropdown value:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

v1Router.get("/countries", authenticateJWT,async (req, res) => {
  try {
    const countries = await Country.findAll({
      attributes: ["id", "iso", "name", "nicename", "iso3", "numcode", "phonecode"], // ✅ Fetch only required fields
      order: [["name", "ASC"]],
    });

    return res.json({
      success: true,
      data: countries,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching countries",
      error: error.message,
    });
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
app.use("/api/common-service", v1Router);

// Start the server
await db.sequelize.sync();
const PORT = 3008;
app.listen(PORT, () => {
  console.log(`Common Service running on port ${PORT}`);
});

export default app;
