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
import { validateClient } from "../../common/inputvalidation/validationClient.js";
import { authenticateJWT } from "../../common/middleware/auth.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const Client = db.Client;
const Address = db.ClientAddress;
const User = db.User;

// 🔹 Create a Client (POST)
v1Router.post("/clients", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction(); // Start transaction

  try {
    const { clientData, addresses } = req.body;

    // Add user tracking information
    clientData.created_by = req.user.id;
    clientData.updated_by = req.user.id;
    clientData.status = "active"; // Ensure new clients are active by default

    // 1. Create Client
    const newClient = await Client.create(clientData, { transaction: t });

    // 2. Create Addresses and store them in an array
    let createdAddresses = [];
    if (addresses && addresses.length > 0) {
      createdAddresses = await Promise.all(
        addresses.map(async (address) => {
          return await Address.create(
            {
              ...address,
              client_id: newClient.client_id, // Link address to client
            },
            { transaction: t }
          );
        })
      );
    }

    await t.commit(); // Commit transaction

    // Clear Redis cache after successful creation
    await clearClientCache();

    // Publish message to RabbitMQ
    await publishToQueue({
      operation: "CREATE",
      clientId: newClient.client_id,
      timestamp: new Date(),
      data: {
        client: newClient,
        addresses: createdAddresses,
      },
    });

    res.status(201).json({
      message: "Client and Addresses added successfully",
      client: newClient,
      addresses: createdAddresses, // Include addresses in response
    });
  } catch (error) {
    await t.rollback(); // Rollback if error
    res
      .status(500)
      .json({ message: "Error adding client", error: error.message });
  }
});

