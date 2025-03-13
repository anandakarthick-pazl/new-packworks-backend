import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";

// Import the Redis and RabbitMQ configurations
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

const Machine = db.Machine;
const MachineProcessName = db.MachineProcessName;

// Helper function to clear cache for machine process names
const clearMachineProcessNameCache = async () => {
  const keys = await redisClient.keys("machineProcessName:*");
  if (keys.length > 0) {
    await redisClient.del(keys);
    logger.info("Cleared machine process name cache");
  }
};

// 🔹 Create a Machine Process Name (POST)
v1Router.post("/machine-process-names", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction(); // Start transaction

  try {
    const processNameData = req.body;

    // Verify that the machine exists
    const machine = await Machine.findByPk(processNameData.machine_id, {
      transaction: t,
    });
    if (!machine) {
      await t.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Machine not found" });
    }

    // Create Machine Process Name
    const newProcessName = await MachineProcessName.create(processNameData, {
      transaction: t,
    });

    await t.commit(); // Commit transaction

    // Clear Redis cache after successful creation
    await clearMachineProcessNameCache();

    // Publish message to RabbitMQ
    await publishToQueue({
      operation: "CREATE",
      processNameId: newProcessName.id,
      timestamp: new Date(),
      data: {
        machineProcessName: newProcessName,
      },
    });

    res.status(201).json({
      message: "Machine Process Name added successfully",
      processName: newProcessName,
    });
  } catch (error) {
    await t.rollback(); // Rollback if error
    res
      .status(500)
      .json({
        message: "Error adding machine process name",
        error: error.message,
      });
  }
});

// 🔹 Get All Machine Process Names (GET)
v1Router.get("/machine-process-names", authenticateJWT, async (req, res) => {
  try {
    let { page = 1, limit = 10, search, machine_id } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    // Create a cache key based on request parameters
    const cacheKey = `machineProcessName:all:page${page}:limit${limit}:search${
      search || "none"
    }:machine${machine_id || "all"}`;

    // Try to get data from Redis first
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      logger.info("Data retrieved from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [{ process_name: { [Op.like]: `%${search}%` } }];
    }

    if (machine_id) {
      whereClause.machine_id = machine_id;
    }

    const { count, rows: processNames } =
      await MachineProcessName.findAndCountAll({
        where: whereClause,
        include: [{ model: Machine }],
        limit,
        offset: (page - 1) * limit,
        order: [["id", "ASC"]],
      });

    const response = {
      status: true,
      data: processNames,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalRecords: count,
    };

    // Store in Redis with expiration (e.g., 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(response), "EX", 3600);

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Machine Process Name Fetch Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// 🔹 Get a Single Machine Process Name by ID (GET)
v1Router.get(
  "/machine-process-names/:id",
  authenticateJWT,
  async (req, res) => {
    try {
      const processNameId = req.params.id;
      const cacheKey = `machineProcessName:${processNameId}`;

      // Try to get data from Redis first
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info(
          `Machine Process Name ${processNameId} retrieved from Redis cache`
        );
        return res.status(200).json(JSON.parse(cachedData));
      }

      const processName = await MachineProcessName.findByPk(processNameId, {
        include: [{ model: Machine }],
      });

      if (!processName) {
        return res
          .status(404)
          .json({ status: false, message: "Machine Process Name not found" });
      }

      const response = { status: true, data: processName };

      // Store in Redis with expiration (e.g., 1 hour)
      await redisClient.set(cacheKey, JSON.stringify(response), "EX", 3600);

      return res.status(200).json(response);
    } catch (error) {
      logger.error("Machine Process Name Fetch by ID Error:", error);
      return res.status(500).json({ status: false, message: error.message });
    }
  }
);

// 🔹 Update a Machine Process Name (PUT)
v1Router.put(
  "/machine-process-names/:id",
  authenticateJWT,
  async (req, res) => {
    const t = await sequelize.transaction();

    try {
      const processNameData = req.body;
      const processNameId = req.params.id;

      // Find process name
      const processName = await MachineProcessName.findByPk(processNameId, {
        transaction: t,
      });
      if (!processName) {
        await t.rollback();
        return res
          .status(404)
          .json({ status: false, message: "Machine Process Name not found" });
      }

      // If changing machine_id, verify that the machine exists
      if (
        processNameData.machine_id &&
        processNameData.machine_id !== processName.machine_id
      ) {
        const machine = await Machine.findByPk(processNameData.machine_id, {
          transaction: t,
        });
        if (!machine) {
          await t.rollback();
          return res
            .status(404)
            .json({ status: false, message: "Machine not found" });
        }
      }

      // Update process name data
      await processName.update(processNameData, {
        transaction: t,
        fields: Object.keys(processNameData),
      });

      await t.commit();

      // Clear Redis cache after successful update
      await clearMachineProcessNameCache();

      // Publish message to RabbitMQ
      await publishToQueue({
        operation: "UPDATE",
        processNameId: processName.id,
        timestamp: new Date(),
        data: {
          machineProcessName: processName,
        },
      });

      return res.status(200).json({
        status: true,
        message: "Machine Process Name updated successfully",
        processName: processName,
      });
    } catch (error) {
      await t.rollback();
      logger.error("Machine Process Name Update Error:", error);
      return res.status(500).json({ status: false, message: error.message });
    }
  }
);

// 🔹 Delete a Machine Process Name (DELETE)
v1Router.delete(
  "/machine-process-names/:id",
  authenticateJWT,
  async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const processNameId = req.params.id;
      const processName = await MachineProcessName.findByPk(processNameId, {
        transaction: t,
      });
      if (!processName) {
        await t.rollback();
        return res
          .status(404)
          .json({ status: false, message: "Machine Process Name not found" });
      }

      // Delete process name
      await processName.destroy({ transaction: t });

      await t.commit();

      // Clear Redis cache after successful deletion
      await clearMachineProcessNameCache();

      // Publish message to RabbitMQ
      await publishToQueue({
        operation: "DELETE",
        processNameId: processNameId,
        timestamp: new Date(),
        data: {
          id: processNameId,
        },
      });

      return res.status(200).json({
        status: true,
        message: "Machine Process Name deleted successfully",
      });
    } catch (error) {
      await t.rollback();
      logger.error("Machine Process Name Delete Error:", error);
      return res.status(500).json({ status: false, message: error.message });
    }
  }
);

