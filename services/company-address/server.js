import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import Company from "../../common/models/company.model.js";
import User from "../../common/models/user.model.js";
import UserAuth from "../../common/models/userAuth.model.js";
import { authenticateJWT, authenticateStaticToken } from "../../common/middleware/auth.js";
import { validateCompanyAddress } from "../../common/inputvalidation/validateCompanyAddress.js";
import amqp from "amqplib";
import sequelize from '../../common/database/database.js';
import dotenv from "dotenv";
import { logRequestResponse } from "../../common/middleware/errorLogger.js";
import logger from "../../common/helper/logger.js";
import CompanyAddress from "../../common/models/companyAddress.model.js";

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


v1Router.get("/companies-address", async (req, res) => {
    try {
        const addresses = await CompanyAddress.findAll();
        res.json({ success: true, data: addresses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * 🔹 GET Single Address by ID
 */
v1Router.get("/companies-address/:id", authenticateJWT,async (req, res) => {
    try {
        const address = await CompanyAddress.findByPk(req.params.id);
        if (!address) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }
        res.json({ success: true, data: address });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * 🔹 CREATE a New Address
 */
v1Router.post("/companies-address", authenticateJWT,validateCompanyAddress, async (req, res) => {
    try {
        const { company_id, country_id, address, tax_number, tax_name, location, latitude, longitude } = req.body;

        const newAddress = await CompanyAddress.create({
            company_id,
            country_id,
            address,
            tax_number,
            tax_name,
            location,
            latitude,
            longitude,
            is_default: 0, // Default is not primary address
            created_at: new Date(),
            updated_at: new Date(),
        });

        res.status(201).json({ success: true, message: "Address created successfully", data: newAddress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * 🔹 UPDATE an Address by ID
 */
v1Router.put("/companies-address/:id",authenticateJWT,validateCompanyAddress, async (req, res) => {
    try {
        const { address, tax_number, tax_name, location, latitude, longitude } = req.body;

        const addressToUpdate = await CompanyAddress.findByPk(req.params.id);
        if (!addressToUpdate) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        await addressToUpdate.update({
            address,
            tax_number,
            tax_name,
            location,
            latitude,
            longitude,
            updated_at: new Date(),
        });

        res.json({ success: true, message: "Address updated successfully", data: addressToUpdate });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * 🔹 DELETE an Address (Update Status)
 */
v1Router.delete("/companies-address/:id",authenticateJWT, async (req, res) => {
    try {
        const addressToDelete = await CompanyAddress.findByPk(req.params.id);
        if (!addressToDelete) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        await addressToDelete.update({ is_default: 0 });

        res.json({ success: true, message: "Address status updated to inactive" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ✅ Static Token for Internal APIs (e.g., Health Check)
v1Router.get("/health", authenticateStaticToken, (req, res) => {
    res.json({ status: "Service is running", timestamp: new Date() });
});

// Use Version 1 Router
app.use("/api", v1Router);

await db.sequelize.sync();
const PORT = 3014;
const service = 'CompanyAddress Service';
app.listen(PORT, async () => {
    console.log(`${service} running on port ${PORT}`);
});
