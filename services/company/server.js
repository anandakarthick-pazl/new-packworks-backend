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
import emailService from "../../common/services/email/emailService.js";
dotenv.config();
import bcrypt from "bcryptjs";

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
        const { companyAccountDetails, package_name, ...companyData } = req.body;

        console.log("🔵 companyAccountDetails:", companyAccountDetails);
        console.log("🔵 companyData:", companyData);
        console.log("🔵 package_name:", package_name);

        // 🔹 Step 1: Find package ID by package name
        let packageId = null;
        if (package_name) {
            const packageResult = await sequelize.query(
                `SELECT id FROM packages WHERE name = ?`,
                {
                    replacements: [package_name],
                    type: sequelize.QueryTypes.SELECT,
                    transaction
                }
            );

            if (packageResult.length === 0) {
                await transaction.rollback();
                return res.status(400).json({
                    status: false,
                    message: `Package with name '${package_name}' not found`,
                    data: []
                });
            }

            packageId = packageResult[0].id;
            console.log("✅ Found Package ID:", packageId);
        }

        // 🔹 Step 2: Call Stored Procedure (Insert Company & Users)
        await sequelize.query(
            `CALL ProcedureInsertCompanyAndUsers(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @newCompanyId);`,
            {
                replacements: [
                    companyData.name,
                    companyData.email,
                    companyData.currency,
                    companyData.timezone,
                    companyData.language,
                    companyData.address,
                    companyData.phone,
                    companyData.website,
                    companyData.logo,
                    companyAccountDetails[0].accountName, // Assuming at least one account
                    companyAccountDetails[0].accountEmail,
                    await bcrypt.hash('123456', 10), // defaultPassword
                    packageId // package_id
                ],
                type: sequelize.QueryTypes.RAW,
                transaction
            }
        );

        // 🔹 Step 3: Retrieve the new company ID from output parameter
        const companyIdResult = await sequelize.query(`SELECT @newCompanyId AS companyId;`, {
            type: sequelize.QueryTypes.SELECT,
            transaction
        });

        const newCompanyId = companyIdResult[0].companyId;
        console.log("✅ New Company ID:", newCompanyId);

        await transaction.commit(); // Commit transaction

        // 🔹 Step 4: Send Welcome Emails (async, non-blocking)
        emailService.sendCompanyRegistrationEmails(
            {
                name: companyData.name,
                email: companyData.email,
                phone: companyData.phone,
                website: companyData.website,
                address: companyData.address
            },
            {
                name: companyAccountDetails[0].accountName,
                email: companyAccountDetails[0].accountEmail,
                username: companyAccountDetails[0].accountEmail, // Username is the email
                password: "123456" // Default password
            }
        ).then(() => {
            logger.info(`📧 Registration emails sent successfully for company: ${companyData.name}`);
        }).catch((emailError) => {
            logger.error(`📧 Failed to send registration emails for company: ${companyData.name}`, {
                error: emailError.message,
                companyId: newCompanyId
            });
            // Don't fail the registration if email fails
        });

        // 🔹 Step 5: Publish `companyId` to RabbitMQ Queue for Background Processing
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        const message = JSON.stringify({ companyId: newCompanyId });
        channel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true });

        console.log(`📩 Sent Company ID ${newCompanyId} to RabbitMQ`);
        await channel.close();
        await connection.close();

        // Return success response immediately (emails are sent asynchronously)
        return res.status(200).json({
            status: true,
            message: "Company created successfully. Welcome emails are being sent.",
            companyId: newCompanyId,
            data: {
                companyName: companyData.name,
                adminEmail: companyAccountDetails[0].accountEmail,
                emailStatus: "sending" // Indicates emails are being processed
            }
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

        logger.error('Company creation failed:', {
            error: error.message,
            file: fileName,
            line: lineNumber,
            // companyData: companyData.name || 'Unknown'
        });

        return res.status(500).json({
            status: false,
            message: error.message,
            file: fileName,
            line: lineNumber,
            data: [],
        });
    }
});


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

// 🔹 Test Email Endpoint (for development/testing)
v1Router.post("/test-email", async (req, res) => {
    try {
        const { companyData, userData } = req.body;

        // Default test data if not provided
        const defaultCompanyData = {
            name: companyData?.name || "Test Company Ltd",
            email: companyData?.email || "test@company.com",
            phone: companyData?.phone || "+1 (555) 123-4567",
            website: companyData?.website || "https://testcompany.com",
            address: companyData?.address || "123 Test Street, Test City"
        };

        const defaultUserData = {
            name: userData?.name || "John Doe",
            email: userData?.email || "john@company.com",
            username: userData?.username || userData?.email || "john@company.com",
            password: userData?.password || "123456"
        };

        logger.info('Testing email functionality with data:', {
            company: defaultCompanyData.name,
            user: defaultUserData.name
        });

        const result = await emailService.sendCompanyRegistrationEmails(
            defaultCompanyData,
            defaultUserData
        );

        return res.status(200).json({
            status: true,
            message: "Test emails sent successfully",
            result: result,
            data: {
                companyData: defaultCompanyData,
                userData: defaultUserData
            }
        });

    } catch (error) {
        logger.error('Test email failed:', error);
        return res.status(500).json({
            status: false,
            message: "Failed to send test emails",
            error: error.message
        });
    }
});

// ✅ Static Token for Internal APIs (e.g., Health Check)
v1Router.get("/health", authenticateStaticToken, (req, res) => {
    res.json({ status: "Service is running", timestamp: new Date() });
});

// Use Version 1 Router
app.use("/api", v1Router);

// await db.sequelize.sync();
const PORT = 3001;
const service = 'Company Service';
app.listen(process.env.PORT_COMPANY, '0.0.0.0', async () => {
    console.log(`${service} running on port ${process.env.PORT_COMPANY}`);
});
