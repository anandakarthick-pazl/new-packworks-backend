import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const WorkOrder = db.WorkOrder;

// POST create new work order

v1Router.post("/work-order", authenticateJWT, async (req, res) => {
  const workDetails = req.body;

  if (!workDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  try {
    
    const work_generate_id = await generateId(req.user.company_id, WorkOrder, "work");
    // Create Work Order
    const newWorkOrder = await WorkOrder.create({
      work_generate_id: work_generate_id,
      company_id: req.user.company_id,
      client_id: workDetails.client_id,
      sales_order_id: workDetails.sales_order_id || null,
      manufacture: workDetails.manufacture,
      sku_id: workDetails.sku_id || null,
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
    const { 
      page = 1, 
      limit = 10, 
      manufacture, 
      sku_name,
      status = "active" // Default to 'active' status
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const whereClause = {
      company_id: req.user.company_id // Add company filter for security
    };
    
    // Status filtering - default to active, but allow override
    if (status === "all") {
      // Don't filter by status if 'all' is specified
    } else {
      whereClause.status = status;
    }
    
    if (manufacture) {
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
    const { status = "active" } = req.query; // Add status parameter

    // Fetch from database with company_id for security
    const whereClause = { 
      id: id,
      company_id: req.user.company_id
    };
    
    // Add status filter unless 'all' is specified
    if (status !== "all") {
      whereClause.status = status;
    }
    
    const workOrder = await WorkOrder.findOne({
      where: whereClause
    });

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
      sku_id: workDetails.sku_id || null,
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

v1Router.get(
  "/sale-order/:salesOrderId/work-orders",
  authenticateJWT,
  async (req, res) => {
    try {
      const { salesOrderId } = req.params;
      const { status = "active" } = req.query; // Default to active status
      const companyId = req.user.company_id;

      // Build where clause
      const where = {
        sales_order_id: salesOrderId,
        company_id: companyId,
      };

      // Filter by status unless "all" is specified
      if (status !== "all") {
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

// PUT update work order status (priority and progress only)
v1Router.put("/work-order/status/:workOrderId", authenticateJWT, async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const { priority, progress } = req.body;
    
    // Get user details from authentication
    const userId = req.user.id;
    const companyId = req.user.company_id;

    // Validate input
    if (!priority && !progress) {
      return res.status(400).json({
        success: false,
        message: "At least one field (priority or progress) is required"
      });
    }

    // Validate priority value if provided
    if (priority && !["High", "Medium", "Low"].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Priority must be High, Medium, or Low"
      });
    }

    // Validate progress value if provided
    const validProgressValues = [
      "Pending", "Product Planning", "Procurement Sourcing",
      "Production Planning", "Production", "Quality Control",
      "Packaging", "Shipping"
    ];
    
    if (progress && !validProgressValues.includes(progress)) {
      return res.status(400).json({
        success: false,
        message: `Progress must be one of: ${validProgressValues.join(", ")}`
      });
    }

    // Find the work order
    const workOrder = await WorkOrder.findOne({
      where: { 
        id: workOrderId,
        company_id: companyId
      }
    });
    
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: "Work order not found or you don't have access to it"
      });
    }

    // Create update object with only the provided fields
    const updateData = {};
    if (priority) updateData.priority = priority;
    if (progress) updateData.progress = progress;
    
    // Add audit fields
    updateData.updated_by = userId;
    updateData.updated_at = sequelize.literal("CURRENT_TIMESTAMP");

    // Update the work order with new status information
    await workOrder.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Work order status updated successfully",
      data: workOrder.get({ plain: true })
    });
  } catch (error) {
    logger.error("Error updating work order status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
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
app.use("/api/production", v1Router);
await db.sequelize.sync();
const PORT = 3029;
app.listen(PORT, () => {
  console.log(`Production Service running on port ${PORT}`);
});
