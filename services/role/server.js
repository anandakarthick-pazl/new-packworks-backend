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
import Role from "../../common/models/role.model.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

// GET single work order by ID

/**
 * @swagger
 * /role:
 *   post:
 *     summary: Create a new role
 *     tags:
 *       - Roles
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
 *               - display_name
 *               - status
 *             properties:
 *               name:
 *                 type: string
 *                 example: admin
 *               display_name:
 *                 type: string
 *                 example: Administrator
 *               description:
 *                 type: string
 *                 example: Full access to the system
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: active
 *               created_by:
 *                 type: integer
 *                 example: 1
 *               updated_by:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Role created successfully
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
 *                   example: Role created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Role'
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
 *                   example: Error creating role
 */

v1Router.post("/role", authenticateJWT, async (req, res) => {
  try {
    const { name, display_name, description, status, created_by, updated_by } =
      req.body;
    const company_id = req.user.company_id;

    const newRole = await Role.create({
      name,
      display_name,
      description,
      status,
      created_by,
      updated_by,
      company_id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: newRole,
    });
  } catch (error) {
    console.error("Error creating role:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /role:
 *   get:
 *     summary: Get all roles
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles fetched successfully
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
 *                     $ref: '#/components/schemas/Role'
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
 *                   example: Error fetching roles
 */

v1Router.get("/role", authenticateJWT, async (req, res) => {
  try {
    const roles = await Role.findAll({
      where: {
        name: { [Op.ne]: "superadmin" }, // exclude SuperAdmin
      },
    });

    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /role/{id}:
 *   get:
 *     summary: Get a role by ID
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the role to retrieve
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Role fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       404:
 *         description: Role not found
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
 *                   example: Role not found
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
 *                   example: Error fetching role
 */

v1Router.get("/role/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findOne({ where: { id } });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("Error fetching role:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /role/{id}:
 *   put:
 *     summary: Update an existing role by ID
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the role to update
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
 *                 example: admin
 *               display_name:
 *                 type: string
 *                 example: Administrator
 *               description:
 *                 type: string
 *                 example: Full access to all modules
 *               status:
 *                 type: string
 *                 example: active
 *               updated_by:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Role updated successfully
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
 *                   example: Role updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       404:
 *         description: Role not found
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
 *                   example: Role not found
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
 *                   example: Error updating role
 */

v1Router.put("/role/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_name, description, status, updated_by } = req.body;

    const role = await Role.findOne({ where: { id } });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    await role.update({
      name,
      display_name,
      description,
      status,
      updated_by,
      updated_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: role,
    });
  } catch (error) {
    console.error("Error updating role:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.delete("/role/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findOne({ where: { id } });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    await role.destroy();

    return res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting role:", error);
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
const PORT = 3012;
app.listen(PORT, () => {
  console.log(`Role Service running on port ${PORT}`);
});
