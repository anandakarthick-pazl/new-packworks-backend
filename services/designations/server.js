import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
// import redisClient, { clearClientCache } from "../../common/helper/redis.js";
import {
  publishToQueue,
  rabbitChannel,
  closeRabbitMQConnection,
} from "../../common/helper/rabbitmq.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import User from "../../common/models/user.model.js";
import Company from "../../common/models/company.model.js";
import DesignationModel from "../../common/models/designation.model.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

// GET single work order by ID

/**
 * @swagger
 * /designations:
 *   post:
 *     summary: Create a new designation
 *     tags:
 *       - Designations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - added_by
 *               - last_updated_by
 *             properties:
 *               name:
 *                 type: string
 *                 example: Project Manager
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 1
 *               added_by:
 *                 type: integer
 *                 example: 101
 *               last_updated_by:
 *                 type: integer
 *                 example: 101
 *     responses:
 *       201:
 *         description: Designation created successfully
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
 *                   example: Designation created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     parent_id:
 *                       type: integer
 *                       nullable: true
 *                     added_by:
 *                       type: integer
 *                     last_updated_by:
 *                       type: integer
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
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
 *                 error:
 *                   type: string
 *                   example: Error creating Designation
 */

v1Router.post("/designations", authenticateJWT, async (req, res) => {
  try {
    let { name, parent_id, added_by, last_updated_by } = req.body;

    // Convert parent_id to integer or null
    parent_id = parent_id ? parseInt(parent_id) : null;

    // Optional: Validate parent_id is a number or null
    if (parent_id !== null && isNaN(parent_id)) {
      return res.status(400).json({ success: false, error: "Invalid parent_id" });
    }

    const newDesignation = await DesignationModel.create({
      name,
      parent_id,
      added_by,
      last_updated_by,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Designation created successfully",
      data: newDesignation,
    });
  } catch (error) {
    console.error("Error creating Designation:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * @swagger
 * /designations:
 *   get:
 *     summary: Get all designations
 *     tags:
 *       - Designations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all designations
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
 *                       name:
 *                         type: string
 *                         example: Project Manager
 *                       parent_id:
 *                         type: integer
 *                         nullable: true
 *                         example: null
 *                       added_by:
 *                         type: integer
 *                         example: 101
 *                       last_updated_by:
 *                         type: integer
 *                         example: 101
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
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
 *                 error:
 *                   type: string
 *                   example: Error fetching Designations
 */

v1Router.get("/designations", authenticateJWT, async (req, res) => {
  try {
    const Designations = await DesignationModel.findAll();
    return res.status(200).json({
      success: true,
      data: Designations,
    });
  } catch (error) {
    console.error("Error fetching Designations:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /designations/{id}:
 *   get:
 *     summary: Get a designation by ID
 *     tags:
 *       - Designations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Designation ID
 *     responses:
 *       200:
 *         description: Designation found
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
 *                     name:
 *                       type: string
 *                       example: Senior Developer
 *                     parent_id:
 *                       type: integer
 *                       nullable: true
 *                       example: null
 *                     added_by:
 *                       type: integer
 *                       example: 101
 *                     last_updated_by:
 *                       type: integer
 *                       example: 102
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Designation not found
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
 *                   example: Designation not found
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Error fetching Designation
 */

v1Router.get("/designations/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const Designation = await DesignationModel.findOne({ where: { id } });

    if (!Designation) {
      return res.status(404).json({
        success: false,
        message: "Designation not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: Designation,
    });
  } catch (error) {
    console.error("Error fetching Designation:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /designations/{id}:
 *   put:
 *     summary: Update a designation by ID
 *     tags:
 *       - Designations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Designation ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Lead Developer
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *               last_updated_by:
 *                 type: integer
 *                 example: 102
 *     responses:
 *       200:
 *         description: Designation updated successfully
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
 *                   example: Designation updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Designation'
 *       404:
 *         description: Designation not found
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
 *                   example: Designation not found
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Error updating Designation
 */

v1Router.put("/designations/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parent_id, last_updated_by } = req.body;

    // Find the existing designation
    const Designation = await DesignationModel.findOne({ where: { id } });

    if (!Designation) {
      return res.status(404).json({
        success: false,
        message: "Designation not found",
      });
    }

    // Update the designation with provided data
    await DesignationModel.update(
      {
        name,
        parent_id,
        last_updated_by,
        updated_at: new Date(),
      },
      {
        where: { id },
      }
    );

    // Refetch the updated record
    const updatedDesignation = await DesignationModel.findOne({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Designation updated successfully",
      data: updatedDesignation,
    });
  } catch (error) {
    console.error("Error updating Designation:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /designations/{id}:
 *   delete:
 *     summary: Delete a designation by ID
 *     tags:
 *       - Designations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Designation ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Designation deleted successfully
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
 *                   example: Designation deleted successfully
 *       404:
 *         description: Designation not found
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
 *                   example: Designation not found
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Error deleting Designation
 */

v1Router.delete("/designations/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const Designation = await DesignationModel.findOne({ where: { id } });

    if (!Designation) {
      return res.status(404).json({
        success: false,
        message: "Designation not found",
      });
    }

    await Designation.destroy();

    return res.status(200).json({
      success: true,
      message: "Designation deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting Designation:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
    // redis: redisClient.status === "ready" ? "connected" : "disconnected",
    rabbitmq: rabbitChannel ? "connected" : "disconnected",
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  // await redisClient.quit();
  await closeRabbitMQConnection();
  process.exit(0);
});

// Use Version 1 Router
app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3011;
app.listen(process.env.PORT_DESIGNATION,'0.0.0.0', () => {
  console.log(`Designations Service running on port ${PORT}`);
});
