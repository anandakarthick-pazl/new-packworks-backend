import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import redisClient, { clearClientCache } from "../../common/helper/redis.js";
import {
  publishToQueue,
  rabbitChannel,
  closeRabbitMQConnection,
} from "../../common/helper/rabbitmq.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import User from "../../common/models/user.model.js";
import Company from "../../common/models/company.model.js";

app.use(cors());

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();


// GET single work order by ID

/**
 * @swagger
 * /rbac:
 *   get:
 *     summary: Get Role-Based Access Control (RBAC) modules and permissions
 *     description: Fetches modules and permissions for the authenticated user based on their role (superadmin or regular user).
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched RBAC data
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
 *                   example: RABC fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       module_group:
 *                         type: string
 *                         example: "Administration"
 *                       module_id:
 *                         type: integer
 *                         example: 1
 *                       module_name:
 *                         type: string
 *                         example: "User Management"
 *                       modules_description:
 *                         type: string
 *                         example: "Manage system users and roles"
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             permissions_id:
 *                               type: integer
 *                               example: 101
 *                             permissions_name:
 *                               type: string
 *                               example: "create_user"
 *                             permissions_display_name:
 *                               type: string
 *                               example: "Create User"
 *       404:
 *         description: No modules found or user not found
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
 *                   example: Module group is not available
 *       500:
 *         description: Internal server error while fetching RBAC
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal Server Error
 *                 error:
 *                   type: string
 *                   example: Error details
 */

v1Router.get("/rbac", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let rawData;
    
    // ✅ Fetch data based on user role
    if (user.is_superadmin) {
      rawData = await sequelize.query("CALL getActiveModulesWithPermissionsForSuperAdmin()");
    } else {
      rawData = await sequelize.query("CALL getUserModulesWithPermissionsForOtherUsers(:userId)", {
        replacements: { userId },
      });
    }

    // ✅ Ensure data is extracted correctly (ignore metadata)
    const data = Array.isArray(rawData[0]) ? rawData[0] : rawData;

    // ✅ Check if data is empty
    if (!data.length) {
      return res.status(404).json({ status: false, message: "Module group is not available" });
    }

    // ✅ Transform Data into Required JSON Format
    const moduleMap = new Map();

    data.forEach(({ module_group, module_id, module_name, modules_description, permissions_id, permissions_name, permissions_display_name }) => {
      if (!moduleMap.has(module_id)) {
        moduleMap.set(module_id, {
          module_group,
          module_id,
          module_name,
          modules_description,
          permissions: [],
        });
      }

      if (permissions_id) {
        moduleMap.get(module_id).permissions.push({
          permissions_id,
          permissions_name,
          permissions_display_name,
        });
      }
    });

    // ✅ Prepare Final JSON Response
    const formattedResponse = {
      status: true,
      message: "RABC fetched successfully",
      data: Array.from(moduleMap.values()),
    };

    res.json(formattedResponse);
  } catch (error) {
    logger.error("Error fetching modules:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});






// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
    redis: redisClient.status === "ready" ? "connected" : "disconnected",
    rabbitmq: rabbitChannel ? "connected" : "disconnected",
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await redisClient.quit();
  await closeRabbitMQConnection();
  process.exit(0);
});

// Use Version 1 Router
app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3009;
app.listen(PORT,'0.0.0.0', () => {
  console.log(`RBAC Service running on port ${PORT}`);
});