// 🔹 Get All Clients (GET) with Addresses - Only active clients
v1Router.get("/clients", authenticateJWT, async (req, res) => {
  try {
    let { page = 1, limit = 10, search, includeInactive = false } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    // Create a cache key based on request parameters
    const cacheKey = `client:all:page${page}:limit${limit}:search${
      search || "none"
    }:includeInactive${includeInactive}`;

    // Try to get data from Redis first
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      logger.info("Data retrieved from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const whereClause = {};

    // By default, only show active clients unless includeInactive is true
    if (includeInactive !== "true") {
      whereClause.status = "active";
    }

    if (search) {
      whereClause[Op.or] = [
        { company_name: { [Op.like]: `%${search}%` } },
        { PAN: { [Op.like]: `%${search}%` } },
        { display_name: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: clients } = await Client.findAndCountAll({
      where: whereClause,
      include: [
        { model: Address, as: "addresses" },
        {
          model: User,
          as: "creator_client",
          attributes: ["id", "name", "email"],
        },
        {
          model: User,
          as: "updater_client", 
          attributes: ["id", "name", "email"],
        },
      ],
      limit,
      offset: (page - 1) * limit,
      order: [["client_id", "ASC"]],
    });

    const response = {
      status: true,
      data: clients,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalRecords: count,
    };

    // Store in Redis with expiration (e.g., 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(response), "EX", 3600);

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Client Fetch Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// 🔹 Get a Single Client by ID with Addresses (GET)
v1Router.get("/clients/:id", authenticateJWT, async (req, res) => {
  try {
    const clientId = req.params.id;
    const cacheKey = `client:${clientId}`;

    // Try to get data from Redis first
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      logger.info(`Client ${clientId} retrieved from Redis cache`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    const client = await Client.findByPk(clientId, {
      include: [
        { model: Address, as: "addresses" }, // Include addresses
        {
          model: User,
          as: "creator_client",
          attributes: ["id", "name", "email"],
        },
        {
          model: User,
          as: "updater_client",
          attributes: ["id", "name", "email"],
        },
      ],
    });

    if (!client) {
      return res
        .status(404)
        .json({ status: false, message: "Client not found" });
    }

    const response = { status: true, data: client };

    // Store in Redis with expiration (e.g., 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(response), "EX", 3600);

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Client Fetch by ID Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// 🔹 Update a Client and Addresses (PUT)
v1Router.put("/clients/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { clientData, addresses } = req.body;
    const clientId = req.params.id;

    // Find client
    const client = await Client.findByPk(clientId, { transaction: t });
    if (!client) {
      await t.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Client not found" });
    }

    // Add updater information
    clientData.updated_by = req.user.id;
    clientData.updated_at = new Date();

    // Update client data
    await client.update(clientData, {
      transaction: t,
      fields: Object.keys(clientData),
    });

    let updatedAddresses = [];

    // Handle Addresses
    if (addresses && addresses.length > 0) {
      updatedAddresses = await Promise.all(
        addresses.map(async (address) => {
          if (address.address_id) {
            // Update existing address
            await Address.update(address, {
              where: { address_id: address.address_id },
              transaction: t,
            });
            return await Address.findByPk(address.address_id, {
              transaction: t,
            });
          } else {
            // Create new address
            return await Address.create(
              { ...address, client_id: client.client_id },
              { transaction: t }
            );
          }
        })
      );
    }

    await t.commit();

    // Clear Redis cache after successful update
    await clearClientCache();

    // Publish message to RabbitMQ
    await publishToQueue({
      operation: "UPDATE",
      clientId: client.client_id,
      timestamp: new Date(),
      data: {
        client: client,
        addresses: updatedAddresses,
      },
    });

    return res.status(200).json({
      status: true,
      message: "Client and Addresses updated successfully",
      client: client,
      addresses: updatedAddresses,
    });
  } catch (error) {
    await t.rollback();
    logger.error("Client Update Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// 🔹 Soft Delete a Client (DELETE) - Changes status to inactive
v1Router.delete("/clients/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const clientId = req.params.id;
    const client = await Client.findByPk(clientId, { transaction: t });
    if (!client) {
      await t.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Client not found" });
    }

    // Soft delete by updating status to inactive
    await client.update(
      {
        status: "inactive",
        updated_by: req.user.id,
        updated_at: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    // Clear Redis cache after successful soft deletion
    await clearClientCache();

    // Publish message to RabbitMQ
    await publishToQueue({
      operation: "SOFT_DELETE",
      clientId: client.client_id,
      timestamp: new Date(),
      data: {
        client: client,
      },
    });

    return res.status(200).json({
      status: true,
      message: "Client marked as inactive successfully",
    });
  } catch (error) {
    await t.rollback();
    logger.error("Client Soft Delete Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// // 🔹 Hard Delete a Client and Its Addresses (for admin purposes)
// v1Router.delete("/clients/:id/hard", authenticateJWT, async (req, res) => {
//   // Check if user has admin privileges
//   if (!req.user.isAdmin) {
//     return res.status(403).json({
//       status: false,
//       message: "Only administrators can perform hard delete operations",
//     });
//   }

//   const t = await sequelize.transaction();
//   try {
//     const clientId = req.params.id;
//     const client = await Client.findByPk(clientId, { transaction: t });
//     if (!client) {
//       await t.rollback();
//       return res
//         .status(404)
//         .json({ status: false, message: "Client not found" });
//     }

//     // Delete addresses first (assuming client_id is the foreign key in addresses)
//     await Address.destroy({
//       where: { client_id: client.client_id },
//       transaction: t,
//     });

//     // Delete client
//     await client.destroy({ transaction: t });

//     await t.commit();

//     // Clear Redis cache after successful deletion
//     await clearClientCache();

//     // Publish message to RabbitMQ
//     await publishToQueue({
//       operation: "HARD_DELETE",
//       clientId: clientId,
//       timestamp: new Date(),
//       data: {
//         message: "Client and related addresses permanently deleted",
//       },
//     });

//     return res.status(200).json({
//       status: true,
//       message: "Client and related Addresses permanently deleted successfully",
//     });
//   } catch (error) {
//     await t.rollback();
//     logger.error("Client Hard Delete Error:", error);
//     return res.status(500).json({ status: false, message: error.message });
//   }
// });

// 🔹 Restore a Soft-Deleted Client
v1Router.post("/clients/:id/restore", authenticateJWT, async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await Client.findByPk(clientId);

    if (!client) {
      return res
        .status(404)
        .json({ status: false, message: "Client not found" });
    }

    // Check if client is already active
    if (client.status === "active") {
      return res
        .status(400)
        .json({ status: false, message: "Client is already active" });
    }

    // Restore client by setting status to active
    await client.update({
      status: "active",
      updated_by: req.user.id,
      updated_at: new Date(),
    });

    // Clear Redis cache after successful restoration
    await clearClientCache();

    // Publish message to RabbitMQ
    await publishToQueue({
      operation: "RESTORE",
      clientId: client.client_id,
      timestamp: new Date(),
      data: {
        client: client,
      },
    });

    return res.status(200).json({
      status: true,
      message: "Client restored successfully",
      client: client,
    });
  } catch (error) {
    logger.error("Client Restore Error:", error);
    return res.status(500).json({ status: false, message: error.message });
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

  // Close Redis connection using the exported function
  await redisClient.quit();

  // Close RabbitMQ connection using the exported function
  await closeRabbitMQConnection();

  process.exit(0);
});

// Use Version 1 Router
app.use("/api", v1Router);

// Update the Client model associations
Client.belongsTo(User, { foreignKey: "created_by", as: "creator" });
Client.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

await db.sequelize.sync();
const PORT = 3003;
const service = "Client Service";
app.listen(PORT, () => {
  console.log(`${service} running on port ${PORT}`);
});
