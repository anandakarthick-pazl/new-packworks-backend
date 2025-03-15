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

const SalesOrder = db.SalesOrder;
const WorkOrder = db.WorkOrder;

// Redis cache keys
const CACHE_KEYS = {
  SALES_ORDER_LIST: "sales_orders:all",
  SALES_ORDER_DETAIL: "sales_order:",
};

// RabbitMQ queues
const QUEUES = {
  SALES_ORDER_CREATED: "sales_order.created",
  SALES_ORDER_UPDATED: "sales_order.updated",
  SALES_ORDER_DELETED: "sales_order.deleted",
};

// POST create new sales order - enhanced to return all data
v1Router.post("/sales-order", authenticateJWT, async (req, res) => {
  const { salesDetails, workDetails } = req.body;

  if (!salesDetails || !workDetails || !Array.isArray(workDetails)) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  const transaction = await SalesOrder.sequelize.transaction();

  try {
    // Create Sales Order with user info for created_by and updated_by
    const newSalesOrder = await SalesOrder.create(
      {
        company_id: salesDetails.company_id,
        client_id: salesDetails.client_id,
        estimated: salesDetails.estimated,
        client: salesDetails.client,
        credit_period: salesDetails.credit_period,
        freight_paid: salesDetails.freight_paid,
        confirmation: salesDetails.confirmation ?? false,
        sku_details: JSON.stringify(salesDetails.sku_details), // Convert array to JSON
        status: "active", // Set default status to active
        created_by: req.user.id, // Get user ID from JWT token
        updated_by: req.user.id, // Same as created_by initially
        
      },
      { transaction }
    );

    // Insert Work Orders
    const workOrders = workDetails.map((work) => ({
      company_id: work.company_id,
      client_id: work.client_id,
      sales_order_id: newSalesOrder.id,
      manufacture: work.manufacture,
      sku_name: work.sku_name || null,
      sku_version: work.sku_version || null,
      qty: work.qty || null,
      edd: work.edd || null,
      description: work.description || null,
      acceptable_excess_units: work.acceptable_excess_units || null,
      planned_start_date: work.planned_start_date || null,
      planned_end_date: work.planned_end_date || null,
      outsource_name:work.outsource_name || null,
        // work.manufacture === "outsource" ? work.outsource_name : null, 
    }));

    const createdWorkOrders = await WorkOrder.bulkCreate(workOrders, {
      transaction,
    });

    // Commit transaction
    await transaction.commit();

    // Get the complete data with workOrders
    const completeData = {
      ...newSalesOrder.get({ plain: true }),
      sku_details: salesDetails.sku_details, // Return the original array
      workOrders: createdWorkOrders.map((wo) => wo.get({ plain: true })),
    };

    // Clear cache
    await clearClientCache(`${CACHE_KEYS.SALES_ORDER_LIST}:*`);

    // Send to RabbitMQ
    await publishToQueue(QUEUES.SALES_ORDER_CREATED, completeData);

    res.status(201).json({
      message: "Sales Order created successfully",
      data: completeData,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error creating sales order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET all sales orders with pagination and filtering - updated to handle status
v1Router.get("/sales-order", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      client,
      confirmation,
      status = "active",
    } = req.query;
    const offset = (page - 1) * limit;

    // Try to get from cache first
    const cacheKey = `${CACHE_KEYS.SALES_ORDER_LIST}:${page}:${limit}:${
      client || ""
    }:${confirmation || ""}:${status}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // Build filter conditions
    const where = {
      status: status, // Only fetch records with specified status (default is active)
    };
    if (client) where.client = { [Op.like]: `%${client}%` };
    if (confirmation !== undefined)
      where.confirmation = confirmation === "true";

    // Fetch data from database
    const { count, rows } = await SalesOrder.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: WorkOrder,
          as: "workOrders",
        },
        {
          model: db.User,
          as: "creator_sales",
          attributes: ["id", "name", "email"],
          foreignKey: "created_by",
        },
        {
          model: db.User,
          as: "updater_sales",
          attributes: ["id", "name", "email"],
          foreignKey: "updated_by",
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Transform data
    const result = {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      data: rows.map((order) => {
        const plainOrder = order.get({ plain: true });
        // Safely parse sku_details considering it might be already an object or a string
        try {
          if (typeof plainOrder.sku_details === "string") {
            plainOrder.sku_details = JSON.parse(plainOrder.sku_details);
          }
          // If it's already an object, keep it as is
        } catch (e) {
          // In case of parsing error, set to empty array
          plainOrder.sku_details = [];
          logger.error(
            `Error parsing sku_details for order ${plainOrder.id}:`,
            e
          );
        }
        return plainOrder;
      }),
    };

    // Cache the result
    await redisClient.set(cacheKey, JSON.stringify(result), "EX", 300); // Cache for 5 minutes

    res.json(result);
  } catch (error) {
    logger.error("Error fetching sales orders:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET single sales order by ID - updated to include creator and updater info
v1Router.get("/sales-order/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    // Try to get from cache first
    const cacheKey = `${CACHE_KEYS.SALES_ORDER_DETAIL}${id}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // Fetch from database
    const salesOrder = await SalesOrder.findByPk(id, {
      include: [
        {
          model: WorkOrder,
          as: "workOrders",
        },
        {
          model: db.User,
          as: "creator_sales",
          attributes: ["id", "name", "email"],
          foreignKey: "created_by",
        },
        {
          model: db.User,
          as: "Updater_sales",
          attributes: ["id", "name", "email"],
          foreignKey: "updated_by",
        },
      ],
    });

    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    // Transform data
    const result = salesOrder.get({ plain: true });
    // Parse stored JSON
    result.sku_details = JSON.parse(result.sku_details || "[]");

    // Cache the result
    await redisClient.set(cacheKey, JSON.stringify(result), "EX", 300); // Cache for 5 minutes

    res.json(result);
  } catch (error) {
    logger.error("Error fetching sales order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// PUT update existing sales order - updated to include updated_by
v1Router.put("/sales-order/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { salesDetails, workDetails } = req.body;

  if (!salesDetails || !workDetails || !Array.isArray(workDetails)) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  const transaction = await SalesOrder.sequelize.transaction();

  try {
    // Find the sales order
    const salesOrder = await SalesOrder.findByPk(id, { transaction });

    if (!salesOrder) {
      await transaction.rollback();
      return res.status(404).json({ message: "Sales order not found" });
    }

    // Update Sales Order
    await salesOrder.update(
      {
        company_id: salesDetails.company_id,
        client_id: salesDetails.client_id,
        estimated: salesDetails.estimated,
        client: salesDetails.client,
        credit_period: salesDetails.credit_period,
        freight_paid: salesDetails.freight_paid,
        confirmation: salesDetails.confirmation ?? false,
        sku_details: JSON.stringify(salesDetails.sku_details),
        status: salesDetails.status || salesOrder.status, // Keep existing status if not provided
        updated_by: req.user.id, // Update the updated_by field with current user
        updated_at: new Date(), // Update the timestamp
      },
      { transaction }
    );

    // Delete existing work orders
    await WorkOrder.destroy({
      where: { sales_order_id: id },
      transaction,
    });

    // Insert new Work Orders
    const workOrders = workDetails.map((work) => ({
      sales_order_id: id,
      company_id: work.company_id,
      client_id: work.client_id,
      manufacture: work.manufacture,
      sku_name: work.sku_name || null,
      sku_version: work.sku_version || null,
      qty: work.qty || null,
      edd: work.edd || null,
      description: work.description || null,
      acceptable_excess_units: work.acceptable_excess_units || null,
      planned_start_date: work.planned_start_date || null,
      planned_end_date: work.planned_end_date || null,
      outsource_name:
        work.manufacture === "outsource" ? work.outsource_name : null,
    }));

    const createdWorkOrders = await WorkOrder.bulkCreate(workOrders, {
      transaction,
    });

    // Commit transaction
    await transaction.commit();

    // Get the complete data with workOrders
    const completeData = {
      ...salesOrder.get({ plain: true }),
      sku_details: salesDetails.sku_details, // Return the original array
      workOrders: createdWorkOrders.map((wo) => wo.get({ plain: true })),
    };

    // Clear cache
    await clearClientCache(`${CACHE_KEYS.SALES_ORDER_LIST}:*`);
    await clearClientCache(`${CACHE_KEYS.SALES_ORDER_DETAIL}${id}`);

    // Send to RabbitMQ
    await publishToQueue(QUEUES.SALES_ORDER_UPDATED, completeData);

    res.json({
      message: "Sales Order updated successfully",
      data: completeData,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error updating sales order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// DELETE sales order - changed to soft delete
v1Router.delete("/sales-order/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const transaction = await SalesOrder.sequelize.transaction();

  try {
    // Find the sales order
    const salesOrder = await SalesOrder.findByPk(id, {
      include: [{ model: WorkOrder, as: "workOrders" }],
      transaction,
    });

    if (!salesOrder) {
      await transaction.rollback();
      return res.status(404).json({ message: "Sales order not found" });
    }

    // Store data for notification
    const salesOrderData = salesOrder.get({ plain: true });
    salesOrderData.sku_details = JSON.parse(salesOrderData.sku_details || "[]");

    // Update WorkOrder status to 'inactive' for related work orders
    if (salesOrder.workOrders && salesOrder.workOrders.length > 0) {
      await WorkOrder.update(
        { status: "inactive" },
        { where: { sales_order_id: id }, transaction }
      );
    }

    // Soft delete - Update sales order status to 'inactive'
    await salesOrder.update(
      {
        status: "inactive",
        updated_by: req.user.id,
        updated_at: new Date(),
      },
      { transaction }
    );

    // Commit transaction
    await transaction.commit();

    // Clear cache
    await clearClientCache(`${CACHE_KEYS.SALES_ORDER_LIST}:*`);
    await clearClientCache(`${CACHE_KEYS.SALES_ORDER_DETAIL}${id}`);

    // Send to RabbitMQ
    await publishToQueue(QUEUES.SALES_ORDER_DELETED, {
      ...salesOrderData,
      status: "inactive",
    });

    res.json({
      message: "Sales Order and associated Work Orders set to inactive",
      data: {
        ...salesOrderData,
        status: "inactive",
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error soft-deleting sales order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// New endpoint to restore a soft-deleted sales order
v1Router.put("/sales-order/:id/restore", authenticateJWT, async (req, res) => {
  const { id } = req.params;

  try {
    // Find the sales order
    const salesOrder = await SalesOrder.findByPk(id);

    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    if (salesOrder.status === "active") {
      return res.status(400).json({ message: "Sales order is already active" });
    }

    // Restore by setting status back to active
    await salesOrder.update({
      status: "active",
      updated_by: req.user.id,
      updated_at: new Date(),
    });

    // Clear cache
    await clearClientCache(`${CACHE_KEYS.SALES_ORDER_LIST}:*`);
    await clearClientCache(`${CACHE_KEYS.SALES_ORDER_DETAIL}${id}`);

    // Get the updated record
    const updatedOrder = await SalesOrder.findByPk(id, {
      include: [
        {
          model: WorkOrder,
          as: "workOrders",
        },
      ],
    });

    const result = updatedOrder.get({ plain: true });
    result.sku_details = JSON.parse(result.sku_details || "[]");

    // Publish update to queue
    await publishToQueue(QUEUES.SALES_ORDER_UPDATED, result);

    res.json({
      message: "Sales Order restored successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error restoring sales order:", error);
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
const PORT = 3005;
app.listen(PORT, () => {
  console.log(`Sales order Service running on port ${PORT}`);
});
