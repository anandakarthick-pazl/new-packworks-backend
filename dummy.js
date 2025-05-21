// Create a new invoice history record
v1Router.post("/invoice-history", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Add created_by and updated_by from the authenticated user
    const invoiceData = {
      ...req.body,
      company_id: req.user.company_id,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "active",
    };

    // Validate required fields
    const requiredFields = ['client_id', 'sku_id', 'invoice_number', 'date', 'quantity', 'rate_per_sku', 'cost'];
    for (const field of requiredFields) {
      if (!invoiceData[field]) {
        await t.rollback();
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    // Check if invoice number already exists
    const existingInvoice = await SkuInvoiceHistory.findOne({
      where: { invoice_number: invoiceData.invoice_number },
      transaction: t
    });

    if (existingInvoice) {
      await t.rollback();
      return res.status(400).json({ message: "Invoice number already exists" });
    }

    // Check if SKU exists
    const sku = await Sku.findByPk(invoiceData.sku_id, { transaction: t });
    if (!sku) {
      await t.rollback();
      return res.status(404).json({ message: "SKU not found" });
    }

    // Check if Client exists
    const client = await Client.findByPk(invoiceData.client_id, { transaction: t });
    if (!client) {
      await t.rollback();
      return res.status(404).json({ message: "Client not found" });
    }

    // Create new invoice record
    const newInvoice = await SkuInvoiceHistory.create(invoiceData, { transaction: t });
    await t.commit();

    // Publish to queue
    await publishToQueue({
      operation: "CREATE_INVOICE",
      invoiceId: newInvoice.id,
      timestamp: new Date(),
      data: newInvoice,
    });

    res.status(201).json({ message: "Invoice created successfully", invoice: newInvoice });
  } catch (error) {
    await t.rollback();
    logger.error("Error creating invoice:", error);
    res.status(500).json({ message: "Error creating invoice", error: error.message });
  }
});

