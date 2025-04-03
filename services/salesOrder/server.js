import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import companyScope from "../../common/middleware/companyScope.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const SalesOrder = db.SalesOrder;
const WorkOrder = db.WorkOrder;

// POST create new sales order - enhanced to use JWT token for company_id and user IDs
v1Router.post("/sales-order", authenticateJWT, async (req, res) => {
  const { salesDetails, workDetails } = req.body;

  if (!salesDetails || !workDetails || !Array.isArray(workDetails)) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  const transaction = await sequelize.transaction();

  try {
    // Create Sales Order - get company_id and user info from JWT token
    const newSalesOrder = await SalesOrder.create(
      {
        company_id: req.user.company_id, // Get from token
        client_id: salesDetails.client_id,
        estimated: salesDetails.estimated,
        client: salesDetails.client,
        credit_period: salesDetails.credit_period,
        freight_paid: salesDetails.freight_paid,
        confirmation: salesDetails.confirmation ?? false,
        sku_details: JSON.stringify(salesDetails.sku_details),
        status: "active", // Set default status to active
        created_by: req.user.id,
        updated_by: req.user.id,
      },
      { transaction }
    );

    // Insert Work Orders
    const workOrders = workDetails.map((work) => ({
      company_id: req.user.company_id, // Get from token
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
      outsource_name: work.outsource_name || null,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "active",
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

// GET all sales orders with pagination and filtering
v1Router.get(
  "/sales-order",
  authenticateJWT,
  companyScope,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        client,
        confirmation,
        status = "active",
      } = req.query;
      const offset = (page - 1) * limit;

      // Build filter conditions
      const where = {
        status: status, // Only fetch records with specified status (default is active)
        company_id: req.user.company_id, // Filter by the company ID from JWT token
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
        distinct: true,
      });
console.log("123",count);
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

      res.json(result);
    } catch (error) {
      logger.error("Error fetching sales orders:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

// GET single sales order by ID
v1Router.get("/sales-order/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

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
          as: "updater_sales",
          attributes: ["id", "name", "email"],
          foreignKey: "updated_by",
        },
      ],
    });

    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    // Verify user has access to this sales order (from the same company)
    if (salesOrder.company_id !== req.user.company_id) {
      return res
        .status(403)
        .json({ message: "Access denied to this sales order" });
    }

    // Transform data
    const result = salesOrder.get({ plain: true });
    // Parse stored JSON
    result.sku_details = JSON.parse(result.sku_details || "[]");

    res.json(result);
  } catch (error) {
    logger.error("Error fetching sales order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// PUT update existing sales order - updated to use JWT token for user ID
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

    // Verify user has access to this sales order (from the same company)
    if (salesOrder.company_id !== req.user.company_id) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ message: "Access denied to this sales order" });
    }

    // Update Sales Order
    await salesOrder.update(
      {
        client_id: salesDetails.client_id,
        estimated: salesDetails.estimated,
        client: salesDetails.client,
        credit_period: salesDetails.credit_period,
        freight_paid: salesDetails.freight_paid,
        confirmation: salesDetails.confirmation ?? false,
        sku_details: JSON.stringify(salesDetails.sku_details),
        status: salesDetails.status || salesOrder.status, // Keep existing status if not provided
        updated_by: req.user.id, // Update with current user ID from token
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
      company_id: req.user.company_id, // From token
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

// DELETE sales order - changed to soft delete with user token for updated_by
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

    // Verify user has access to this sales order (from the same company)
    if (salesOrder.company_id !== req.user.company_id) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ message: "Access denied to this sales order" });
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
        updated_by: req.user.id, // Get from token
        updated_at: new Date(),
      },
      { transaction }
    );

    // Commit transaction
    await transaction.commit();

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
const PORT = 3005;
app.listen(PORT, () => {
  console.log(`Sales order Service running on port ${PORT}`);
});
