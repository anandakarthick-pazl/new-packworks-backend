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
import ExcelJS from "exceljs";
import { Readable } from "stream";
import { validateClient } from "../../common/inputvalidation/validationClient.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import companyScope from "../../common/middleware/companyScope.js";
import s3Service from "../../common/middleware/upload.js";

import path from "path";
import multer from "multer";
import { S3Client } from "@aws-sdk/client-s3";
import multerS3 from "multer-s3";
// import dotenv from "dotenv";

dotenv.config();

// const router = Router();

// Create S3 client instance
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const Client = db.Client;
const Address = db.ClientAddress;
const User = db.User;

v1Router.post("/direct-upload", authenticateJWT, (req, res) => {
  // Create the upload middleware directly here
  const upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.AWS_BUCKET_NAME,
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        const fileName = `documents/temp/${Date.now()}-${file.originalname}`;
        cb(null, fileName);
      },
    }),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
      const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
      );
      const mimetype = allowedTypes.test(file.mimetype);
      if (extname && mimetype) {
        return cb(null, true);
      } else {
        cb(new Error("Error: Invalid file type!"));
      }
    },
  }).single("file"); // Try with single file first using 'file' as the field name

  upload(req, res, (err) => {
    if (err) {
      console.error("Upload error:", err);
      return res.status(400).json({
        status: false,
        message: err.message,
        details: err.toString(),
        fieldname: req.file ? req.file.fieldname : "unknown",
      });
    }

    console.log("Upload processed");

    if (!req.file) {
      return res
        .status(400)
        .json({ status: false, message: "No file uploaded" });
    }

    // Return file info
    return res.status(200).json({
      status: true,
      message: "File uploaded successfully",
      file: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        key: req.file.key,
        location: req.file.location || req.file.path,
      },
    });
  });
});

// Approach 2: Try with any field name
v1Router.post("/any-field-upload", authenticateJWT, (req, res) => {
  // Create multer middleware that accepts any field
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  }).any();

  upload(req, res, (err) => {
    if (err) {
      console.error("Upload error:", err);
      return res.status(400).json({
        status: false,
        message: err.message,
        details: err.toString(),
      });
    }

    console.log("Upload processed with .any()");
    console.log("Files received:", req.files ? req.files.length : 0);
    console.log(
      "Field names:",
      req.files ? req.files.map((f) => f.fieldname) : []
    );

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "No files uploaded" });
    }

    // Return basic file info
    const fileInfo = req.files.map((file) => ({
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    }));

    return res.status(200).json({
      status: true,
      message: "Files received successfully (any field name)",
      files: fileInfo,
    });
  });
});

