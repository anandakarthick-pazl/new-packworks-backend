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

const SalesOrder = db.SalesOrder;
const WorkOrder = db.WorkOrder;
const SalesSkuDetails = db.SalesSkuDetails;
const User = db.User;

// POST create new sales order - with SalesSkuDetails table

v1Router.post("/sale-order", authenticateJWT, async (req, res) => {
  const { salesDetails, skuDetails, workDetails } = req.body;

  if (
    !salesDetails ||
    !skuDetails ||
    !Array.isArray(skuDetails) ||
    !workDetails ||
    !Array.isArray(workDetails)
  ) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  const transaction = await sequelize.transaction();

  try {
    // Create Sales Order - get company_id and user info from JWT token
    const newSalesOrder = await SalesOrder.create(
      {
        company_id: req.user.company_id,
        sales_ui_id: salesDetails.sales_ui_id || null,
        client_id: salesDetails.client_id,
        estimated: salesDetails.estimated,
        client: salesDetails.client,
        credit_period: salesDetails.credit_period,
        freight_paid: salesDetails.freight_paid,
        confirmation: salesDetails.confirmation,
        confirmation_email: salesDetails.confirmation_email || null,
        confirmation_name: salesDetails.confirmation_name || null,
        confirmation_mobile: salesDetails.confirmation_mobile || null,
        sales_status: salesDetails.sales_status,
        total_amount: salesDetails.total_amount,
        sgst: salesDetails.sgst,
        cgst: salesDetails.cgst,
        total_incl_gst: salesDetails.total_incl_gst,
        created_by: req.user.id,
        updated_by: req.user.id,
        status: "active", // Set default status to active
      },
      { transaction }
    );

    // Create Sales SKU Details
    const skuRecords = skuDetails.map((sku) => ({
      company_id: req.user.company_id,
      client_id: salesDetails.client_id,
      sales_order_id: newSalesOrder.id,
      sku: sku.sku,
      quantity_required: sku.quantity_required,
      rate_per_sku: sku.rate_per_sku,
      acceptable_sku_units: sku.acceptable_sku_units,
      total_amount: sku.total_amount,
      sgst: sku.sgst,
      sgst_amount: sku.sgst_amount,
      cgst: sku.cgst,
      cgst_amount: sku.cgst_amount,
      total_incl__gst: sku.total_incl__gst,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "active",
    }));

    const createdSkuDetails = await SalesSkuDetails.bulkCreate(skuRecords, {
      transaction,
    });

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
      priority: work.priority || null,
      progress: work.progress || null,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "active",
    }));

    const createdWorkOrders = await WorkOrder.bulkCreate(workOrders, {
      transaction,
    });

    // Commit transaction
    await transaction.commit();

    // Get the complete data with workOrders and skuDetails
    const completeData = {
      ...newSalesOrder.get({ plain: true }),
      skuDetails: createdSkuDetails.map((sku) => sku.get({ plain: true })),
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

v1Router.get("/sale-order", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      client,
      sku,
      manufacture,
      confirmation,
      sales_status,
      status = "active",
    } = req.query;
    const offset = (page - 1) * limit;

    // Build base filter conditions for SalesOrder
    const where = {
      status: status,
      company_id: req.user.company_id, // Filter by the company ID from JWT token
    };

    // Add client search if provided
    if (client) where.client = { [Op.like]: `%${client}%` };

    // Add confirmation filter if provided
    if (confirmation !== undefined) where.confirmation = confirmation;

    // Add sales_status filter if provided
    if (sales_status) where.sales_status = sales_status;

    // Include conditions for related models
    const includeConditions = [
      {
        model: WorkOrder,
        as: "workOrders",
        where: { status: "active" }, // Only include active work orders
        required: false, // Don't require work orders by default (LEFT JOIN)
        separate: true, // Use separate query to ensure work orders are properly fetched
      },
      {
        model: SalesSkuDetails,
        where: { status: "active" }, // Only include active SKU details
        required: false, // Don't require SKU details by default (LEFT JOIN)
        separate: true, // Use separate query to ensure SKU details are properly fetched
      },
      {
        model: User,
        as: "creator_sales",
        attributes: ["id", "name", "email"],
      },
      {
        model: User,
        as: "updater_sales",
        attributes: ["id", "name", "email"],
      },
    ];

    // Add SKU search if provided
    if (sku) {
      includeConditions[1].where = {
        ...includeConditions[1].where,
        sku: { [Op.like]: `%${sku}%` },
      };
      includeConditions[1].required = true; // Make this association required when filtering
    }

    // Add manufacture search if provided
    if (manufacture) {
      includeConditions[0].where = {
        ...includeConditions[0].where,
        manufacture: { [Op.like]: `%${manufacture}%` },
      };
      includeConditions[0].required = true; // Make this association required when filtering
    }

    // Fetch data from database with all filters applied
    const { count, rows } = await SalesOrder.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: includeConditions,
      order: [["created_at", "DESC"]],
      distinct: true, // Important when including associations to get correct count
    });

    // Transform data
    const result = {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      data: rows.map((order) => order.get({ plain: true })),
    };

    // Log for debugging - check if work orders are present
    if (rows.length > 0) {
      logger.info(`First sales order ID: ${rows[0].id}`);
      logger.info(
        `Work orders count: ${
          rows[0].workOrders ? rows[0].workOrders.length : 0
        }`
      );
    }

    res.json(result);
  } catch (error) {
    logger.error("Error fetching sales orders:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});
// GET single sales order by ID (including associated records)

v1Router.get("/sale-order/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch from database
    const salesOrder = await SalesOrder.findByPk(id, {
      include: [
        {
          model: WorkOrder,
          as: "workOrders",
          where: { status: "active" },
          required: false,
        },
        {
          model: SalesSkuDetails,
          where: { status: "active" },
          required: false,
        },
        {
          model: User,
          as: "creator_sales",
          attributes: ["id", "name", "email"],
          foreignKey: "created_by",
        },
        { 
          model: User,
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

    res.json(result);
  } catch (error) {
    logger.error("Error fetching sales order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// PUT update existing sales order - modified to update existing records

v1Router.put("/sale-order/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { salesDetails, skuDetails, workDetails } = req.body;

  if (
    !salesDetails ||
    !skuDetails ||
    !Array.isArray(skuDetails) ||
    !workDetails ||
    !Array.isArray(workDetails)
  ) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  const transaction = await sequelize.transaction();

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
        sales_ui_id: salesDetails.sales_ui_id || null, // Update if provided
        estimated: salesDetails.estimated,
        client: salesDetails.client,
        credit_period: salesDetails.credit_period,
        freight_paid: salesDetails.freight_paid,
        confirmation: salesDetails.confirmation,
        confirmation_email: salesDetails.confirmation_email || null,
        confirmation_name: salesDetails.confirmation_name || null,
        confirmation_mobile: salesDetails.confirmation_mobile || null,
        sales_status: salesDetails.sales_status,
        total_amount: salesDetails.total_amount,
        sgst: salesDetails.sgst,
        cgst: salesDetails.cgst,
        total_incl_gst: salesDetails.total_incl_gst,
        status: salesDetails.status || salesOrder.status, // Keep existing status if not provided
        updated_by: req.user.id, // Update with current user ID from token
        updated_at: new Date(), // Update the timestamp
      },
      { transaction }
    );

    // Get existing SKU details for this sales order
    const existingSkuDetails = await SalesSkuDetails.findAll({
      where: {
        sales_order_id: id,
        status: "active",
      },
      transaction,
    });

    // Create a map of existing SKU details by ID or some unique identifier
    // You need to ensure skuDetails from the request include IDs of existing records
    const existingSkuMap = new Map();
    existingSkuDetails.forEach((sku) => {
      existingSkuMap.set(sku.id, sku);
    });

    // Process each SKU detail - update existing or create new
    for (const sku of skuDetails) {
      if (sku.id && existingSkuMap.has(sku.id)) {
        // Update existing SKU detail
        const existingSku = existingSkuMap.get(sku.id);
        await existingSku.update(
          {
            company_id: req.user.company_id,
            client_id: salesDetails.client_id,
            sku: sku.sku,
            quantity_required: sku.quantity_required,
            rate_per_sku: sku.rate_per_sku,
            acceptable_sku_units: sku.acceptable_sku_units,
            total_amount: sku.total_amount,
            sgst: sku.sgst,
            sgst_amount: sku.sgst_amount,
            cgst: sku.cgst,
            cgst_amount: sku.cgst_amount,
            total_incl__gst: sku.total_incl__gst,
            updated_by: req.user.id,
            updated_at: new Date(),
          },
          { transaction }
        );

        // Remove from map to track what's been processed
        existingSkuMap.delete(sku.id);
      } else {
        // Create new SKU detail
        await SalesSkuDetails.create(
          {
            company_id: req.user.company_id,
            client_id: salesDetails.client_id,
            sales_order_id: id,
            sku: sku.sku,
            quantity_required: sku.quantity_required,
            rate_per_sku: sku.rate_per_sku,
            acceptable_sku_units: sku.acceptable_sku_units,
            total_amount: sku.total_amount,
            sgst: sku.sgst,
            sgst_amount: sku.sgst_amount,
            cgst: sku.cgst,
            cgst_amount: sku.cgst_amount,
            total_incl__gst: sku.total_incl__gst,
            created_by: req.user.id,
            updated_by: req.user.id,
            status: "active",
          },
          { transaction }
        );
      }
    }

    // Set remaining unprocessed SKUs to inactive (they were removed in the update)
    for (const [id, sku] of existingSkuMap.entries()) {
      await sku.update(
        {
          status: "inactive",
          updated_by: req.user.id,
          updated_at: new Date(),
        },
        { transaction }
      );
    }

    // Do the same for work orders
    const existingWorkOrders = await WorkOrder.findAll({
      where: {
        sales_order_id: id,
        status: "active",
      },
      transaction,
    });

    const existingWorkMap = new Map();
    existingWorkOrders.forEach((work) => {
      existingWorkMap.set(work.id, work);
    });

    for (const work of workDetails) {
      if (work.id && existingWorkMap.has(work.id)) {
        // Update existing work order
        const existingWork = existingWorkMap.get(work.id);
        await existingWork.update(
          {
            company_id: req.user.company_id,
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
            priority: work.priority || null, 
            progress: work.progress || null,
            updated_by: req.user.id,
            updated_at: new Date(),
          },
          { transaction }
        );

        existingWorkMap.delete(work.id);
      } else {
        // Create new work order
        await WorkOrder.create(
          {
            sales_order_id: id,
            company_id: req.user.company_id,
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
            priority: work.priority || null,
            progress: work.progress || null,
            created_by: req.user.id,
            updated_by: req.user.id,
            status: "active",
          },
          { transaction }
        );
      }
    }

    // Set remaining unprocessed work orders to inactive
    for (const [id, work] of existingWorkMap.entries()) {
      await work.update(
        {
          status: "inactive",
          updated_by: req.user.id,
          updated_at: new Date(),
        },
        { transaction }
      );
    }

    // Commit transaction
    await transaction.commit();

    // Fetch the updated complete data
    const updatedSalesOrder = await SalesOrder.findByPk(id, {
      include: [
        {
          model: WorkOrder,
          as: "workOrders",
          where: { status: "active" },
          required: false,
        },
        {
          model: SalesSkuDetails,
          where: { status: "active" },
          required: false,
        },
      ],
    });

    res.json({
      message: "Sales Order updated successfully",
      data: updatedSalesOrder.get({ plain: true }),
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error updating sales order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// DELETE sales order - changed to soft delete including associated records

v1Router.delete("/sale-order/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const transaction = await sequelize.transaction();

  try {
    // Find the sales order
    const salesOrder = await SalesOrder.findByPk(id, {
      include: [
        { model: WorkOrder, as: "workOrders" },
        { model: SalesSkuDetails },
      ],
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

    // Update WorkOrder status to 'inactive' for related work orders
    if (salesOrder.workOrders && salesOrder.workOrders.length > 0) {
      await WorkOrder.update(
        {
          status: "inactive",
          updated_by: req.user.id,
          updated_at: new Date(),
        },
        { where: { sales_order_id: id }, transaction }
      );
    }

    // Update SalesSkuDetails status to 'inactive'
    await SalesSkuDetails.update(
      {
        status: "inactive",
        updated_by: req.user.id,
        updated_at: new Date(),
      },
      { where: { sales_order_id: id }, transaction }
    );

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
      message: "Sales Order and associated records set to inactive",
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