// Get all invoice history records with filtering and pagination
v1Router.get("/invoice-history", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      invoice_number,
      client_id,
      sku_id,
      date_from,
      date_to,
      status = "active",
    } = req.query;

    const offset = (page - 1) * limit;

    // Build the where condition for search
    let whereCondition = {
      status: status,
      company_id: req.user.company_id
    };

    // Handle specific field searches if provided
    if (invoice_number) whereCondition.invoice_number = { [Op.like]: `%${invoice_number}%` };
    if (client_id) whereCondition.client_id = client_id;
    if (sku_id) whereCondition.sku_id = sku_id;
    
    // Handle date range if provided
    if (date_from && date_to) {
      whereCondition.date = {
        [Op.between]: [date_from, date_to]
      };
    } else if (date_from) {
      whereCondition.date = {
        [Op.gte]: date_from
      };
    } else if (date_to) {
      whereCondition.date = {
        [Op.lte]: date_to
      };
    }

    // Handle generic search across multiple fields
    if (search) {
      whereCondition = {
        [Op.and]: [
          { status: status, company_id: req.user.company_id },
          {
            [Op.or]: [
              { invoice_number: { [Op.like]: `%${search}%` } }
            ],
          },
        ],
      };
    }

    // Get total count for pagination metadata
    const totalCount = await SkuInvoiceHistory.count({ where: whereCondition });

    // Fetch invoices with pagination and search
    const invoices = await SkuInvoiceHistory.findAll({
      where: whereCondition,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Sku,
          attributes: ['id', 'sku_name'],
          required: false,
        },
        {
          model: Client,
          attributes: ['client_id', 'client_name'],
          required: false,
        },
        {
          model: User,
          as: "creator_SkuInvoiceHistory",
          attributes: ['id', 'name'],
          required: false,
        },
        {
          model: User,
          as: "updater_invoice",
          attributes: ['id', 'name'],
          required: false,
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Calculate total stats for dashboard
    const totalInvoiceAmount = await SkuInvoiceHistory.sum('cost', {
      where: { 
        status: 'active',
        company_id: req.user.company_id
      }
    }) || 0;

    const totalItemsCount = await SkuInvoiceHistory.sum('quantity', {
      where: { 
        status: 'active',
        company_id: req.user.company_id
      }
    }) || 0;

    const totalInvoices = await SkuInvoiceHistory.count({
      where: { 
        status: 'active',
        company_id: req.user.company_id
      }
    });

    // Format response data
    const totalPages = Math.ceil(totalCount / limit);

    const responseData = {
      data: invoices,
      dashboard: {
        totalInvoiceAmount,
        totalItemsCount,
        totalInvoices
      },
      pagination: {
        totalCount,
        totalPages,
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    logger.error("Error fetching invoices:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// Get invoice history by ID
v1Router.get("/invoice-history/:id", authenticateJWT, async (req, res) => {
  try {
    const invoice = await SkuInvoiceHistory.findOne({
      where: { 
        id: req.params.id,
        company_id: req.user.company_id 
      },
      include: [
        {
          model: Sku,
          attributes: ['id', 'sku_name'],
          required: false,
        },
        {
          model: Client,
          attributes: ['client_id', 'client_name'],
          required: false,
        },
        {
          model: User,
          as: "creator_SkuInvoiceHistory",
          attributes: ['id', 'name'],
          required: false,
        },
        {
          model: User,
          as: "updater_invoice",
          attributes: ['id', 'name'],
          required: false,
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.status(200).json({ data: invoice });
  } catch (error) {
    logger.error("Error fetching invoice:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// Update invoice history
v1Router.put("/invoice-history/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    // Define allowed fields to update
    const allowedFields = [
      "invoice_number", 
      "date", 
      "quantity", 
      "rate_per_sku", 
      "cost"
    ];

    // Find the current invoice
    const currentInvoice = await SkuInvoiceHistory.findOne({
      where: { 
        id: req.params.id,
        company_id: req.user.company_id
      },
      transaction
    });

    if (!currentInvoice) {
      await transaction.rollback();
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Filter request body to only include allowed fields
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Add updated_by
    updateData.updated_by = req.user.id;
    updateData.updated_at = new Date();

    // Check if invoice number is being changed and if it already exists
    if (updateData.invoice_number && updateData.invoice_number !== currentInvoice.invoice_number) {
      const existingInvoice = await SkuInvoiceHistory.findOne({
        where: {
          invoice_number: updateData.invoice_number,
          id: { [Op.ne]: req.params.id }
        },
        transaction
      });

      if (existingInvoice) {
        await transaction.rollback();
        return res.status(400).json({
          message: "Invoice number already exists. Please use a different number."
        });
      }
    }

    // Check if there are any valid fields to update
    if (Object.keys(updateData).length <= 1) { // 1 is for updated_by
      await transaction.rollback();
      return res.status(400).json({
        message: "No updatable fields provided."
      });
    }

    // Perform the update
    const [updatedCount] = await SkuInvoiceHistory.update(updateData, {
      where: { 
        id: req.params.id,
        company_id: req.user.company_id
      },
      transaction
    });

    if (updatedCount === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "Invoice not found." });
    }

    // Fetch the updated invoice to return to the client
    const updatedInvoice = await SkuInvoiceHistory.findByPk(req.params.id, { 
      transaction,
      include: [
        {
          model: Sku,
          attributes: ['id', 'sku_name'],
          required: false,
        },
        {
          model: Client,
          attributes: ['client_id', 'client_name'],
          required: false,
        }
      ] 
    });

    // Commit the transaction
    await transaction.commit();

    // Publish update to queue
    await publishToQueue({
      operation: "UPDATE_INVOICE",
      invoiceId: req.params.id,
      timestamp: new Date(),
      data: updateData,
    });

    return res.status(200).json({
      message: "Invoice updated successfully.",
      updatedData: updatedInvoice,
    });
  } catch (error) {
    console.log(error, "Error in Invoice Update");
    // Rollback the transaction on error
    await transaction.rollback();
    return res.status(500).json({
      message: "Error updating invoice.",
      error: error.message,
    });
  }
});

// Soft Delete invoice history (changes status to inactive)
v1Router.delete("/invoice-history/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Update status to inactive instead of deleting
    const updatedInvoice = await SkuInvoiceHistory.update(
      {
        status: "inactive",
        updated_at: new Date(),
        updated_by: req.user.id,
      },
      {
        where: { 
          id: req.params.id,
          company_id: req.user.company_id
        },
        transaction: t,
      }
    );

    if (!updatedInvoice[0])
      return res.status(404).json({ message: "Invoice not found" });

    await t.commit();
    await publishToQueue({
      operation: "SOFT_DELETE_INVOICE",
      invoiceId: req.params.id,
      timestamp: new Date(),
      data: { status: "inactive" },
    });
    res.status(200).json({ message: "Invoice marked as inactive successfully" });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error deactivating invoice", error: error.message });
  }
});

// Export invoice history to Excel
v1Router.get("/invoice-history/export/excel", authenticateJWT, async (req, res) => {
  try {
    const { client_id, sku_id, date_from, date_to } = req.query;

    // Build the where condition for filters
    let whereCondition = {
      status: "active",
      company_id: req.user.company_id
    };

    if (client_id) whereCondition.client_id = client_id;
    if (sku_id) whereCondition.sku_id = sku_id;
    
    // Handle date range if provided
    if (date_from && date_to) {
      whereCondition.date = {
        [Op.between]: [date_from, date_to]
      };
    } else if (date_from) {
      whereCondition.date = {
        [Op.gte]: date_from
      };
    } else if (date_to) {
      whereCondition.date = {
        [Op.lte]: date_to
      };
    }

    // Fetch all invoices based on filters
    const invoices = await SkuInvoiceHistory.findAll({
      where: whereCondition,
      include: [
        {
          model: Sku,
          attributes: ['id', 'sku_name'],
          required: false,
        },
        {
          model: Client,
          attributes: ['client_id', 'client_name'],
          required: false,
        }
      ],
      order: [['date', 'DESC']]
    });

    // Create Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invoice History');

    // Add columns to the worksheet
    worksheet.columns = [
      { header: 'Invoice Number', key: 'invoice_number', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Client', key: 'client_name', width: 25 },
      { header: 'SKU', key: 'sku_name', width: 25 },
      { header: 'Quantity', key: 'quantity', width: 15 },
      { header: 'Rate/SKU', key: 'rate_per_sku', width: 15 },
      { header: 'Total Cost', key: 'cost', width: 15 },
      { header: 'Created At', key: 'created_at', width: 20 }
    ];

    // Add style to header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Add data to the worksheet
    invoices.forEach(invoice => {
      worksheet.addRow({
        invoice_number: invoice.invoice_number,
        date: invoice.date,
        client_name: invoice.Client ? invoice.Client.client_name : 'N/A',
        sku_name: invoice.Sku ? invoice.Sku.sku_name : 'N/A',
        quantity: invoice.quantity,
        rate_per_sku: invoice.rate_per_sku,
        cost: invoice.cost,
        created_at: new Date(invoice.created_at).toLocaleString()
      });
    });

    // Set up response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=invoice_history.xlsx'
    );

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error("Error exporting invoice history:", error);
    res.status(500).json({
      message: "Error exporting invoice history",
      error: error.message,
    });
  }
});


// 


import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import QRCode from 'qrcode';

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const WorkOrder = db.WorkOrder;


// Generate QR code as data URL
async function generateQRCode(url) {
  try {
    return await QRCode.toDataURL(url);
  } catch (err) {
    logger.error('Error generating QR code:', err);
    return null;
  }
}

// POST create new work order

v1Router.post("/work-order", authenticateJWT, async (req, res) => {
  const workDetails = req.body;

  if (!workDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  try {
    const work_generate_id = await generateId(
      req.user.company_id,
      WorkOrder,
      "work"
    );
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
      work_order_sku_values: workDetails.work_order_sku_values || null,
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


// Get all work orders with QR codes
v1Router.get("/work-order", authenticateJWT, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      manufacture, 
      sku_name,
      status = "active", // Default to 'active' status
      includeQR = "false" // New parameter to optionally include QR codes
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

    // Generate QR codes for each work order if requested
    let workOrders = rows;
    if (includeQR === "true") {
      const baseUrl = `${req.protocol}://${req.get('host')}/api/v1/work-order`;
      workOrders = await Promise.all(
        rows.map(async (workOrder) => {
          const plainWorkOrder = workOrder.get({ plain: true });
          const qrUrl = `${baseUrl}/${plainWorkOrder.id}`;
          plainWorkOrder.qrCode = await generateQRCode(qrUrl);
          return plainWorkOrder;
        })
      );
    } else {
      workOrders = rows.map(row => row.get({ plain: true }));
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / limitNum);

    res.json({
      workOrders,
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

// Get single work order with QR code
v1Router.get("/work-order/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      status = "active",
      includeQR = "true" // Default to including QR for single work order
    } = req.query;

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

    // Generate QR code if requested
    if (includeQR === "true") {
      const qrUrl = `${req.protocol}://${req.get('host')}/api/v1/work-order/${result.id}`;
      result.qrCode = await generateQRCode(qrUrl);
    }

    res.json(result);
  } catch (error) {
    logger.error("Error fetching work order:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// New endpoint to just get the QR code image for a work order
v1Router.get("/work-order/:id/qrcode", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { format = "dataurl" } = req.query; // Options: dataurl, png
    
    // Verify work order exists and belongs to user's company
    const workOrder = await WorkOrder.findOne({
      where: { 
        id: id,
        company_id: req.user.company_id
      }
    });

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    // Generate the URL to be encoded in QR
    const qrUrl = `${req.protocol}://${req.get('host')}/api/v1/work-order/${id}`;
    
    if (format === "png") {
      // Set content type to PNG
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="work-order-${id}.png"`);
      
      // Stream the QR code as PNG
      QRCode.toFileStream(res, qrUrl, {
        type: 'png',
        width: 300,
        margin: 1
      });
    } else {
      // Return as data URL
      const qrCode = await generateQRCode(qrUrl);
      res.json({ qrCode });
    }
  } catch (error) {
    logger.error("Error generating QR code:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});


// v1Router.get("/work-order", authenticateJWT, async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 10,
//       manufacture,
//       sku_name,
//       status = "active" // Default to 'active' status
//     } = req.query;

//     const pageNum = parseInt(page, 10);
//     const limitNum = parseInt(limit, 10);
//     const offset = (pageNum - 1) * limitNum;

//     // Build where clause for filtering
//     const whereClause = {
//       company_id: req.user.company_id // Add company filter for security
//     };

//     // Status filtering - default to active, but allow override
//     if (status === "all") {
//       // Don't filter by status if 'all' is specified
//     } else {
//       whereClause.status = status;
//     }

//     if (manufacture) {
//       whereClause.manufacture = manufacture;
//     }
//     if (sku_name) {
//       whereClause.sku_name = { [Op.like]: `%${sku_name}%` };
//     }

//     // Fetch from database with pagination and filters
//     const { count, rows } = await WorkOrder.findAndCountAll({
//       where: whereClause,
//       limit: limitNum,
//       offset: offset,
//       order: [["updated_at", "DESC"]],
//     });

//     // Calculate pagination metadata
//     const totalPages = Math.ceil(count / limitNum);

//     res.json({
//       workOrders: rows,
//       pagination: {
//         total: count,
//         page: pageNum,
//         limit: limitNum,
//         totalPages,
//       },
//     });
//   } catch (error) {
//     logger.error("Error fetching work orders:", error);
//     res
//       .status(500)
//       .json({ message: "Internal Server Error", error: error.message });
//   }
// });

// v1Router.get("/work-order/:id", authenticateJWT, async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status = "active" } = req.query; // Add status parameter

//     // Fetch from database with company_id for security
//     const whereClause = {
//       id: id,
//       company_id: req.user.company_id
//     };

//     // Add status filter unless 'all' is specified
//     if (status !== "all") {
//       whereClause.status = status;
//     }

//     const workOrder = await WorkOrder.findOne({
//       where: whereClause
//     });

//     if (!workOrder) {
//       return res.status(404).json({ message: "Work order not found" });
//     }

//     const result = workOrder.get({ plain: true });

//     res.json(result);
//   } catch (error) {
//     logger.error("Error fetching work order:", error);
//     res
//       .status(500)
//       .json({ message: "Internal Server Error", error: error.message });
//   }
// });

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
      work_order_sku_values: workDetails.work_order_sku_values || null,
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
v1Router.put(
  "/work-order/status/:workOrderId",
  authenticateJWT,
  async (req, res) => {
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
          message: "At least one field (priority or progress) is required",
        });
      }

      // Validate priority value if provided
      if (priority && !["High", "Medium", "Low"].includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "Priority must be High, Medium, or Low",
        });
      }

      // Validate progress value if provided
      const validProgressValues = [
        "Pending",
        "Product Planning",
        "Procurement Sourcing",
        "Production Planning",
        "Production",
        "Quality Control",
        "Packaging",
        "Shipping",
      ];

      if (progress && !validProgressValues.includes(progress)) {
        return res.status(400).json({
          success: false,
          message: `Progress must be one of: ${validProgressValues.join(", ")}`,
        });
      }

      // Find the work order
      const workOrder = await WorkOrder.findOne({
        where: {
          id: workOrderId,
          company_id: companyId,
        },
      });

      if (!workOrder) {
        return res.status(404).json({
          success: false,
          message: "Work order not found or you don't have access to it",
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
        data: workOrder.get({ plain: true }),
      });
    } catch (error) {
      logger.error("Error updating work order status:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
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