// 🔹 Create a Client (POST)
v1Router.post("/clients", authenticateJWT, validateClient, async (req, res) => {
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
    const newClient = await Client.create(newClientData, { transaction: t });

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
      .json({ message: "Error adding client", error: "Email already exists" });
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

      // Update client data
      const updatedClientData = {
        ...clientData,
        updated_by: req.user.id,
        updated_at: new Date(),
      };

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

// Download Clients Data as Excel (GET)
v1Router.get("/clients/download/excel", authenticateJWT, async (req, res) => {
  try {
    let { search, includeInactive = false } = req.query;

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

    // Set up client sheet headers
    clientSheet.columns = [
      { header: "Client ID", key: "client_id", width: 10 },
      { header: "Company Name", key: "company_name", width: 30 },
      { header: "Display Name", key: "display_name", width: 20 },
      { header: "PAN", key: "PAN", width: 15 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Status", key: "status", width: 10 },
      { header: "Created By", key: "created_by_name", width: 20 },
      { header: "Created At", key: "created_at", width: 20 },
      { header: "Updated By", key: "updated_by_name", width: 20 },
      { header: "Updated At", key: "updated_at", width: 20 },
    ];

    // Set up address sheet headers
    addressSheet.columns = [
      { header: "Address ID", key: "id", width: 10 },
      { header: "Client ID", key: "client_id", width: 10 },
      { header: "Company Name", key: "company_name", width: 30 },
      { header: "Address Type", key: "address_type", width: 15 },
      { header: "Address Line 1", key: "address_line1", width: 30 },
      { header: "Address Line 2", key: "address_line2", width: 30 },
      { header: "City", key: "city", width: 20 },
      { header: "State", key: "state", width: 20 },
      { header: "Country", key: "country", width: 20 },
      { header: "Postal Code", key: "postal_code", width: 15 },
      { header: "Status", key: "status", width: 10 },
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
        company_name: client.company_name,
        display_name: client.display_name,
        PAN: client.PAN,
        email: client.email,
        phone: client.phone,
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
            company_name: client.company_name, // Add company name for reference
            address_type: address.address_type,
            address_line1: address.address_line1,
            address_line2: address.address_line2,
            city: address.city,
            state: address.state,
            country: address.country,
            postal_code: address.postal_code,
            status: address.status,
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `clients-data${searchSuffix}-${timestamp}.xlsx`;

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
      } with filters: ${JSON.stringify({ search, includeInactive })}`
    );
  } catch (error) {
    logger.error("Excel Download Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// Create a general upload middleware for documents
// Create a general upload middleware for documents
const uploadDocuments = (req, res, next) => {
  const upload = s3Service.createS3Upload({
    folderPath: `documents/temp`,
    fileSizeLimit: 15 * 1024 * 1024, // 15MB for documents
    maxFiles: 10,
    fieldName: "files", // Make sure this matches the field name in Postman
  });

  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ status: false, message: err.message });
    }
    next();
  });
};

v1Router.post("/upload-debug", authenticateJWT, (req, res) => {
  console.log("Request received, preparing upload");
  console.log("Content-Type:", req.headers["content-type"]);

  const upload = s3Service.createS3Upload({
    folderPath: `documents/temp`,
    fileSizeLimit: 15 * 1024 * 1024,
    maxFiles: 10,
    fieldName: "files",
  });

  upload(req, res, (err) => {
    if (err) {
      console.error("Upload error:", err);
      console.error("Error name:", err.name);
      console.error("Error message:", err.message);
      return res
        .status(400)
        .json({ status: false, message: err.message, details: err.toString() });
    }

    console.log("Upload processed");
    console.log("Files received:", req.files ? req.files.length : 0);

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "No files uploaded" });
    }

    // Return basic file info for debugging
    const fileInfo = req.files.map((file) => ({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      key: file.key,
      location: file.location,
    }));

    return res.status(200).json({
      status: true,
      message: "Files uploaded successfully",
      files: fileInfo,
    });
  });
});
// Upload Documents without client association
v1Router.post("/upload", authenticateJWT, uploadDocuments, async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ status: false, message: "No files uploaded" });
    }

    // Process uploaded files
    const uploadedDocuments = req.files.map((file) => {
      const docInfo = s3Service.formatFileInfo(file, req.user.id);
      return {
        ...docInfo,
        temp: true, // Mark as temporary until associated with a client
      };
    });

    // Store the document info in your database or temporary storage
    // Option 1: If you have a separate Document model
    const savedDocuments = [];
    for (const doc of uploadedDocuments) {
      const savedDoc = await Document.create(
        {
          ...doc,
          created_by: req.user.id,
          created_at: new Date(),
        },
        { transaction: t }
      );
      savedDocuments.push(savedDoc);
    }

    await t.commit();

    return res.status(200).json({
      status: true,
      message: "Documents uploaded successfully",
      documents: savedDocuments,
    });
  } catch (error) {
    await t.rollback();
    logger.error("Document Upload Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// Associate uploaded documents with a client
v1Router.post("/:id/associate-documents", authenticateJWT, async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const clientId = req.params.id;
    const { documentIds } = req.body; // Array of document IDs to associate

    if (!documentIds || !Array.isArray(documentIds)) {
      await t.rollback();
      return res
        .status(400)
        .json({ status: false, message: "Document IDs array is required" });
    }

    // Check if client exists
    const client = await Client.findByPk(clientId, { transaction: t });
    if (!client) {
      await t.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Client not found" });
    }

    // Get existing documents
    let existingDocuments = client.documents || [];
    if (!Array.isArray(existingDocuments)) {
      existingDocuments = [];
    }

    // Fetch documents to associate
    const documentsToAssociate = await Document.findAll({
      where: {
        id: documentIds,
        temp: true, // Only associate temporary documents
      },
      transaction: t,
    });

    if (documentsToAssociate.length !== documentIds.length) {
      await t.rollback();
      return res.status(400).json({
        status: false,
        message:
          "Some documents were not found or are already associated with a client",
      });
    }

    // Update documents to be associated with this client
    const updatedDocs = [];
    for (const doc of documentsToAssociate) {
      // Mark document as associated with this client
      await doc.update(
        {
          temp: false,
          client_id: clientId,
          updated_by: req.user.id,
          updated_at: new Date(),
        },
        { transaction: t }
      );

      updatedDocs.push(doc);
    }

    // Add new documents to client's documents array
    const docsToAdd = updatedDocs.map((d) => ({
      id: d.id,
      name: d.name,
      url: d.url,
      key: d.key,
      size: d.size,
      type: d.type,
      uploaded_by: d.uploaded_by,
      uploaded_at: d.uploaded_at,
    }));

    const updatedDocuments = [...existingDocuments, ...docsToAdd];

    // Update client with new documents
    await client.update(
      {
        documents: updatedDocuments,
        updated_by: req.user.id,
        updated_at: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    return res.status(200).json({
      status: true,
      message: "Documents associated with client successfully",
      documents: docsToAdd,
    });
  } catch (error) {
    await t.rollback();
    logger.error("Document Association Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// Get all documents for a client
v1Router.get("/:id/documents", authenticateJWT, async (req, res) => {
  try {
    const clientId = req.params.id;

    // Check if client exists
    const client = await Client.findByPk(clientId);
    if (!client) {
      return res
        .status(404)
        .json({ status: false, message: "Client not found" });
    }

    // Return client documents
    const documents = client.documents || [];

    return res.status(200).json({
      status: true,
      documents: documents,
    });
  } catch (error) {
    logger.error("Fetch Documents Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});

// Delete a Document
v1Router.delete("/documents/:documentId", authenticateJWT, async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { documentId } = req.params;

    // Find the document
    const document = await Document.findByPk(documentId, { transaction: t });
    if (!document) {
      await t.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Document not found" });
    }

    // If document is associated with a client, update the client's documents array
    if (document.client_id) {
      const client = await Client.findByPk(document.client_id, {
        transaction: t,
      });
      if (client) {
        let clientDocuments = client.documents || [];
        if (!Array.isArray(clientDocuments)) {
          clientDocuments = [];
        }

        // Remove the document from the client's documents array
        const updatedDocuments = clientDocuments.filter(
          (doc) => doc.id !== documentId
        );

        // Update client
        await client.update(
          {
            documents: updatedDocuments,
            updated_by: req.user.id,
            updated_at: new Date(),
          },
          { transaction: t }
        );
      }
    }

    // Delete the file from S3
    try {
      await s3Service.deleteS3File(document.key);
    } catch (s3Error) {
      logger.error("S3 Delete Error:", s3Error);
      // Continue with deletion from database even if S3 deletion fails
    }

    // Delete document record
    await document.destroy({ transaction: t });

    await t.commit();

    return res.status(200).json({
      status: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    await t.rollback();
    logger.error("Document Delete Error:", error);
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