// 🔹 Get Machine Process Names by Machine ID (GET)
v1Router.get(
  "/machines/:machineId/process-names",
  authenticateJWT,
  async (req, res) => {
    try {
      const machineId = req.params.machineId;
      const cacheKey = `machineProcessName:machine:${machineId}`;

      // Try to get data from Redis first
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info(
          `Process Names for Machine ${machineId} retrieved from Redis cache`
        );
        return res.status(200).json(JSON.parse(cachedData));
      }

      // Verify machine exists
      const machine = await Machine.findByPk(machineId);
      if (!machine) {
        return res
          .status(404)
          .json({ status: false, message: "Machine not found" });
      }

      const processNames = await MachineProcessName.findAll({
        where: { machine_id: machineId },
        order: [["process_name", "ASC"]],
      });

      const response = { status: true, data: processNames };

      // Store in Redis with expiration (e.g., 1 hour)
      await redisClient.set(cacheKey, JSON.stringify(response), "EX", 3600);

      return res.status(200).json(response);
    } catch (error) {
      logger.error("Machine Process Names Fetch by Machine ID Error:", error);
      return res.status(500).json({ status: false, message: error.message });
    }
  }
);

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
    redis: redisClient.status === "ready" ? "connected" : "disconnected",
    rabbitmq: rabbitChannel ? "connected" : "disconnected",
  });
});

process.on("SIGINT", async () => {
  logger.info("Shutting down...");

  // Close Redis connection using the exported function
  await redisClient.quit();

  // Close RabbitMQ connection using the exported function
  await closeRabbitMQConnection();

  process.exit(0);
});

// Use Version 1 Router
app.use("/api", v1Router);

await db.sequelize.sync();
const PORT = 3007;
const service = "Machine Process Name Service";
app.listen(PORT, () => {
  console.log(`${service} running on port ${PORT}`);
});
