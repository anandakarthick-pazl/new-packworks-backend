import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import Company from "../../common/models/company.model.js";
import User from "../../common/models/user.model.js";
import UserAuth from "../../common/models/userAuth.model.js";
import { authenticateJWT, authenticateStaticToken } from "../../common/middleware/auth.js";
import { validateCompany } from "../../common/inputvalidation/validateCompany.js";
import amqp from "amqplib";
import sequelize from '../../common/database/database.js';
import dotenv from "dotenv";
import { logRequestResponse } from "../../common/middleware/errorLogger.js";
import logger from "../../common/helper/logger.js";
dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();
const RABBITMQ_URL = process.env.RABBITMQ_URL; // Update if needed
const QUEUE_NAME = process.env.COMPANY_QUEUE_NAME;
// ✅ Secure all API routes with JWT middleware
// app.use(authenticateStaticToken);
app.use(logRequestResponse)
// 🔹 Create a Company (POST)

/**
 * @swagger
 * /companies:
 *   post:
 *     summary: Create a new company
 *     description: Inserts company and user details using a stored procedure, then queues the company ID in RabbitMQ for background processing.
 *     tags:
 *       - Companies
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - companyAccountDetails
 *             properties:
 *               name:
 *                 type: string
 *                 example: Example Corp
 *               email:
 *                 type: string
 *                 format: email
 *                 example: example@example.com
 *               currency:
 *                 type: string
 *                 example: USD
 *               timezone:
 *                 type: string
 *                 example: Asia/Kolkata
 *               language:
 *                 type: string
 *                 example: en
 *               address:
 *                 type: string
 *                 example: 123 Street, City
 *               phone:
 *                 type: string
 *                 example: +91-9876543210
 *               website:
 *                 type: string
 *                 example: https://example.com
 *               logo:
 *                 type: string
 *                 example: https://example.com/logo.png
 *               companyAccountDetails:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     accountName:
 *                       type: string
 *                       example: John Doe
 *                     accountEmail:
 *                       type: string
 *                       format: email
 *                       example: john@example.com
 *     responses:
 *       200:
 *         description: Company created successfully
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
 *                   example: Company created successfully
 *                 companyId:
 *                   type: integer
 *                   example: 101
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
 *                   example: Failed to create company
 *                 file:
 *                   type: string
 *                   example: services/companies/server.js
 *                 line:
 *                   type: string
 *                   example: "78"
 *                 data:
 *                   type: array
 *                   example: []
 */

v1Router.post("/companies", validateCompany, async (req, res) => {
    const transaction = await sequelize.transaction(); // Start a transaction

    try {
        const { companyAccountDetails, ...companyData } = req.body;

        console.log("🔵 companyAccountDetails:", companyAccountDetails);
        console.log("🔵 companyData:", companyData);

        // 🔹 Step 1: Call Stored Procedure (Insert Company & Users)
        await sequelize.query(
            `CALL ProcedureInsertCompanyAndUsers(
                :name, :email, :currency, :timezone, :language,:address, :phone, :website, :logo,
                :accountName, :accountEmail, :defaultPassword, @newCompanyId);`,
            {
                replacements: {
                    name: companyData.name,
                    email: companyData.email,
                    currency: companyData.currency,
                    timezone: companyData.timezone,
                    language: companyData.language,
                    address: companyData.address,
                    phone: companyData.phone,
                    website: companyData.website,
                    logo: companyData.logo,
                    accountName: companyAccountDetails[0].accountName, // Assuming at least one account
                    accountEmail: companyAccountDetails[0].accountEmail,
                    defaultPassword: "123456" // Default password
                },
                type: sequelize.QueryTypes.RAW,
                transaction
            }
        );

        // 🔹 Step 2: Retrieve the new company ID
        const companyIdResult = await sequelize.query(`SELECT @newCompanyId AS companyId;`, {
            type: sequelize.QueryTypes.SELECT,
            transaction
        });

        const newCompanyId = companyIdResult[0].companyId;
        console.log("✅ New Company ID:", newCompanyId);

        await transaction.commit(); // Commit transaction

        // 🔹 Step 3: Publish `companyId` to RabbitMQ Queue for Background Processing
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        const message = JSON.stringify({ companyId: newCompanyId });
        channel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true });

        console.log(`📩 Sent Company ID ${newCompanyId} to RabbitMQ`);
        await channel.close();
        await connection.close();

        return res.status(200).json({
            status: true,
            message: "Company created successfully",
            companyId: newCompanyId
        });

    } catch (error) {
        await transaction.rollback(); // Rollback transaction if error occurs
        const stackLines = error.stack.split('\n');
        const callerLine = stackLines[1]; // The line where the error occurred
        const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
        let fileName = '';
        let lineNumber = '';

        if (match) {
            fileName = match[1];
            lineNumber = match[2];
        }

        return res.status(500).json({
            status: false,
            message: error.message,
            file: fileName,
            line: lineNumber,
            data: [],
        });
    }
});

