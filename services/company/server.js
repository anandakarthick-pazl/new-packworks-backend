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
