import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import axios from "axios";

// Import only the RabbitMQ configuration
import {
  publishToQueue,
  rabbitChannel,
  closeRabbitMQConnection,
} from "../../common/helper/rabbitmq.js";
import ExcelJS from "exceljs";
import { Readable } from "stream";
// import { validateClient } from "../../common/inputvalidation/validationClient.js";
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

/**
 * @swagger
 * /clients:
 *   post:
 *     summary: Create a new client with addresses
 *     description: Creates a client and their associated addresses.
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientData
 *               - addresses
 *             properties:
 *               clientData:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: John Doe
 *                   email:
 *                     type: string
 *                     example: john@example.com
 *                   phone:
 *                     type: string
 *                     example: +91-9876543210
 *                   gstin:
 *                     type: string
 *                     example: 22AAAAA0000A1Z5
 *                   pan:
 *                     type: string
 *                     example: AAAAA0000A
 *                   company_name:
 *                     type: string
 *                     example: Acme Corporation
 *                   industry:
 *                     type: string
 *                     example: Manufacturing
 *                   notes:
 *                     type: string
 *                     example: Important client
 *               addresses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     address_line1:
 *                       type: string
 *                       example: 123 Main Street
 *                     address_line2:
 *                       type: string
 *                       example: Suite 200
 *                     city:
 *                       type: string
 *                       example: Mumbai
 *                     state:
 *                       type: string
 *                       example: Maharashtra
 *                     country:
 *                       type: string
 *                       example: India
 *                     pincode:
 *                       type: string
 *                       example: 400001
 *                     address_type:
 *                       type: string
 *                       enum: [billing, shipping]
 *                       example: billing
 *     responses:
 *       201:
 *         description: Client and Addresses added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Client and Addresses added successfully
 *                 client:
 *                   $ref: '#/components/schemas/Client'
 *                 addresses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Address'
 *       500:
 *         description: Error adding client
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error adding client
 *                 error:
 *                   type: string
 *                   example: Email already exists
 */

