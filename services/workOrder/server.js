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
import companyScope from "../../common/middleware/companyScope.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const WorkOrder = db.WorkOrder;

// Redis cache keys
// Add these routes to your existing v1Router

// Redis cache keys for work orders
const WORK_ORDER_CACHE_KEYS = {
  WORK_ORDER_LIST: "work_orders:all",
  WORK_ORDER_DETAIL: "work_order:",
};

// Redis cache keys for sales orders
const CACHE_KEYS = {
  SALES_ORDER_DETAIL: "sales_order:",
};

// RabbitMQ queues for work orders
const WORK_ORDER_QUEUES = {
  WORK_ORDER_CREATED: "work_order.created",
  WORK_ORDER_UPDATED: "work_order.updated",
  WORK_ORDER_DELETED: "work_order.deleted",
};

// POST create new work order
/**
 * @swagger
 * /work-order:
 *   post:
 *     summary: Create a new work order
 *     description: Creates a new work order record. Sends a message to RabbitMQ and clears related caches.
 *     tags:
 *       - Work Orders
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - created_by
 *               - updated_by
 *             properties:
 *               company_id:
 *                 type: integer
 *               client_id:
 *                 type: integer
 *               sales_order_id:
 *                 type: integer
 *                 nullable: true
 *               manufacture:
 *                 type: string
 *                 enum: [inhouse, outsource]
 *               sku_name:
 *                 type: string
 *                 nullable: true
 *               sku_version:
 *                 type: string
 *                 nullable: true
 *               qty:
 *                 type: number
 *                 nullable: true
 *               edd:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               description:
 *                 type: string
 *                 nullable: true
 *               acceptable_excess_units:
 *                 type: number
 *                 nullable: true
 *               planned_start_date:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               planned_end_date:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               outsource_name:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 default: active
 *               created_by:
 *                 type: integer
 *               updated_by:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Work Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Work Order created successfully
 *                 data:
 *                   $ref: '#/components/schemas/WorkOrder'
 *       400:
 *         description: Invalid input data or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid input data
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

v1Router.post("/work-order", authenticateJWT, async (req, res) => {
  const workDetails = req.body;

  if (!workDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  // Validate required fields
  if (!workDetails.created_by || !workDetails.updated_by) {
    return res.status(400).json({
      message:
        "Missing required fields: created_by and updated_by are required",
    });
  }

  try {
    // Create Work Order
    const newWorkOrder = await WorkOrder.create({
      company_id: workDetails.company_id,
      client_id: workDetails.client_id,
      sales_order_id: workDetails.sales_order_id || null,
      manufacture: workDetails.manufacture,
      sku_name: workDetails.sku_name || null,
      sku_version: workDetails.sku_version || null,
      qty: workDetails.qty || null,
      edd: workDetails.edd || null,
      description: workDetails.description || null,
      acceptable_excess_units: workDetails.acceptable_excess_units || null,
      planned_start_date: workDetails.planned_start_date || null,
      planned_end_date: workDetails.planned_end_date || null,
      outsource_name:
        workDetails.manufacture === "outsource"
          ? workDetails.outsource_name
          : null,
      status: workDetails.status || "active", 
      created_by: workDetails.created_by,
      updated_by: workDetails.updated_by,
    });

    // Clear cache
    await clearClientCache(`${WORK_ORDER_CACHE_KEYS.WORK_ORDER_LIST}:*`);

    // If work order is associated with a sales order, clear that cache too
    if (workDetails.sales_order_id) {
      await clearClientCache(
        `${CACHE_KEYS.SALES_ORDER_DETAIL}${workDetails.sales_order_id}`
      );
    }

    // Send to RabbitMQ
    await publishToQueue(
      WORK_ORDER_QUEUES.WORK_ORDER_CREATED,
      newWorkOrder.get({ plain: true })
    );

    res.status(201).json({
      message: "Work Order created successfully",
      data: newWorkOrder,
    });
  } catch (error) {
    logger.error("Error creating work order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET all work orders with pagination and filtering
/**
 * @swagger
 * /work-order:
 *   get:
 *     summary: Get list of work orders
 *     description: Retrieves a paginated list of work orders with optional filters like SKU name, manufacture type, client, sales order, and status. Cached for 5 minutes.
 *     tags:
 *       - Work Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sku_name
 *         schema:
 *           type: string
 *         description: Filter by SKU name (partial match)
 *       - in: query
 *         name: manufacture
 *         schema:
 *           type: string
 *           enum: [inhouse, outsource]
 *         description: Filter by manufacture type
 *       - in: query
 *         name: client_id
 *         schema:
 *           type: integer
 *         description: Filter by client ID
 *       - in: query
 *         name: sales_order_id
 *         schema:
 *           type: integer
 *         description: Filter by associated sales order ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, all]
 *           default: active
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of work orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WorkOrder'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

v1Router.get("/work-order", authenticateJWT,companyScope, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sku_name,
      manufacture,
      client_id,
      sales_order_id,
      status = "active", // Default to showing only active work orders
    } = req.query;

    const offset = (page - 1) * limit;

    // Try to get from cache first
    const cacheKey = `${
      WORK_ORDER_CACHE_KEYS.WORK_ORDER_LIST
    }:${page}:${limit}:${sku_name || ""}:${manufacture || ""}:${
      client_id || ""
    }:${sales_order_id || ""}:${status || ""}`;

    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // Build filter conditions
    const where = {};
    if (sku_name) where.sku_name = { [Op.like]: `%${sku_name}%` };
    if (manufacture) where.manufacture = manufacture;
    if (client_id) where.client_id = client_id;
    if (sales_order_id) where.sales_order_id = sales_order_id;

    // Filter by status - allow "all" to return both active and inactive records
    if (status && status !== "all") {
      where.status = status;
    }

    // Fetch data from database
    const { count, rows } = await WorkOrder.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    // Prepare result
    const result = {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      data: rows.map((workOrder) => workOrder.get({ plain: true })),
    };

    // Cache the result
    await redisClient.set(cacheKey, JSON.stringify(result), "EX", 300); // Cache for 5 minutes

    res.json(result);
  } catch (error) {
    logger.error("Error fetching work orders:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET single work order by ID
/**
 * @swagger
 * /work-order/{id}:
 *   get:
 *     summary: Get work order by ID
 *     description: Retrieves detailed information of a single work order by its ID. Response is cached.
 *     tags:
 *       - Work Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Work order ID
 *     responses:
 *       200:
 *         description: Work order details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkOrder'
 *       404:
 *         description: Work order not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

v1Router.get("/work-order/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    // Try to get from cache first
    const cacheKey = `${WORK_ORDER_CACHE_KEYS.WORK_ORDER_DETAIL}${id}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // Fetch from database
    const workOrder = await WorkOrder.findByPk(id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    const result = workOrder.get({ plain: true });

    // Cache the result
    await redisClient.set(cacheKey, JSON.stringify(result)); 

    res.json(result);
  } catch (error) {
    logger.error("Error fetching work order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// PUT update existing work order
/**
 * @swagger
 * /work-order/{id}:
 *   put:
 *     summary: Update a work order
 *     description: Updates an existing work order by its ID. Clears relevant caches and sends update event to RabbitMQ.
 *     tags:
 *       - Work Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the work order to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updated_by
 *             properties:
 *               company_id:
 *                 type: integer
 *               client_id:
 *                 type: integer
 *               sales_order_id:
 *                 type: integer
 *                 nullable: true
 *               manufacture:
 *                 type: string
 *                 enum: [inhouse, outsource]
 *               sku_name:
 *                 type: string
 *               sku_version:
 *                 type: string
 *               qty:
 *                 type: number
 *               edd:
 *                 type: string
 *                 format: date
 *               description:
 *                 type: string
 *               acceptable_excess_units:
 *                 type: number
 *               planned_start_date:
 *                 type: string
 *                 format: date
 *               planned_end_date:
 *                 type: string
 *                 format: date
 *               outsource_name:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *               updated_by:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Work order updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Work Order updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/WorkOrder'
 *       400:
 *         description: Missing required fields or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Work order not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

v1Router.put("/work-order/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const workDetails = req.body;

  if (!workDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  // Validate updated_by field
  if (!workDetails.updated_by) {
    return res.status(400).json({
      message: "Missing required field: updated_by is required",
    });
  }

  try {
    // Find the work order
    const workOrder = await WorkOrder.findByPk(id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    const oldSalesOrderId = workOrder.sales_order_id;

    // Update work order
    await workOrder.update({
      company_id: workDetails.company_id,
      client_id: workDetails.client_id,
      sales_order_id: workDetails.sales_order_id || null,
      manufacture: workDetails.manufacture,
      sku_name: workDetails.sku_name || null,
      sku_version: workDetails.sku_version || null,
      qty: workDetails.qty || null,
      edd: workDetails.edd || null,
      description: workDetails.description || null,
      acceptable_excess_units: workDetails.acceptable_excess_units || null,
      planned_start_date: workDetails.planned_start_date || null,
      planned_end_date: workDetails.planned_end_date || null,
      outsource_name:workDetails.outsource_name || null,
        // workDetails.manufacture === "outsource"
        //   ? workDetails.outsource_name
        //   : null,
      status: workDetails.status || workOrder.status, // Keep existing status if not provided
      updated_by: workDetails.updated_by,
      updated_at: sequelize.updated_at,
    });

    // Clear caches
    await clearClientCache(`${WORK_ORDER_CACHE_KEYS.WORK_ORDER_LIST}:*`);
    await clearClientCache(`${WORK_ORDER_CACHE_KEYS.WORK_ORDER_DETAIL}${id}`);

    // Clear sales order caches if associated
    if (oldSalesOrderId) {
      await clearClientCache(
        `${CACHE_KEYS.SALES_ORDER_DETAIL}${oldSalesOrderId}`
      );
    }

    if (
      workDetails.sales_order_id &&
      workDetails.sales_order_id !== oldSalesOrderId
    ) {
      await clearClientCache(
        `${CACHE_KEYS.SALES_ORDER_DETAIL}${workDetails.sales_order_id}`
      );
    }

    // Send to RabbitMQ
    await publishToQueue(
      WORK_ORDER_QUEUES.WORK_ORDER_UPDATED,
      workOrder.get({ plain: true })
    );

    res.json({
      message: "Work Order updated successfully",
      data: workOrder,
    });
  } catch (error) {
    logger.error("Error updating work order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// DELETE work order (soft delete)
/**
 * @swagger
 * /work-order/{id}:
 *   delete:
 *     summary: Soft delete a work order
 *     description: Marks the work order as inactive instead of permanently deleting it. Clears related caches and publishes event to RabbitMQ.
 *     tags:
 *       - Work Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the work order to delete
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updated_by
 *             properties:
 *               updated_by:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Work Order successfully marked as inactive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Work Order successfully marked as inactive
 *                 data:
 *                   $ref: '#/components/schemas/WorkOrder'
 *       400:
 *         description: Missing required fields or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Work order not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

v1Router.delete("/work-order/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { updated_by } = req.body;

  // Validate updated_by field
  if (!updated_by) {
    return res.status(400).json({
      message: "Missing required field: updated_by is required",
    });
  }

  try {
    // Find the work order
    const workOrder = await WorkOrder.findByPk(id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    // Store data for notification and cache clearing
    const workOrderData = workOrder.get({ plain: true });
    const salesOrderId = workOrder.sales_order_id;

    // Soft delete - update status to inactive
    await workOrder.update({
      status: "inactive",
      updated_by: updated_by,
      updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
    });

    // Clear caches
    await clearClientCache(`${WORK_ORDER_CACHE_KEYS.WORK_ORDER_LIST}:*`);
    await clearClientCache(`${WORK_ORDER_CACHE_KEYS.WORK_ORDER_DETAIL}${id}`);

    // Clear associated sales order cache if needed
    if (salesOrderId) {
      await clearClientCache(`${CACHE_KEYS.SALES_ORDER_DETAIL}${salesOrderId}`);
    }

    // Send to RabbitMQ - include the fact this was a soft delete
    await publishToQueue(WORK_ORDER_QUEUES.WORK_ORDER_DELETED, {
      ...workOrder.get({ plain: true }),
      soft_deleted: true,
    });

    res.json({
      message: "Work Order successfully marked as inactive",
      data: workOrder.get({ plain: true }),
    });
  } catch (error) {
    logger.error("Error soft deleting work order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET work orders by sales order ID
/**
 * @swagger
 * /sales-order/{salesOrderId}/work-orders:
 *   get:
 *     summary: Get work orders by Sales Order ID
 *     description: Retrieve all work orders associated with a given sales order. Supports filtering by status.
 *     tags:
 *       - Work Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: salesOrderId
 *         required: true
 *         description: ID of the sales order
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         required: false
 *         description: Filter by work order status (e.g., active, inactive, or all)
 *         schema:
 *           type: string
 *           default: active
 *     responses:
 *       200:
 *         description: List of work orders for the sales order
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WorkOrder'
 *       404:
 *         description: Sales order not found or no work orders associated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

v1Router.get(
  "/sales-order/:sales-orderId/work-orders",
  authenticateJWT,
  async (req, res) => {
    try {
      const { salesOrderId } = req.params;
      const { status = "active" } = req.query; // Default to showing only active work orders

      // Try to get from cache first
      const cacheKey = `sales_order:${salesOrderId}:workorders:${status}`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      // Build where clause
      const where = { sales_order_id: salesOrderId };

      // Filter by status unless "all" is specified
      if (status && status !== "all") {
        where.status = status;
      }

      // Fetch from database
      const workOrders = await WorkOrder.findAll({
        where,
        order: [["created_at", "DESC"]],
      });

      const result = workOrders.map((wo) => wo.get({ plain: true }));

      // Cache the result
      await redisClient.set(cacheKey, JSON.stringify(result), "EX", 300); // Cache for 5 minutes

      res.json(result);
    } catch (error) {
      logger.error("Error fetching work orders by sales order:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

// Bulk update work orders status
/**
 * @swagger
 * /work-order/bulk-update:
 *   patch:
 *     summary: Bulk update work order statuses
 *     description: Updates the status (and optionally reason) of multiple work orders at once.
 *     tags:
 *       - Work Orders
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *               - status
 *               - updated_by
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of Work Order IDs to update
 *               status:
 *                 type: string
 *                 description: New status to apply
 *               status_reason:
 *                 type: string
 *                 description: Optional reason for status update
 *               updated_by:
 *                 type: integer
 *                 description: User ID performing the update
 *     responses:
 *       200:
 *         description: Work orders updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 updatedIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 updatedCount:
 *                   type: integer
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

v1Router.patch("/work-order/bulk-update", authenticateJWT, async (req, res) => {
  const { ids, status, status_reason, updated_by } = req.body;

  if (
    !ids ||
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !status ||
    !updated_by
  ) {
    return res.status(400).json({
      message: "Invalid input data. ids, status, and updated_by are required",
    });
  }

  const transaction = await WorkOrder.sequelize.transaction();

  try {
    // Update all work orders in the list
    const [updatedCount] = await WorkOrder.update(
      {
        status,
        status_reason: status_reason || null,
        updated_by,
        updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
      },
      {
        where: { id: { [Op.in]: ids } },
        transaction,
      }
    );

    // Fetch the updated work orders
    const updatedWorkOrders = await WorkOrder.findAll({
      where: { id: { [Op.in]: ids } },
      transaction,
    });

    // Collect all affected sales order IDs
    const salesOrderIds = [
      ...new Set(
        updatedWorkOrders
          .map((wo) => wo.sales_order_id)
          .filter((id) => id !== null)
      ),
    ];

    await transaction.commit();

    // Clear caches
    await clearClientCache(`${WORK_ORDER_CACHE_KEYS.WORK_ORDER_LIST}:*`);

    // Clear individual work order caches
    for (const id of ids) {
      await clearClientCache(`${WORK_ORDER_CACHE_KEYS.WORK_ORDER_DETAIL}${id}`);
    }

    // Clear affected sales order caches
    for (const salesOrderId of salesOrderIds) {
      await clearClientCache(`${CACHE_KEYS.SALES_ORDER_DETAIL}${salesOrderId}`);
      await clearClientCache(`sales_order:${salesOrderId}:workorders:*`);
    }

    // Send to RabbitMQ
    await publishToQueue(WORK_ORDER_QUEUES.WORK_ORDER_UPDATED, {
      ids,
      updated: updatedCount,
      status,
      status_reason,
      updated_by,
    });

    res.json({
      message: `${updatedCount} Work Orders updated successfully`,
      updatedIds: ids,
      updatedCount,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error bulk updating work orders:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
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
const PORT = 3006;
app.listen(PORT, () => {
  console.log(`Sales order Service running on port ${PORT}`);
});
