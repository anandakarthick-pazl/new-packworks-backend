import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";

// Import the Redis and RabbitMQ configurations
import redisClient from "../../common/helper/redis.js";
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
const MachineProcessValue = db.MachineProcessValue;
const Company = db.Company;
const User = db.User;

// Helper function to clear cache for machines
const clearMachineCache = async () => {
  const keys = await redisClient.keys("machine:*");
  if (keys.length > 0) {
    await redisClient.del(keys);
    logger.info("Cleared machine cache");
  }
};

v1Router.post("/machines", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction(); // Start transaction

  try {
    const machineData = req.body;
    const processes = machineData.process_name || [];
    delete machineData.process_name;

    // Verify that the company exists
    const company = await Company.findByPk(machineData.company_id, {
      transaction: t,
    });
    if (!company) {
      await t.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Company not found" });
    }

    // Create Machine
    const newMachine = await Machine.create(machineData, {
      transaction: t,
    });

    // Create Machine Processes and Process Values
    for (const process of processes) {
      // Handle inconsistent property names
      const processValues =
        process.process_values || process.process_value || {};
      // delete process.process_values;
      delete process.process_value;

      // Add machine_id to process data
      process.machine_id = newMachine.id;

      // Create Machine Process Name
      const newProcess = await MachineProcessName.create(process, {
        transaction: t,
      });

      // Create Machine Process Value if process_values exist
      if (Object.keys(processValues).length > 0) {
        await MachineProcessValue.create(
          {
            machine_id: newMachine.id,
            process_name_id: newProcess.id,
            process_value: processValues,
            status: "active",
            created_by: machineData.created_by,
            updated_by: machineData.updated_by,
          },
          {
            transaction: t,
          }
        );
      }
    }

    await t.commit(); // Commit transaction

    // Clear Redis cache after successful creation
    await clearMachineCache();

    // Publish message to RabbitMQ
    await publishToQueue({
      operation: "CREATE",
      machineId: newMachine.id,
      timestamp: new Date(),
      data: {
        machine: newMachine,
      },
    });

    // Fetch the created machine with all its processes and values
    const machine = await Machine.findByPk(newMachine.id, {
      include: [
        {
          model: MachineProcessName,
          include: [
            {
              model: MachineProcessValue,
              attributes: ["id", "process_value", "status"],
            },
          ],
        },
      ],
    });

    // Transform the data to match the requested format
    const processesWithValues = machine.MachineProcessNames.map((process) => {
      // Handle JSON parsing if needed
      let processValue = {};
      if (
        process.MachineProcessValues &&
        process.MachineProcessValues.length > 0
      ) {
        const valueData = process.MachineProcessValues[0].process_value;
        // Check if it's a string that needs parsing
        if (typeof valueData === "string") {
          try {
            processValue = JSON.parse(valueData);
          } catch (e) {
            processValue = valueData;
          }
        } else {
          processValue = valueData;
        }
      }

      return {
        id: process.id,
        process_name: process.process_name,
        status: process.status,
        created_at: process.created_at,
        updated_at: process.updated_at,
        created_by: process.created_by,
        updated_by: process.updated_by,
        process_values: processValue,
      };
    });

    const formattedMachine = {
      ...machine.toJSON(),
      processes: processesWithValues,
    };

    // Remove the nested structure from the response
    delete formattedMachine.MachineProcessNames;

    res.status(201).json({
      status: true,
      message: "Machine with processes added successfully",
      data: formattedMachine,
    });
  } catch (error) {
    await t.rollback(); // Rollback if error
    logger.error("Machine Creation Error:", error);
    res.status(500).json({
      status: false,
      message: "Error adding machine with processes",
      error: error.message,
    });
  }
});

