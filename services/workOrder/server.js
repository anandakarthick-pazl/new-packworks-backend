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
v1Router.post("/workOrder", authenticateJWT, async (req, res) => {
  const workDetails = req.body;

  if (!workDetails) {
    return res.status(400).json({ message: "Invalid input data" });
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
v1Router.get("/workOrder", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sku_name,
      manufacture,
      client_id,
      sales_order_id,
    } = req.query;

    const offset = (page - 1) * limit;

    // Try to get from cache first
    const cacheKey = `${
      WORK_ORDER_CACHE_KEYS.WORK_ORDER_LIST
    }:${page}:${limit}:${sku_name || ""}:${manufacture || ""}:${
      client_id || ""
    }:${sales_order_id || ""}`;

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
v1Router.get("/workOrder/:id", authenticateJWT, async (req, res) => {
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
    await redisClient.set(cacheKey, JSON.stringify(result), "EX", 300); // Cache for 5 minutes

    res.json(result);
  } catch (error) {
    logger.error("Error fetching work order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// PUT update existing work order
v1Router.put("/workOrder/:id", authenticateJWT, async (req, res) => {
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
      outsource_name:
        workDetails.manufacture === "outsource"
          ? workDetails.outsource_name
          : null,
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

// DELETE work order
v1Router.delete("/workOrder/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;

  try {
    // Find the work order
    const workOrder = await WorkOrder.findByPk(id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    // Store data for notification and cache clearing
    const workOrderData = workOrder.get({ plain: true });
    const salesOrderId = workOrder.sales_order_id;

    // Delete work order
    await workOrder.destroy();

    // Clear caches
    await clearClientCache(`${WORK_ORDER_CACHE_KEYS.WORK_ORDER_LIST}:*`);
    await clearClientCache(`${WORK_ORDER_CACHE_KEYS.WORK_ORDER_DETAIL}${id}`);

    // Clear associated sales order cache if needed
    if (salesOrderId) {
      await clearClientCache(`${CACHE_KEYS.SALES_ORDER_DETAIL}${salesOrderId}`);
    }

    // Send to RabbitMQ
    await publishToQueue(WORK_ORDER_QUEUES.WORK_ORDER_DELETED, workOrderData);

    res.json({
      message: "Work Order deleted successfully",
      data: workOrderData,
    });
  } catch (error) {
    logger.error("Error deleting work order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET work orders by sales order ID
v1Router.get(
  "/salesOrder/:salesOrderId/workOrders",
  authenticateJWT,
  async (req, res) => {
    try {
      const { salesOrderId } = req.params;

      // Try to get from cache first
      const cacheKey = `sales_order:${salesOrderId}:workorders`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      // Fetch from database
      const workOrders = await WorkOrder.findAll({
        where: { sales_order_id: salesOrderId },
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
v1Router.patch("/workOrder/bulkUpdate", authenticateJWT, async (req, res) => {
  const { ids, status, status_reason } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  const transaction = await WorkOrder.sequelize.transaction();

  try {
    // Update all work orders in the list
    const [updatedCount] = await WorkOrder.update(
      {
        status,
        status_reason: status_reason || null,
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
      await clearClientCache(`sales_order:${salesOrderId}:workorders`);
    }

    // Send to RabbitMQ
    await publishToQueue(WORK_ORDER_QUEUES.WORK_ORDER_UPDATED, {
      ids,
      updated: updatedCount,
      status,
      status_reason,
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
