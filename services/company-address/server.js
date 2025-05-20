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

/**
 * @swagger
 * /companies-address:
 *   get:
 *     summary: Get a list of all company addresses
 *     tags:
 *       - Company Address
 *     responses:
 *       200:
 *         description: A list of company addresses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       company_id:
 *                         type: integer
 *                         example: 10
 *                       address_line_1:
 *                         type: string
 *                         example: 123 Business St
 *                       city:
 *                         type: string
 *                         example: New York
 *                       state:
 *                         type: string
 *                         example: NY
 *                       country:
 *                         type: string
 *                         example: USA
 *                       zip_code:
 *                         type: string
 *                         example: 10001
 *       500:
 *         description: Server error
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
 *                   example: Internal server error
 */

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
/**
 * @swagger
 * /companies-address/{id}:
 *   get:
 *     summary: Get a company address by ID
 *     tags:
 *       - Company Address
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the company address
 *     responses:
 *       200:
 *         description: Company address details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     company_id:
 *                       type: integer
 *                       example: 10
 *                     address_line_1:
 *                       type: string
 *                       example: 123 Business St
 *                     city:
 *                       type: string
 *                       example: New York
 *                     state:
 *                       type: string
 *                       example: NY
 *                     country:
 *                       type: string
 *                       example: USA
 *                     zip_code:
 *                       type: string
 *                       example: 10001
 *       404:
 *         description: Address not found
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
 *                   example: Address not found
 *       500:
 *         description: Server error
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
 *                   example: Internal server error
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
/**
 * @swagger
 * /companies-address:
 *   post:
 *     summary: Create a new company address
 *     tags:
 *       - Company Address
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company_id
 *               - country_id
 *               - address
 *             properties:
 *               company_id:
 *                 type: integer
 *                 example: 1
 *               country_id:
 *                 type: integer
 *                 example: 101
 *               address:
 *                 type: string
 *                 example: "123 Business St, Suite 400"
 *               tax_number:
 *                 type: string
 *                 example: "TAX123456"
 *               tax_name:
 *                 type: string
 *                 example: "GST"
 *               location:
 *                 type: string
 *                 example: "Downtown"
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 37.7749
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: -122.4194
 *     responses:
 *       201:
 *         description: Address created successfully
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
 *                   example: Address created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 10
 *                     company_id:
 *                       type: integer
 *                       example: 1
 *                     address:
 *                       type: string
 *                       example: "123 Business St, Suite 400"
 *                     tax_number:
 *                       type: string
 *                       example: "TAX123456"
 *                     tax_name:
 *                       type: string
 *                       example: "GST"
 *                     location:
 *                       type: string
 *                       example: "Downtown"
 *                     latitude:
 *                       type: number
 *                       example: 37.7749
 *                     longitude:
 *                       type: number
 *                       example: -122.4194
 *                     is_default:
 *                       type: integer
 *                       example: 0
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
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
 *                   example: Internal server error
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
/**
 * @swagger
 * /companies-address/{id}:
 *   put:
 *     summary: Update an existing company address
 *     tags:
 *       - Company Address
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the address to update
 *         schema:
 *           type: integer
 *           example: 10
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *                 example: "456 Updated Ave, Floor 5"
 *               tax_number:
 *                 type: string
 *                 example: "TAX987654"
 *               company_id:
 *                 type: integer
 *                 example: 1
 *               country_id:
 *                 type: integer
 *                 example: 101
 *               tax_name:
 *                 type: string
 *                 example: "VAT"
 *               location:
 *                 type: string
 *                 example: "Business Bay"
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 25.2048
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: 55.2708
 *     responses:
 *       200:
 *         description: Address updated successfully
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
 *                   example: Address updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/CompanyAddress'
 *       404:
 *         description: Address not found
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
 *                   example: Address not found
 *       500:
 *         description: Internal server error
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
 *                   example: Internal server error
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
/**
 * @swagger
 * /companies-address/{id}:
 *   delete:
 *     summary: Mark a company address as inactive
 *     tags:
 *       - Company Address
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the address to deactivate
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: Address status updated to inactive
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
 *                   example: Address status updated to inactive
 *       404:
 *         description: Address not found
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
 *                   example: Address not found
 *       500:
 *         description: Internal server error
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
 *                   example: Internal server error
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
app.listen(process.env.PORT_COMPANY_ADDRESS,'0.0.0.0', async () => {
    console.log(`${service} running on port ${PORT}`);
});