// 🔹 Get All Companies (GET)
/**
 * @swagger
 * /companies:
 *   get:
 *     summary: Get all companies
 *     description: Fetches all companies from the database.
 *     tags:
 *       - Companies
 *     responses:
 *       200:
 *         description: List of companies fetched successfully
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
 *                   example: company fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: Example Corp
 *                       email:
 *                         type: string
 *                         example: example@example.com
 *                       address:
 *                         type: string
 *                         example: 123 Street, City
 *                       phone:
 *                         type: string
 *                         example: +91-9876543210
 *                       website:
 *                         type: string
 *                         example: https://example.com
 *                       status:
 *                         type: string
 *                         example: active
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
 *                   example: Failed to fetch companies
 *                 file:
 *                   type: string
 *                   example: services/companies/server.js
 *                 line:
 *                   type: string
 *                   example: "45"
 *                 data:
 *                   type: array
 *                   example: []
 */


v1Router.get("/companies", async (req, res) => {
    try {
        const companies = await Company.findAll();
        return res.status(200).json({
            status: true,
            message: 'company fetched successfully',
            data: companies,
        });
    } catch (error) {
        const stackLines = error.stack.split('\n');
        const callerLine = stackLines[1]; // The line where the error occurred
        const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
        let fileName = '';
        let lineNumber = '';

        if (match) {
            fileName = match[1];
            lineNumber = match[2];
        }

        return res.status(500).json({
            status: false,
            message: error.message,
            file: fileName,
            line: lineNumber,
            data: [],
        });
    }
});

// 🔹 Get a Single Company by ID (GET)
/**
 * @swagger
 * /companies/{id}:
 *   get:
 *     summary: Get a company by ID
 *     description: Fetches a single company based on the provided ID.
 *     tags:
 *       - Companies
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the company to retrieve
 *     responses:
 *       200:
 *         description: Company fetched successfully
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
 *                   example: company fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: Example Corp
 *                     email:
 *                       type: string
 *                       example: example@example.com
 *                     address:
 *                       type: string
 *                       example: 123 Street, City
 *                     phone:
 *                       type: string
 *                       example: +91-9876543210
 *                     website:
 *                       type: string
 *                       example: https://example.com
 *                     status:
 *                       type: string
 *                       example: active
 *       400:
 *         description: Company not found
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
 *                   example: Company not found
 *                 data:
 *                   type: array
 *                   example: []
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
 *                   example: Error message
 *                 file:
 *                   type: string
 *                   example: services/companies/server.js
 *                 line:
 *                   type: string
 *                   example: "65"
 *                 data:
 *                   type: array
 *                   example: []
 */

v1Router.get("/companies/:id", async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(400).json({
                status: false,
                message: 'Company not found',
                data: companies,
            });
        } else {
            return res.status(200).json({
                status: true,
                message: 'company fetched successfully',
                data: company,
            });
        }
    } catch (error) {

        const stackLines = error.stack.split('\n');
        const callerLine = stackLines[1]; // The line where the error occurred
        const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
        let fileName = '';
        let lineNumber = '';

        if (match) {
            fileName = match[1];
            lineNumber = match[2];
        }

        return res.status(500).json({
            status: false,
            message: error.message,
            file: fileName,
            line: lineNumber,
            data: [],
        });
    }
});

