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

import { generateId } from "../../common/inputvalidation/generateId.js";
import { validateClient } from "../../common/inputvalidation/validationClient.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const Client = db.Client;
const Address = db.ClientAddress;
const User = db.User;

// 🔹 Create a Client (POST)
v1Router.post("/clients", authenticateJWT, validateClient, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { clientData, addresses } = req.body;

    // Extract entity_type from clientData instead of from req.body directly
    const entity_type = clientData.entity_type;

    const client_ui_id = await generateId(
      req.user.company_id,
      Client,
      entity_type === "Client"
        ? "client"
        : entity_type === "Vendor"
          ? "vendor"
          : "other"
    );

    // Add user tracking information internally
    const newClientData = {
      ...clientData,
      // No need to override entity_type as it's already in clientData
      client_ui_id: client_ui_id,
      company_id: req.user.company_id,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "active",
    };

    // 1. Create Client
    const newClient = await Client.create(newClientData, {
      transaction: t,
      ...req.sequelizeOptions,
    });

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
      message: `${entity_type} and Addresses added successfully`,
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
v1Router.get("/clients", authenticateJWT, async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search,
      status, // Changed from includeInactive to status filter
      entity_type,
    } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    console.log("pages", page);
    console.log("limit", limit);

    const whereClause = {};

    // Add status filter if provided
    if (status) {
      // Accept 'active', 'inactive', or 'all'
      if (status === 'active') {
        whereClause.status = 'active';
      } else if (status === 'inactive') {
        whereClause.status = 'inactive';
      }
      // If status is 'all' or any other value, don't add status filter (show all)
    }
    // If no status parameter is provided, show all clients (no filter applied)

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
        { client_ui_id: { [Op.like]: `%${search}%` } },
        { client_ref_id: { [Op.like]: `%${search}%` } },
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
      order: [["created_at", "DESC"]],
      distinct: true,
    });

    console.log("count", count);

    const response = {
      status: true,
      data: clients.map((client) => {
        const obj = client.toJSON();
        if (typeof obj.documents === "string") {
          try {
            obj.documents = JSON.parse(obj.documents);
          } catch (e) {
            obj.documents = []; // fallback if invalid JSON
          }
        }
        return obj;
      }),
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

    // Validate client ID
    if (!clientId) {
      return res.status(400).json({
        status: false,
        message: "Client ID is required",
      });
    }

    const client = await Client.findOne({
      where: {
        client_id: clientId, // Use client_id instead of primary key
        company_id: req.user.company_id, // Ensure tenant isolation
      },
      include: [
        {
          model: Address,
          as: "addresses",
        },
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
      attributes: {
        exclude: ["password", "sensitive_data"], // Exclude sensitive fields if any
      },
    });

    // Check if client exists
    if (!client) {
      return res.status(404).json({
        status: false,
        message: "Client not found or you do not have access to this client",
      });
    }

    // Convert to plain object
    const clientData = client.toJSON();

    // Parse 'documents' if it's a string
    if (typeof clientData.documents === "string") {
      try {
        clientData.documents = JSON.parse(clientData.documents);
      } catch (e) {
        clientData.documents = []; // fallback if invalid JSON
      }
    }

    // Build and return response
    const response = {
      status: true,
      data: {
        ...clientData,
        addresses: clientData.addresses || [],
        creator: clientData.creator || null,
        updater: clientData.updater || null,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Client Fetch by ID Error:", {
      clientId: req.params.id,
      errorMessage: error.message,
      errorStack: error.stack,
    });

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        status: false,
        message: "Validation Error",
        errors: error.errors.map((e) => e.message),
      });
    }

    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      errorDetails:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