v1Router.put("/machines/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const machineId = req.params.id;
    const machineData = req.body;
    const processes = machineData.processes || [];
    delete machineData.processes;

    // Find machine
    const machine = await Machine.findByPk(machineId, {
      transaction: t,
    });

    if (!machine) {
      await t.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Machine not found" });
    }

    // If changing company_id, verify that the company exists
    if (
      machineData.company_id &&
      machineData.company_id !== machine.company_id
    ) {
      const company = await Company.findByPk(machineData.company_id, {
        transaction: t,
      });
      if (!company) {
        await t.rollback();
        return res
          .status(404)
          .json({ status: false, message: "Company not found" });
      }
    }

    // Update machine data
    await machine.update(machineData, {
      transaction: t,
      fields: Object.keys(machineData),
    });

    // Handle processes
    if (processes.length > 0) {
      // Get existing process names for this machine
      const existingProcesses = await MachineProcessName.findAll({
        where: { machine_id: machineId },
        transaction: t,
      });

      // Map existing process names by process_name for easy lookup
      const existingProcessMap = existingProcesses.reduce((map, process) => {
        map[process.process_name] = process;
        return map;
      }, {});

      // Process each process in the request
      for (const process of processes) {
        const processValues = process.process_values || {};
        delete process.process_values;

        // Check if the process already exists
        const existingProcess = existingProcessMap[process.process_name];

        if (existingProcess) {
          // Update existing process
          await existingProcess.update(
            {
              status: process.status || existingProcess.status,
              updated_by: machineData.updated_by,
            },
            {
              transaction: t,
            }
          );

          // Handle process values
          if (Object.keys(processValues).length > 0) {
            // Check if process values exist
            const existingValue = await MachineProcessValue.findOne({
              where: {
                machine_id: machineId,
                process_name_id: existingProcess.id,
              },
              transaction: t,
            });

            if (existingValue) {
              // Update existing process values
              await existingValue.update(
                {
                  process_value: processValues,
                  updated_by: machineData.updated_by,
                },
                {
                  transaction: t,
                }
              );
            } else {
              // Create new process values
              await MachineProcessValue.create(
                {
                  machine_id: machineId,
                  process_name_id: existingProcess.id,
                  process_value: processValues,
                  status: "active",
                  created_by: machineData.updated_by,
                  updated_by: machineData.updated_by,
                },
                {
                  transaction: t,
                }
              );
            }
          }
        } else {
          // Create new process
          process.machine_id = machineId;
          process.created_by = machineData.updated_by;
          process.updated_by = machineData.updated_by;

          const newProcess = await MachineProcessName.create(process, {
            transaction: t,
          });

          // Create process values if they exist
          if (Object.keys(processValues).length > 0) {
            await MachineProcessValue.create(
              {
                machine_id: machineId,
                process_name_id: newProcess.id,
                process_value: processValues,
                status: "active",
                created_by: machineData.updated_by,
                updated_by: machineData.updated_by,
              },
              {
                transaction: t,
              }
            );
          }
        }
      }
    }

    await t.commit();

    // Clear Redis cache after successful update
    await clearMachineCache();

    // Fetch the updated machine with all its processes and values
    const updatedMachine = await Machine.findByPk(machineId, {
      include: [
        { model: Company },
        {
          model: MachineProcessName,
          include: [{ model: MachineProcessValue }],
        },
      ],
    });

    return res.status(200).json({
      status: true,
      message: "Machine updated successfully",
      data: updatedMachine,
    });
  } catch (error) {
    await t.rollback();
    logger.error("Machine Update Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// 🔹 Get All Machines (GET)
v1Router.get("/machines", authenticateJWT, async (req, res) => {
  try {
    let { page = 1, limit = 10, search, company_id, status } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    // Create a cache key based on request parameters
    const cacheKey = `machine:all:page${page}:limit${limit}:search${
      search || "none"
    }:company${company_id || "all"}:status${status || "all"}`;

    // Try to get data from Redis first
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      logger.info("Machine data retrieved from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { machine_name: { [Op.like]: `%${search}%` } },
        { machine_type: { [Op.like]: `%${search}%` } },
        { manufacturer: { [Op.like]: `%${search}%` } },
        { serial_number: { [Op.like]: `%${search}%` } },
        { model_number: { [Op.like]: `%${search}%` } },
      ];
    }

    if (company_id) {
      whereClause.company_id = company_id;
    }

    if (status) {
      whereClause.status = status;
    }

    const { count, rows: machines } = await Machine.findAndCountAll({
      where: whereClause,
      include: [
        { model: Company },
        {
          model: User,
          as: "Creator",
          attributes: ["id", "username", "email"],
          foreignKey: "created_by",
        },
        {
          model: User,
          as: "Updater",
          attributes: ["id", "username", "email"],
          foreignKey: "updated_by",
        },
      ],
      limit,
      offset: (page - 1) * limit,
      order: [["id", "ASC"]],
    });

    const response = {
      status: true,
      data: machines,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalRecords: count,
    };

    // Store in Redis with expiration (e.g., 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(response), "EX", 3600);

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Machine Fetch Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// 🔹 Get a Single Machine by ID with Processes and Values (GET)
v1Router.get("/machines/:id", authenticateJWT, async (req, res) => {
  try {
    const machineId = req.params.id;
    const cacheKey = `machine:${machineId}`;

    // Try to get data from Redis first
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      logger.info(`Machine ${machineId} retrieved from Redis cache`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    const machine = await Machine.findByPk(machineId, {
      include: [
        { model: Company },
        {
          model: MachineProcessName,
          include: [
            {
              model: MachineProcessValue,
              attributes: [
                "id",
                "process_value",
                "status",
                "createdAt",
                "updatedAt",
              ],
            },
          ],
        },
        {
          model: User,
          as: "Creator",
          attributes: ["id", "username", "email"],
          foreignKey: "created_by",
        },
        {
          model: User,
          as: "Updater",
          attributes: ["id", "username", "email"],
          foreignKey: "updated_by",
        },
      ],
    });

    if (!machine) {
      return res
        .status(404)
        .json({ status: false, message: "Machine not found" });
    }

    // Transform the data to match the requested format
    const processesWithValues = machine.MachineProcessNames.map((process) => {
      const processValue =
        process.MachineProcessValues.length > 0
          ? process.MachineProcessValues[0].process_value
          : {};

      return {
        id: process.id,
        process_name: process.process_name,
        status: process.status,
        created_by: process.created_by,
        updated_by: process.updated_by,
        createdAt: process.createdAt,
        updatedAt: process.updatedAt,
        process_values: processValue,
      };
    });

    const formattedMachine = {
      ...machine.toJSON(),
      processes: processesWithValues,
    };

    // Remove the nested structure from the response
    delete formattedMachine.MachineProcessNames;

    const response = { status: true, data: formattedMachine };

    // Store in Redis with expiration (e.g., 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(response), "EX", 3600);

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Machine Fetch by ID Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// 🔹 Delete a Machine with all its Processes and Values (DELETE)
v1Router.delete("/machines/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const machineId = req.params.id;
    const machine = await Machine.findByPk(machineId, {
      transaction: t,
    });

    if (!machine) {
      await t.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Machine not found" });
    }

    // Delete machine (cascade delete will handle processes and values due to foreign key constraints)
    // Delete machine (cascade delete will handle processes and values due to foreign key constraints)
    await machine.destroy({ transaction: t });

    await t.commit();

    // Clear Redis cache after successful deletion
    await clearMachineCache();

    return res.status(200).json({
      status: true,
      message: "Machine and all associated processes deleted successfully",
    });
  } catch (error) {
    await t.rollback();
    logger.error("Machine Delete Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// 🔹 Get Machines by Company ID (GET)
v1Router.get(
  "/companies/:companyId/machines",
  authenticateJWT,
  async (req, res) => {
    try {
      const companyId = req.params.companyId;
      let { page = 1, limit = 10, status } = req.query;
      page = parseInt(page);
      limit = parseInt(limit);

      const cacheKey = `machine:company:${companyId}:page${page}:limit${limit}:status${
        status || "all"
      }`;

      // Try to get data from Redis first
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info(
          `Machines for Company ${companyId} retrieved from Redis cache`
        );
        return res.status(200).json(JSON.parse(cachedData));
      }

      // Verify company exists
      const company = await Company.findByPk(companyId);
      if (!company) {
        return res
          .status(404)
          .json({ status: false, message: "Company not found" });
      }

      const whereClause = { company_id: companyId };

      if (status) {
        whereClause.status = status;
      }

      const { count, rows: machines } = await Machine.findAndCountAll({
        where: whereClause,
        limit,
        offset: (page - 1) * limit,
        order: [["id", "ASC"]],
      });

      const response = {
        status: true,
        data: machines,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalRecords: count,
      };

      // Store in Redis with expiration (e.g., 1 hour)
      await redisClient.set(cacheKey, JSON.stringify(response), "EX", 3600);

      return res.status(200).json(response);
    } catch (error) {
      logger.error("Machines Fetch by Company ID Error:", error);
      return res.status(500).json({ status: false, message: error.message });
    }
  }
);

// 🔹 Update Machine Status (PATCH)
v1Router.patch("/machines/:id/status", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const machineId = req.params.id;
    const { status, updated_by } = req.body;

    if (!status || !updated_by) {
      await t.rollback();
      return res.status(400).json({
        status: false,
        message: "Status and updated_by are required fields",
      });
    }

    // Validate status
    if (!["active", "inactive"].includes(status)) {
      await t.rollback();
      return res.status(400).json({
        status: false,
        message: "Status must be either 'active' or 'inactive'",
      });
    }

    const machine = await Machine.findByPk(machineId, {
      transaction: t,
    });

    if (!machine) {
      await t.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Machine not found" });
    }

    // Update machine status
    await machine.update({ status, updated_by }, { transaction: t });

    await t.commit();

    // Clear Redis cache after successful update
    await clearMachineCache();

    return res.status(200).json({
      status: true,
      message: "Machine status updated successfully",
      data: {
        id: machine.id,
        status: machine.status,
      },
    });
  } catch (error) {
    await t.rollback();
    logger.error("Machine Status Update Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// 🔹 Get Machine Process Names and Values (GET)
v1Router.get("/machines/:id/processes", authenticateJWT, async (req, res) => {
  try {
    const machineId = req.params.id;
    const cacheKey = `machine:${machineId}:processes`;

    // Try to get data from Redis first
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      logger.info(
        `Processes for Machine ${machineId} retrieved from Redis cache`
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

    // Get all process names for this machine
    const processes = await MachineProcessName.findAll({
      where: { machine_id: machineId },
      include: [
        {
          model: MachineProcessValue,
          attributes: [
            "id",
            "process_value",
            "status",
            "createdAt",
            "updatedAt",
          ],
        },
      ],
      order: [["process_name", "ASC"]],
    });

    // Transform the data to match the requested format
    const processesWithValues = processes.map((process) => {
      const processValue =
        process.MachineProcessValues.length > 0
          ? process.MachineProcessValues[0].process_value
          : {};

      return {
        id: process.id,
        process_name: process.process_name,
        status: process.status,
        created_by: process.created_by,
        updated_by: process.updated_by,
        createdAt: process.createdAt,
        updatedAt: process.updatedAt,
        process_values: processValue,
      };
    });

    const response = {
      status: true,
      data: processesWithValues,
      machine_id: machineId,
      machine_name: machine.machine_name,
    };

    // Store in Redis with expiration (e.g., 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(response), "EX", 3600);

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Machine Processes Fetch Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// 🔹 Add or Update Machine Process (POST)
v1Router.post("/machines/:id/processes", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const machineId = req.params.id;
    const processData = req.body;
    const processValues = processData.process_values || {};
    delete processData.process_values;

    // Verify machine exists
    const machine = await Machine.findByPk(machineId, {
      transaction: t,
    });

    if (!machine) {
      await t.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Machine not found" });
    }

    // Add machine_id to process data
    processData.machine_id = machineId;

    // Check if the process already exists
    let process = await MachineProcessName.findOne({
      where: {
        machine_id: machineId,
        process_name: processData.process_name,
      },
      transaction: t,
    });

    if (process) {
      // Update existing process
      await process.update(
        {
          status: processData.status || process.status,
          updated_by: processData.updated_by,
        },
        {
          transaction: t,
        }
      );
    } else {
      // Create new process
      process = await MachineProcessName.create(processData, {
        transaction: t,
      });
    }

    // Handle process values
    if (Object.keys(processValues).length > 0) {
      // Check if process values exist
      let processValue = await MachineProcessValue.findOne({
        where: {
          machine_id: machineId,
          process_name_id: process.id,
        },
        transaction: t,
      });

      if (processValue) {
        // Update existing process values
        await processValue.update(
          {
            process_value: processValues,
            updated_by: processData.updated_by,
          },
          {
            transaction: t,
          }
        );
      } else {
        // Create new process values
        processValue = await MachineProcessValue.create(
          {
            machine_id: machineId,
            process_name_id: process.id,
            process_value: processValues,
            status: "active",
            created_by: processData.created_by || processData.updated_by,
            updated_by: processData.updated_by,
          },
          {
            transaction: t,
          }
        );
      }
    }

    await t.commit();

    // Clear Redis cache after successful update
    await clearMachineCache();

    // Fetch the updated process with values
    const updatedProcess = await MachineProcessName.findByPk(process.id, {
      include: [
        {
          model: MachineProcessValue,
          attributes: [
            "id",
            "process_value",
            "status",
            "createdAt",
            "updatedAt",
          ],
        },
      ],
    });

    // Transform the data to match the requested format
    const processValue =
      updatedProcess.MachineProcessValues.length > 0
        ? updatedProcess.MachineProcessValues[0].process_value
        : {};

    const formattedProcess = {
      id: updatedProcess.id,
      process_name: updatedProcess.process_name,
      status: updatedProcess.status,
      created_by: updatedProcess.created_by,
      updated_by: updatedProcess.updated_by,
      createdAt: updatedProcess.createdAt,
      updatedAt: updatedProcess.updatedAt,
      process_values: processValue,
    };

    return res.status(200).json({
      status: true,
      message: "Machine process added/updated successfully",
      data: formattedProcess,
    });
  } catch (error) {
    await t.rollback();
    logger.error("Machine Process Add/Update Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// 🔹 Delete a Machine Process (DELETE)
v1Router.delete(
  "/machines/:machineId/processes/:processId",
  authenticateJWT,
  async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const machineId = req.params.machineId;
      const processId = req.params.processId;

      // Verify machine exists
      const machine = await Machine.findByPk(machineId, {
        transaction: t,
      });

      if (!machine) {
        await t.rollback();
        return res
          .status(404)
          .json({ status: false, message: "Machine not found" });
      }

      // Find the process
      const process = await MachineProcessName.findOne({
        where: {
          id: processId,
          machine_id: machineId,
        },
        transaction: t,
      });

      if (!process) {
        await t.rollback();
        return res.status(404).json({
          status: false,
          message: "Process not found for this machine",
        });
      }

      // Delete process (cascade delete will handle process values)
      await process.destroy({ transaction: t });

      await t.commit();

      // Clear Redis cache after successful deletion
      await clearMachineCache();

      return res.status(200).json({
        status: true,
        message: "Machine process deleted successfully",
      });
    } catch (error) {
      await t.rollback();
      logger.error("Machine Process Delete Error:", error);
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

  // Close Redis connection
  await redisClient.quit();

  // Close RabbitMQ connection
  await closeRabbitMQConnection();

  process.exit(0);
});

// Use Version 1 Router
app.use("/api", v1Router);

await db.sequelize.sync();
const PORT = 3008;
const service = "Machine Service";
app.listen(PORT, () => {
  console.log(`${service} running on port ${PORT}`);
});

export default app;