// 🔹 Update a Company (PUT)
/**
 * @swagger
 * /companies/{id}:
 *   put:
 *     summary: Update a company by ID
 *     description: Updates an existing company's details, including associated account details.
 *     tags:
 *       - Companies
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the company to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - currency
 *               - timezone
 *               - language
 *               - companyAccountDetails
 *             properties:
 *               name:
 *                 type: string
 *                 example: Example Corp Updated
 *               email:
 *                 type: string
 *                 example: updated@example.com
 *               phone:
 *                 type: string
 *                 example: 9876543210
 *               website:
 *                 type: string
 *                 example: https://updated.com
 *               currency:
 *                 type: integer
 *                 example: 1
 *               timezone:
 *                 type: string
 *                 example: UTC
 *               language:
 *                 type: string
 *                 example: en
 *               address:
 *                 type: string
 *                 example: 123 New Street, City
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: active
 *               logo:
 *                 type: string
 *                 example: https://cdn.example.com/logo.png
 *               companyAccountDetails:
 *                 type: array
 *                 description: List of company bank account details
 *                 items:
 *                   type: object
 *                   required:
 *                     - accountName
 *                     - accountEmail
 *                   properties:
 *                     accountName:
 *                       type: string
 *                       example: Primary Account
 *                     accountEmail:
 *                       type: string
 *                       example: account@example.com
 *     responses:
 *       200:
 *         description: Company updated successfully
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
 *                   example: company updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Company'
 *       400:
 *         description: Company not found or validation error
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
 *                   example: Company not found
 *                 data:
 *                   type: array
 *                   example: []
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
 *                   example: Error message
 *                 file:
 *                   type: string
 *                   example: services/companies/server.js
 *                 line:
 *                   type: string
 *                   example: "78"
 *                 data:
 *                   type: array
 *                   example: []
 */


v1Router.put("/companies/:id", validateCompany, async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(400).json({
                status: false,
                message: 'Company not found',
                data: companies,
            });
        } else {
            await company.update(req.body);
            return res.status(200).json({
                status: true,
                message: 'company updated successfully',
                data: company,
            });
        }


    } catch (error) {

        const stackLines = error.stack.split('\n');
        const callerLine = stackLines[1]; // The line where the error occurred
        const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
        let fileName = '';
        let lineNumber = '';

        if (match) {
            fileName = match[1];
            lineNumber = match[2];
        }

        return res.status(500).json({
            status: false,
            message: error.message,
            file: fileName,
            line: lineNumber,
            data: [],
        });
    }
});

// 🔹 Delete a Company (DELETE)
/**
 * @swagger
 * /companies/{id}:
 *   delete:
 *     summary: Delete a company by ID
 *     description: Permanently deletes a company from the database.
 *     tags:
 *       - Companies
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the company to delete
 *     responses:
 *       200:
 *         description: Company deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                   example: v1
 *                 message:
 *                   type: string
 *                   example: Company deleted successfully
 *       404:
 *         description: Company not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Company not found
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
 *                   example: Error message
 *                 file:
 *                   type: string
 *                   example: services/companies/server.js
 *                 line:
 *                   type: string
 *                   example: "122"
 *                 data:
 *                   type: array
 *                   example: []
 */

v1Router.delete("/companies/:id", async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        await company.destroy();
        res.json({ version: "v1", message: "Company deleted successfully" });
    } catch (error) {

        const stackLines = error.stack.split('\n');
        const callerLine = stackLines[1]; // The line where the error occurred
        const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
        let fileName = '';
        let lineNumber = '';

        if (match) {
            fileName = match[1];
            lineNumber = match[2];
        }

        return res.status(500).json({
            status: false,
            message: error.message,
            file: fileName,
            line: lineNumber,
            data: [],
        });
    }
});

// ✅ Static Token for Internal APIs (e.g., Health Check)
v1Router.get("/health", authenticateStaticToken, (req, res) => {
    res.json({ status: "Service is running", timestamp: new Date() });
});

// Use Version 1 Router
app.use("/api", v1Router);

await db.sequelize.sync();
const PORT = 3001;
const service = 'Company Service';
app.listen(PORT, async () => {
    console.log(`${service} running on port ${PORT}`);
});