v1Router.post("/clients", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { clientData, addresses } = req.body;

    // Add user tracking information internally
    const newClientData = {
      ...clientData,
      company_id: req.user.company_id,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "active",
    };

    // 1. Create Client
    const newClient = await Client.create(newClientData, { transaction: t, ...req.sequelizeOptions });

    console.log("create Client", newClient.toJSON());

    // 2. Create Addresses and store them in an array
    let createdAddresses = [];
    createdAddresses = await Promise.all(
      addresses.map(async (address) => {
        return await Address.create(
          {
            ...address,
            client_id: newClient.client_id,
            created_by: req.user.id,
            updated_by: req.user.id,
          },
          { transaction: t, ...req.sequelizeOptions }
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

/**
 * @swagger
 * /clients:
 *   get:
 *     summary: Get paginated list of clients
 *     description: Fetches a paginated list of clients, with optional filters like search, entity type, and inactive status.
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number (default is 1)
 *         required: false
 *         schema:
 *           type: integer
 *           example: 1
 *       - name: limit
 *         in: query
 *         description: Number of records per page (default is 10)
 *         required: false
 *         schema:
 *           type: integer
 *           example: 10
 *       - name: search
 *         in: query
 *         description: Search string for company name, PAN, email, mobile, GST number, etc.
 *         required: false
 *         schema:
 *           type: string
 *           example: Acme
 *       - name: includeInactive
 *         in: query
 *         description: Include inactive clients (true or false)
 *         required: false
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           example: false
 *       - name: entity_type
 *         in: query
 *         description: Filter by entity type (e.g., Client, Vendor)
 *         required: false
 *         schema:
 *           type: string
 *           example: Client
 *     responses:
 *       200:
 *         description: A paginated list of clients
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       client_id:
 *                         type: integer
 *                         example: 101
 *                       client_ui_id:
 *                         type: string
 *                         example: CLNT-101
 *                       company_name:
 *                         type: string
 *                         example: Acme Corp
 *                       entity_type:
 *                         type: string
 *                         example: Client
 *                       email:
 *                         type: string
 *                         example: client@example.com
 *                       mobile:
 *                         type: string
 *                         example: "+1234567890"
 *                       status:
 *                         type: string
 *                         example: active
 *                       addresses:
 *                         type: array
 *                         items:
 *                           type: object
 *                       creator:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                       updater:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                 totalPages:
 *                   type: integer
 *                   example: 5
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 totalRecords:
 *                   type: integer
 *                   example: 50
 *       500:
 *         description: Server error while fetching clients
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

v1Router.get("/clients", authenticateJWT, async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search,
      includeInactive = false,
      entity_type,
    } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    console.log("pages", page);
    console.log("object", limit);

    const whereClause = {};

    // By default, only show active clients unless includeInactive is true
    if (includeInactive !== "true") {
      whereClause.status = "active";
    }
    // Add entity_type filter if provided
    if (entity_type) {
      whereClause.entity_type = entity_type;
    }

    if (search) {
      whereClause[Op.or] = [
        { company_name: { [Op.like]: `%${search}%` } },
        { PAN: { [Op.like]: `%${search}%` } },
        { display_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { mobile: { [Op.like]: `%${search}%` } },
        { gst_number: { [Op.like]: `%${search}%` } },
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
      distinct: true,
    });
    console.log("count", count);
    const response = {
      status: true,
      data: clients.map((client) => ({
        ...client.toJSON(),
        client_ui_id:
          client.entity_type === "Client"
            ? `CLNT-${client.client_id}`
            : client.entity_type === "Vendor"
            ? `VEND-${client.client_id}`
            : client.client_id,
      })),
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
/**
 * @swagger
 * /clients/{id}:
 *   get:
 *     summary: Get a specific client by ID
 *     description: Fetch a single client including address and creator/updater information by client ID.
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Unique ID of the client
 *         required: true
 *         schema:
 *           type: integer
 *           example: 101
 *     responses:
 *       200:
 *         description: Client details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     client_id:
 *                       type: integer
 *                       example: 101
 *                     company_name:
 *                       type: string
 *                       example: Acme Corp
 *                     entity_type:
 *                       type: string
 *                       example: Client
 *                     email:
 *                       type: string
 *                       example: client@example.com
 *                     mobile:
 *                       type: string
 *                       example: "+1234567890"
 *                     status:
 *                       type: string
 *                       example: active
 *                     addresses:
 *                       type: array
 *                       items:
 *                         type: object
 *                     creator:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                     updater:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *       404:
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Client not found
 *       500:
 *         description: Server error while fetching client
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

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


/**
 * @swagger
 * /clients/{id}:
 *   put:
 *     summary: Update a client and its addresses
 *     description: Update client details and associated addresses. Only existing addresses with valid IDs can be updated.
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the client to update
 *         schema:
 *           type: integer
 *           example: 101
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientData:
 *                 type: object
 *                 description: Data to update for the client
 *                 example:
 *                   company_name: Acme Corporation
 *                   email: acme@example.com
 *                   mobile: "+1234567890"
 *                   entity_type: Client
 *               addresses:
 *                 type: array
 *                 description: List of addresses to update (must include address IDs)
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 201
 *                     address_line1:
 *                       type: string
 *                       example: "123 Street"
 *                     city:
 *                       type: string
 *                       example: "New York"
 *                     state:
 *                       type: string
 *                       example: "NY"
 *                     zip:
 *                       type: string
 *                       example: "10001"
 *     responses:
 *       200:
 *         description: Client and addresses updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Client and addresses updated successfully
 *                 client:
 *                   $ref: '#/components/schemas/Client'
 *                 addresses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Address'
 *       400:
 *         description: Address ID missing or invalid update request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Address ID is missing. Only existing addresses can be updated.
 *       404:
 *         description: Client or address not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Client not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

v1Router.put("/clients/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { clientData, addresses } = req.body;
    const clientId = req.params.id;

    // Check if client exists
    const client = await Client.findByPk(clientId, { transaction: t });
    if (!client) {
      await t.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Client not found" });
    }

    // Prepare update data
    const updatedClientData = {
      ...clientData,
      updated_by: req.user.id,
      updated_at: new Date(),
    };

    // Update client data
    await client.update(updatedClientData, {
      transaction: t,
      fields: Object.keys(updatedClientData),
    });

    let updatedAddresses = [];

    // Handle Addresses (Only Update, No Creation)
    if (addresses && addresses.length > 0) {
      for (const address of addresses) {
        if (!address.id) {
          await t.rollback();
          return res.status(400).json({
            status: false,
            message:
              "Address ID is missing. Only existing addresses can be updated.",
          });
        }

        const existingAddress = await Address.findOne({
          where: { id: address.id, client_id: clientId },
          transaction: t,
        });

        if (!existingAddress) {
          await t.rollback();
          return res.status(404).json({
            status: false,
            message: `Address with ID ${address.id} not found or doesn't belong to the client.`,
          });
        }

        const addressWithUser = {
          ...address,
          updated_by: req.user.id,
          updated_at: new Date(),
        };

        await existingAddress.update(addressWithUser, { transaction: t });
        updatedAddresses.push(existingAddress);
      }
    }

    await t.commit();

    return res.status(200).json({
      status: true,
      message: "Client and addresses updated successfully",
      client,
      addresses: updatedAddresses,
    });
  } catch (error) {
    await t.rollback();
    console.error("Error updating client and addresses:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// 🔹 Soft Delete a Client (DELETE) - Changes status to inactive
/**
 * @swagger
 * /clients/{id}:
 *   delete:
 *     summary: Soft delete a client
 *     description: Soft deletes a client and marks all related addresses as inactive.
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the client to soft delete
 *         schema:
 *           type: integer
 *           example: 101
 *     responses:
 *       200:
 *         description: Client and related addresses marked as inactive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Client and related addresses marked as inactive successfully
 *       404:
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Client not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

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

    // Also mark all related addresses as inactive
    await Address.update(
      {
        status: "inactive",
        updated_by: req.user.id,
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


/**
 * @swagger
 * /clients/download/excel:
 *   get:
 *     summary: Download clients and addresses as Excel
 *     description: Download a list of clients and their associated addresses as an Excel file based on optional filters like `search`, `entity_type`, and `includeInactive`.
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: search
 *         in: query
 *         required: false
 *         description: Search term for company name, PAN, or display name
 *         schema:
 *           type: string
 *           example: Acme Corp
 *       - name: entity_type
 *         in: query
 *         required: false
 *         description: Filter by entity type
 *         schema:
 *           type: string
 *           example: company
 *       - name: includeInactive
 *         in: query
 *         required: false
 *         description: Include inactive clients if true
 *         schema:
 *           type: boolean
 *           example: true
 *     responses:
 *       200:
 *         description: Excel file containing client and address data
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Internal server error during Excel generation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Excel Download Error
 */

v1Router.get("/clients/download/excel", authenticateJWT, async (req, res) => {
  try {
    let { search, includeInactive = false, entity_type } = req.query;

    const whereClause = {};

    // By default, only show active clients unless includeInactive is true
    if (includeInactive !== "true") {
      whereClause.status = "active";
    }

    // Add entity_type filter if provided
    if (entity_type) {
      whereClause.entity_type = entity_type;
    }

    if (search) {
      whereClause[Op.or] = [
        { company_name: { [Op.like]: `%${search}%` } },
        { PAN: { [Op.like]: `%${search}%` } },
        { display_name: { [Op.like]: `%${search}%` } },
      ];
    }

    // Fetch clients with the same filters as the GET API but without pagination
    const { rows: clients } = await Client.findAndCountAll({
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
      order: [["client_id", "ASC"]],
    });

    // Create a new Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const clientSheet = workbook.addWorksheet("Clients");
    const addressSheet = workbook.addWorksheet("Addresses");

    // Set up client sheet headers with all model fields
    clientSheet.columns = [
      { header: "Client ID", key: "client_id", width: 10 },
      { header: "Company ID", key: "company_id", width: 10 },
      { header: "Client Ref ID", key: "client_ref_id", width: 15 },
      { header: "Entity Type", key: "entity_type", width: 15 },
      { header: "Customer Type", key: "customer_type", width: 15 },
      { header: "Company Name", key: "company_name", width: 30 },
      { header: "Display Name", key: "display_name", width: 20 },
      { header: "Salutation", key: "salutation", width: 10 },
      { header: "First Name", key: "first_name", width: 20 },
      { header: "Last Name", key: "last_name", width: 20 },
      { header: "PAN", key: "PAN", width: 15 },
      { header: "GST Status", key: "gst_status", width: 10 },
      { header: "GST Number", key: "gst_number", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "Work Phone", key: "work_phone", width: 15 },
      { header: "Mobile", key: "mobile", width: 15 },
      { header: "Currency", key: "currency", width: 15 },
      { header: "Opening Balance", key: "opening_balance", width: 15 },
      { header: "Payment Terms", key: "payment_terms", width: 15 },
      { header: "Portal Enabled", key: "enable_portal", width: 15 },
      { header: "Portal Language", key: "portal_language", width: 15 },
      { header: "Website", key: "website_url", width: 20 },
      { header: "Department", key: "department", width: 15 },
      { header: "Designation", key: "designation", width: 15 },
      { header: "Twitter", key: "twitter", width: 15 },
      { header: "Skype", key: "skype", width: 15 },
      { header: "Facebook", key: "facebook", width: 15 },
      { header: "Status", key: "status", width: 10 },
      { header: "Created By", key: "created_by_name", width: 20 },
      { header: "Created At", key: "created_at", width: 20 },
      { header: "Updated By", key: "updated_by_name", width: 20 },
      { header: "Updated At", key: "updated_at", width: 20 },
    ];

    // Set up address sheet headers with all fields from Address model
    addressSheet.columns = [
      { header: "Address ID", key: "id", width: 10 },
      { header: "Client ID", key: "client_id", width: 10 },
      { header: "Company Name", key: "company_name", width: 30 },
      { header: "Entity Type", key: "entity_type", width: 15 },
      { header: "Attention", key: "attention", width: 20 },
      { header: "Address Line 1", key: "street1", width: 30 },
      { header: "Address Line 2", key: "street2", width: 30 },
      { header: "City", key: "city", width: 20 },
      { header: "State", key: "state", width: 20 },
      { header: "Country", key: "country", width: 20 },
      { header: "Postal Code", key: "pinCode", width: 15 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Fax", key: "faxNumber", width: 15 },
      { header: "Status", key: "status", width: 10 },
      { header: "Created At", key: "created_at", width: 20 },
      { header: "Updated At", key: "updated_at", width: 20 },
    ];

    // Add styles to header rows
    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } },
    };

    clientSheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    addressSheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Add data to client sheet
    clients.forEach((client) => {
      clientSheet.addRow({
        client_id: client.client_id,
        company_id: client.company_id,
        client_ref_id: client.client_ref_id,
        entity_type: client.entity_type,
        customer_type: client.customer_type,
        company_name: client.company_name,
        display_name: client.display_name,
        salutation: client.salutation,
        first_name: client.first_name,
        last_name: client.last_name,
        PAN: client.PAN,
        gst_status: client.gst_status ? "Yes" : "No",
        gst_number: client.gst_number,
        email: client.email,
        work_phone: client.work_phone,
        mobile: client.mobile,
        currency: client.currency,
        opening_balance: client.opening_balance,
        payment_terms: client.payment_terms,
        enable_portal: client.enable_portal ? "Yes" : "No",
        portal_language: client.portal_language,
        website_url: client.website_url,
        department: client.department,
        designation: client.designation,
        twitter: client.twitter,
        skype: client.skype,
        facebook: client.facebook,
        status: client.status,
        created_by_name: client.creator ? client.creator.name : "N/A",
        created_at: client.created_at
          ? new Date(client.created_at).toLocaleString()
          : "N/A",
        updated_by_name: client.updater ? client.updater.name : "N/A",
        updated_at: client.updated_at
          ? new Date(client.updated_at).toLocaleString()
          : "N/A",
      });

      // Add data to address sheet if client has addresses
      if (client.addresses && client.addresses.length > 0) {
        client.addresses.forEach((address) => {
          addressSheet.addRow({
            id: address.id,
            client_id: client.client_id,
            company_name: client.company_name,
            entity_type: client.entity_type,
            attention: address.attention,
            street1: address.street1,
            street2: address.street2,
            city: address.city,
            state: address.state,
            country: address.country,
            pinCode: address.pinCode,
            phone: address.phone,
            faxNumber: address.faxNumber,
            status: address.status,
            created_at: address.created_at
              ? new Date(address.created_at).toLocaleString()
              : "N/A",
            updated_at: address.updated_at
              ? new Date(address.updated_at).toLocaleString()
              : "N/A",
          });
        });
      }
    });

    // Apply alternating row colors for better readability
    clientSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const fillColor = rowNumber % 2 === 0 ? "F2F2F2" : "FFFFFF";
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fillColor },
          };
        });
      }
    });

    addressSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const fillColor = rowNumber % 2 === 0 ? "F2F2F2" : "FFFFFF";
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fillColor },
          };
        });
      }
    });

    // Create a readable stream for the workbook
    const buffer = await workbook.xlsx.writeBuffer();
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Set response headers for file download
    const searchSuffix = search ? `-${search}` : "";
    const entityTypeSuffix = entity_type ? `-${entity_type}` : "";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `clients-data${searchSuffix}${entityTypeSuffix}-${timestamp}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    // Pipe the stream to response
    stream.pipe(res);

    // Log the download
    logger.info(
      `Excel download initiated by user ${
        req.user.id
      } with filters: ${JSON.stringify({
        search,
        includeInactive,
        entity_type,
      })}`
    );
  } catch (error) {
    logger.error("Excel Download Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});


/**
 * @swagger
 * /clients/check-gst:
 *   post:
 *     summary: Check if a GST number already exists
 *     description: Verifies if a GST number already exists for the authenticated user's company. If not, it fetches the details from a third-party API.
 *     tags:
 *       - Clients
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gst_number
 *             properties:
 *               gst_number:
 *                 type: string
 *                 example: 29ABCDE1234F2Z5
 *     responses:
 *       200:
 *         description: GST validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: GST details fetched successfully
 *                 isExisting:
 *                   type: boolean
 *                   example: false
 *                 gstDetails:
 *                   type: object
 *                   description: GST details from third-party API
 *       400:
 *         description: Missing or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Company ID and GST number are required
 *       500:
 *         description: Internal server error during GST validation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Error checking GST number
 *                 error:
 *                   type: string
 */

v1Router.post("/clients/check-gst", authenticateJWT, async (req, res) => {
  try {
    const { gst_number } = req.body;
    const { company_id } = req.user; // Extract user ID from the request

    // Validate request parameters
    if (!company_id || !gst_number) {
      return res.status(400).json({
        success: false,
        message: "Company ID and GST number are required",
      });
    }

    // Check if GST already exists for the same company
    const existingClient = await Client.findOne({
      where: { company_id, gst_number },
    });

    if (existingClient) {
      return res.status(200).json({
        success: false,
        message: "This GST number is already registered with this company",
        isExisting: true,
      });
    }

    // If GST not found in our database, fetch from third-party API
    const thirdPartyUrl = `http://sheet.gstincheck.co.in/check/9ee24120971acd5c17dc6cad239d99fa/${gst_number}`;
    const thirdPartyResponse = await axios.get(thirdPartyUrl);

    return res.status(200).json({
      success: true,
      message: "GST details fetched successfully",
      isExisting: false,
      gstDetails: thirdPartyResponse.data,
    });
  } catch (error) {
    console.error("Error checking GST:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking GST number",
      error: error.message,
    });
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