v1Router.put(
  "/clients/:id",
  authenticateJWT,
  validateClient,
  async (req, res) => {
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
  }
);

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
      `Excel download initiated by user ${req.user.id
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


v1Router.post("/clients/check-gst", authenticateJWT, async (req, res) => {
  try {
    const { gst_number } = req.body;
    const { company_id } = req.user;

    // ✅ Validate required inputs
    if (!company_id || !gst_number) {
      return res.status(400).json({
        success: false,
        message: "Company ID and GST number are required",
      });
    }

    // ✅ Check if GST already exists for the same company
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

    const gstKey = "cfa094f23e71ae949b48752692059f56"; // Replace with actual key or use from process.env
    if (!gstKey) {
      return res.status(500).json({
        success: false,
        message: "GST key is not configured",
      });
    }

    const thirdPartyUrl = `http://sheet.gstincheck.co.in/check/${gstKey}/${gst_number}`;

    let thirdPartyResponse;

    try {
      thirdPartyResponse = await axios.get(thirdPartyUrl);
    } catch (apiError) {
      return res.status(502).json({
        success: false,
        message: "Failed to connect to GST API provider",
        error: apiError.message,
      });
    }

    const gstData = thirdPartyResponse?.data || {};

    // ✅ Handle API limit / credit exhausted
    if (!gstData.flag || gstData.errorCode === "CREDIT_NOT_AVAILABLE") {
      return res.status(200).json({
        success: false,
        message: "GST API credit exhausted or no valid data returned",
        isExisting: false,
        gstDetails: {},
      });
    }

    // ✅ Successful response
    return res.status(200).json({
      success: true,
      message: "GST details fetched successfully",
      isExisting: false,
      gstDetails: gstData.data,
    });
  } catch (error) {
    console.error("Error checking GST:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking GST number",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

v1Router.patch("/clients/:id/status", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id; // Assuming user ID is available from JWT

    // Validate required fields
    if (!status) {
      return res.status(400).json({
        status: false,
        message: "Status is required"
      });
    }

    // Validate status value
    const validStatuses = ['active', 'inactive'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: false,
        message: "Invalid status. Must be 'active' or 'inactive'"
      });
    }

    // Check if client exists
    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({
        status: false,
        message: "Client not found"
      });
    }

    // Check if status is already the same
    if (client.status === status) {
      return res.status(200).json({
        status: true,
        message: `Client status is already ${status}`,
        data: {
          id: client.id,
          client_ui_id: client.client_ui_id,
          company_name: client.company_name,
          display_name: client.display_name,
          status: client.status,
          updated_at: client.updated_at
        }
      });
    }

    // Update client status
    await client.update({
      status: status,
      updated_by: userId,
      updated_at: new Date()
    });

    // Fetch updated client with relations
    const updatedClient = await Client.findByPk(id, {
      include: [
        {
          model: User,
          as: "updater",
          attributes: ["id", "name", "email"],
        },
      ],
    });

    const response = {
      status: true,
      message: `Client status updated to ${status} successfully`,
      data: {
        id: updatedClient.id,
        client_ui_id: updatedClient.client_ui_id,
        company_name: updatedClient.company_name,
        display_name: updatedClient.display_name,
        status: updatedClient.status,
        updated_at: updatedClient.updated_at,
        updated_by: updatedClient.updater
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    logger.error("Client Status Update Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

v1Router.post("/clients/add/wallet-balance", authenticateJWT, async (req, res) => {
  try {
    const { client_id, total_amount, remarks } = req.body;
    const transaction = await sequelize.transaction();
    const companyId = req.user.company_id;
    const userId = req.user.id;

    const result = await db.Client.increment(
      { credit_balance: total_amount },
      {
        where: { client_id: client_id }, // ✅ Use the correct column
        transaction
      }
    );

    await db.WalletHistory.create({
      client_id,
      type: "credit",
      company_id: companyId,
      created_by: userId,
      amount: total_amount,
      refference_number: `Cash received from the customer ! ${remarks || "No remarks provided"}`,
      created_at: new Date()
    }, { transaction });
    console.log("Increment result:", result);

    // ✅ Successful response
    return res.status(200).json({
      success: true,
      message: "Amount has been updated successfully"
    });
  } catch (error) {
    console.error("Error  Adding amount:", error);
    return res.status(500).json({
      success: false,
      message: "Error Adding Amount to Wallet",
      error: error.message
    });
  }
});

v1Router.get("/clients/add/wallet-balance/:id", authenticateJWT, async (req, res) => {
  try {
    const { id: client_id } = req.params;
    const transaction = await sequelize.transaction();
    const companyId = req.user.company_id;
    const userId = req.user.id;
    const WalletHistory = await db.WalletHistory.findOne({
      where: { client_id: client_id }
    });

    // ✅ Successful response
    return res.status(200).json({
      success: true,
      message: "Fetched WalletHistory successfully",
      data: WalletHistory
    });
  } catch (error) {
    console.error("Error  Adding amount:", error);
    return res.status(500).json({
      success: false,
      message: "Error Adding Amount to Wallet",
      error: error.message
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

// await db.sequelize.sync();
const PORT = 3003;
const service = "Client Service";
app.listen(process.env.PORT_CLIENT, '0.0.0.0', () => {
  console.log(`${service} running on port ${process.env.PORT_CLIENT}`);
});
