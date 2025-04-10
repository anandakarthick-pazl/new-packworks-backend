import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const WorkOrder = db.WorkOrder;

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

  try {
    // Create Work Order
    const newWorkOrder = await WorkOrder.create({
      company_id: req.user.company_id,
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
      created_by: req.user.id,
      updated_by: req.user.id,
    });

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

v1Router.get("/work-order", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, manufacture, sku_name } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const whereClause = {};
    if (manufacture) {
      // Use exact match for manufacture filter
      whereClause.manufacture = manufacture;
    }
    if (sku_name) {
      whereClause.sku_name = { [Op.like]: `%${sku_name}%` };
    }

    // Fetch from database with pagination and filters
    const { count, rows } = await WorkOrder.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset: offset,
      order: [["updated_at", "DESC"]],
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / limitNum);

    res.json({
      workOrders: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (error) {
    logger.error("Error fetching work orders:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

v1Router.get("/work-order/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch from database
    const workOrder = await WorkOrder.findByPk(id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    const result = workOrder.get({ plain: true });

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

  try {
    // Find the work order
    const workOrder = await WorkOrder.findByPk(id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    // Update work order
    await workOrder.update({
      company_id: req.user.company_id,
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
      outsource_name: workDetails.outsource_name || null,
      status: workDetails.status || workOrder.status,
      created_by: req.user.id,
      updated_by: req.user.id,
    });

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
  const { updated_by } = req.user.id;

  try {
    // Find the work order
    const workOrder = await WorkOrder.findByPk(id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    // Soft delete - update status to inactive
    await workOrder.update({
      status: "inactive",
      updated_by: updated_by,
      updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
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
  "/sale-order/:salesOrderId/work-orders", // Fixed route path with leading slash
  authenticateJWT,
  async (req, res) => {
    try {
      const { salesOrderId } = req.params;
      const { status = "active" } = req.query;
      const companyId = req.user.company_id;

      // Build where clause
      const where = {
        sales_order_id: salesOrderId,
        company_id: companyId,
      };

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

      res.json(result);
    } catch (error) {
      logger.error("Error fetching work orders by sales order:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
  });
});

// Use Version 1 Router
app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3006;
app.listen(PORT, () => {
  console.log(`work order Service running on port ${PORT}`);
});
