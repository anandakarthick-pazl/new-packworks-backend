import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";

// Import only the RabbitMQ configuration
import {
  publishToQueue,
  rabbitChannel,
  closeRabbitMQConnection,
} from "../../common/helper/rabbitmq.js";
import { validateClient } from "../../common/inputvalidation/validationClient.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import companyScope from "../../common/middleware/companyScope.js";

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
  const t = await sequelize.transaction();
  try {
    const { clientData, addresses } = req.body;

    // Add user tracking information internally
    const newClientData = {
      ...clientData,
      created_by: req.user.id, 
      updated_by: req.user.id, 
      status: "active",
    };

    // 1. Create Client
    const newClient = await Client.create(newClientData, { transaction: t });

    // 2. Create Addresses and store them in an array
    let createdAddresses = [];
    createdAddresses = await Promise.all(
      addresses.map(async (address) => {
        return await Address.create(
          {
            ...address,
            client_id: newClient.client_id,
            created_by: req.user.id, // Set from authenticated user
            updated_by: req.user.id, // Set from authenticated user
          },
          { transaction: t }
        );
      })
    );

    await t.commit();

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
      addresses: createdAddresses,
    });
  } catch (error) {
    await t.rollback();
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
          as: "creator",
          attributes: ["id", "name", "email"],
        },
        {
          model: User,
          as: "updater",
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

    const client = await Client.findByPk(clientId, {
      include: [
        { model: Address, as: "addresses" },
        {
          model: User,
          as: "creator",
          attributes: ["id", "name", "email"],
        },
        {
          model: User,
          as: "updater  ",
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

    // Add updater information internally
    const updatedClientData = {
      ...clientData,
      updated_by: req.user.id, // Set from authenticated user
      updated_at: new Date(),
    };

    // Update client data
    await client.update(updatedClientData, {
      transaction: t,
      fields: Object.keys(updatedClientData),
    });

    let updatedAddresses = [];

    // Handle Addresses
    if (addresses && addresses.length > 0) {
      updatedAddresses = await Promise.all(
        addresses.map(async (address) => {
          const addressWithUser = {
            ...address,
            updated_by: req.user.id, // Add user ID to each address
          };

          if (address.address_id) {
            // Update existing address
            await Address.update(addressWithUser, {
              where: { address_id: address.address_id },
              transaction: t,
            });
            return await Address.findByPk(address.address_id, {
              transaction: t,
            });
          } else {
            // Create new address
            return await Address.create(
              {
                ...addressWithUser,
                client_id: client.client_id,
                created_by: req.user.id, // Set created_by for new addresses
              },
              { transaction: t }
            );
          }
        })
      );
    }

    await t.commit();

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
        updated_by: req.user.id, // Set from authenticated user
        updated_at: new Date(),
      },
      { transaction: t }
    );

    // Also mark all related addresses as inactive
    await Address.update(
      {
        status: "inactive",
        updated_by: req.user.id, // Set from authenticated user
        updated_at: new Date(),
      },
      {
        where: { client_id: clientId },
        transaction: t,
      }
    );

    await t.commit();

    return res.status(200).json({
      status: true,
      message: "Client and related addresses marked as inactive successfully",
    });
  } catch (error) {
    await t.rollback();
    logger.error("Client Soft Delete Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
    rabbitmq: rabbitChannel ? "connected" : "disconnected",
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");

  // Close RabbitMQ connection using the exported function
  await closeRabbitMQConnection();

  process.exit(0);
});

// Use Version 1 Router
app.use("/api", v1Router);

await db.sequelize.sync();
const PORT = 3003;
const service = "Client Service";
app.listen(PORT, () => {
  console.log(`${service} running on port ${PORT}`);
});
