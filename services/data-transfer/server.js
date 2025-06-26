/**
 * Data Transfer Service for PACKWORKX ERP System
 * 
 * This service handles module-based Excel file uploads and data transfers
 * Supports: Employee, Sale Order, Work Order, Machine, Routes, and other modules
 * 
 * Features:
 * - File upload with validation
 * - Module-based data processing
 * - Email notifications on completion
 * - Progress tracking and error logging
 * 
 * Date: 2025-06-26
 */

import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import EmailService from "../../common/services/email/emailService.js";
import { DataTransferCompletionTemplate } from "../../common/services/email/templates/dataTransferCompletion.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

// Models
const DataTransfer = db.DataTransfer;
const Employee = db.Employee || db.User; // Fallback to User if Employee not available
const SalesOrder = db.SalesOrder;
const WorkOrder = db.WorkOrder;
const Machine = db.Machine;
const Route = db.Route;
const Client = db.Client;
const ItemMaster = db.ItemMaster;
const PurchaseOrder = db.PurchaseOrder;
const Inventory = db.Inventory;
const Sku = db.Sku;
const Categories = db.Categories;
const Package = db.Package;

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'data-transfer');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${req.user.company_id}-${req.body.module_name}-${uniqueSuffix}-${originalName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel files (.xlsx, .xls) and CSV files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

/**
 * Get list of available modules for data transfer
 */
v1Router.get("/modules", authenticateJWT, async (req, res) => {
  try {
    const modules = [
      { value: 'employee', label: 'Employee', description: 'Import employee data' },
      { value: 'sale_order', label: 'Sales Order', description: 'Import sales order data' },
      { value: 'work_order', label: 'Work Order', description: 'Import work order data' },
      { value: 'machine', label: 'Machine', description: 'Import machine data' },
      { value: 'route', label: 'Route', description: 'Import route data' },
      { value: 'client', label: 'Client', description: 'Import client data' },
      { value: 'item', label: 'Item Master', description: 'Import item master data' },
      { value: 'purchase_order', label: 'Purchase Order', description: 'Import purchase order data' },
      { value: 'inventory', label: 'Inventory', description: 'Import inventory data' },
      { value: 'sku', label: 'SKU', description: 'Import SKU data' },
      { value: 'category', label: 'Category', description: 'Import category data' },
      { value: 'package', label: 'Package', description: 'Import package data' }
    ];

    res.json({
      success: true,
      data: modules,
      message: "Available modules retrieved successfully"
    });
  } catch (error) {
    logger.error('Error fetching modules:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch modules",
      error: error.message
    });
  }
});

/**
 * Upload Excel file for data transfer
 */
v1Router.post("/upload", authenticateJWT, upload.single('file'), async (req, res) => {
  try {
    const { module_name, email } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    if (!module_name) {
      return res.status(400).json({
        success: false,
        message: "Module name is required"
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required for notification"
      });
    }

    // Validate module name
    const validModules = ['employee', 'sale_order', 'work_order', 'machine', 'route', 
                         'client', 'item', 'purchase_order', 'inventory', 'sku', 'category', 'package'];
    
    if (!validModules.includes(module_name)) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Invalid module name"
      });
    }

    // Create data transfer record
    const dataTransfer = await DataTransfer.create({
      company_id: req.user.company_id,
      user_id: req.user.id,
      module_name: module_name,
      file_name: req.file.originalname,
      file_path: req.file.path,
      file_size: req.file.size,
      email: email,
      status: 'pending',
      created_by: req.user.id
    });

    // Start processing asynchronously
    processDataTransfer(dataTransfer.id);

    res.json({
      success: true,
      data: {
        transfer_id: dataTransfer.id,
        file_name: req.file.originalname,
        file_size: req.file.size,
        module_name: module_name,
        status: 'pending'
      },
      message: "File uploaded successfully. Processing started."
    });

  } catch (error) {
    logger.error('Error uploading file:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to upload file",
      error: error.message
    });
  }
});

/**
 * Get data transfer status
 */
v1Router.get("/status/:transfer_id", authenticateJWT, async (req, res) => {
  try {
    const { transfer_id } = req.params;
    
    const dataTransfer = await DataTransfer.findOne({
      where: {
        id: transfer_id,
        company_id: req.user.company_id
      }
    });

    if (!dataTransfer) {
      return res.status(404).json({
        success: false,
        message: "Data transfer not found"
      });
    }

    res.json({
      success: true,
      data: {
        id: dataTransfer.id,
        module_name: dataTransfer.module_name,
        file_name: dataTransfer.file_name,
        status: dataTransfer.status,
        total_records: dataTransfer.total_records,
        processed_records: dataTransfer.processed_records,
        failed_records: dataTransfer.failed_records,
        started_at: dataTransfer.started_at,
        completed_at: dataTransfer.completed_at,
        error_log: dataTransfer.error_log,
        email_sent: dataTransfer.email_sent
      },
      message: "Data transfer status retrieved successfully"
    });
  } catch (error) {
    logger.error('Error getting transfer status:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get transfer status",
      error: error.message
    });
  }
});

/**
 * Get all data transfers for company
 */
v1Router.get("/history", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, module_name } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      company_id: req.user.company_id
    };

    if (status) {
      whereClause.status = status;
    }

    if (module_name) {
      whereClause.module_name = module_name;
    }

    const { count, rows } = await DataTransfer.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: db.User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.json({
      success: true,
      data: {
        transfers: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: Math.ceil(count / limit)
        }
      },
      message: "Data transfer history retrieved successfully"
    });
  } catch (error) {
    logger.error('Error getting transfer history:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get transfer history",
      error: error.message
    });
  }
});

/**
 * Download template for specific module
 */
v1Router.get("/template/:module_name", authenticateJWT, async (req, res) => {
  try {
    const { module_name } = req.params;
    
    const template = getModuleTemplate(module_name);
    if (!template) {
      return res.status(400).json({
        success: false,
        message: "Invalid module name or template not available"
      });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${module_name} Template`);

    // Add headers
    worksheet.addRow(template.headers);
    
    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366092' }
    };

    // Add sample data
    if (template.sampleData) {
      template.sampleData.forEach(row => {
        worksheet.addRow(row);
      });
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${module_name}_template.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Error generating template:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate template",
      error: error.message
    });
  }
});

/**
 * Process data transfer asynchronously
 */
async function processDataTransfer(transferId) {
  let dataTransfer;
  
  try {
    dataTransfer = await DataTransfer.findByPk(transferId);
    if (!dataTransfer) {
      throw new Error('Data transfer record not found');
    }

    // Update status to processing
    await dataTransfer.update({
      status: 'processing',
      started_at: new Date()
    });

    // Read Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(dataTransfer.file_path);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('No worksheet found in the Excel file');
    }

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        rows.push(row.values);
      }
    });

    const totalRecords = rows.length;
    let processedRecords = 0;
    let failedRecords = 0;
    const errors = [];

    // Update total records
    await dataTransfer.update({ total_records: totalRecords });

    // Process each row based on module
    for (let i = 0; i < rows.length; i++) {
      try {
        await processModuleRecord(dataTransfer.module_name, rows[i], dataTransfer.company_id, dataTransfer.user_id);
        processedRecords++;
      } catch (error) {
        failedRecords++;
        errors.push(`Row ${i + 2}: ${error.message}`);
        logger.error(`Error processing row ${i + 2}:`, error);
      }

      // Update progress every 10 records
      if ((i + 1) % 10 === 0) {
        await dataTransfer.update({
          processed_records: processedRecords,
          failed_records: failedRecords
        });
      }
    }

    // Final update
    await dataTransfer.update({
      status: failedRecords === 0 ? 'completed' : (processedRecords > 0 ? 'completed' : 'failed'),
      processed_records: processedRecords,
      failed_records: failedRecords,
      completed_at: new Date(),
      error_log: errors.length > 0 ? errors.join('\n') : null
    });

    // Send completion email
    await sendCompletionEmail(dataTransfer);

  } catch (error) {
    logger.error('Error processing data transfer:', error);
    
    if (dataTransfer) {
      await dataTransfer.update({
        status: 'failed',
        completed_at: new Date(),
        error_log: error.message
      });
      
      // Send failure email
      await sendCompletionEmail(dataTransfer);
    }
  }
}

/**
 * Process individual record based on module type
 */
async function processModuleRecord(moduleName, row, companyId, userId) {
  switch (moduleName) {
    case 'employee':
      return await processEmployeeRecord(row, companyId, userId);
    case 'sale_order':
      return await processSalesOrderRecord(row, companyId, userId);
    case 'work_order':
      return await processWorkOrderRecord(row, companyId, userId);
    case 'machine':
      return await processMachineRecord(row, companyId, userId);
    case 'route':
      return await processRouteRecord(row, companyId, userId);
    case 'client':
      return await processClientRecord(row, companyId, userId);
    case 'item':
      return await processItemRecord(row, companyId, userId);
    case 'purchase_order':
      return await processPurchaseOrderRecord(row, companyId, userId);
    case 'inventory':
      return await processInventoryRecord(row, companyId, userId);
    case 'sku':
      return await processSkuRecord(row, companyId, userId);
    case 'category':
      return await processCategoryRecord(row, companyId, userId);
    case 'package':
      return await processPackageRecord(row, companyId, userId);
    default:
      throw new Error(`Unknown module: ${moduleName}`);
  }
}

/**
 * Process employee record
 */
async function processEmployeeRecord(row, companyId, userId) {
  // Skip empty rows
  if (!row || !row[1]) return;

  const employeeData = {
    company_id: companyId,
    user_id: userId, // This might need to be adjusted based on your employee structure
    employee_id: row[1],
    address: row[2],
    skills: row[3],
    hourly_rate: parseFloat(row[4]) || null,
    department_id: parseInt(row[5]) || null,
    designation_id: parseInt(row[6]) || null,
    joining_date: row[7] ? new Date(row[7]) : null,
    employment_type: row[8],
    created_by: userId
  };

  // Check if Employee model exists, otherwise use User model
  const model = Employee || db.User;
  return await model.create(employeeData);
}

/**
 * Process sales order record
 */
async function processSalesOrderRecord(row, companyId, userId) {
  if (!row || !row[1]) return;

  const salesOrderData = {
    company_id: companyId,
    client_id: parseInt(row[1]) || null,
    order_number: row[2],
    order_date: row[3] ? new Date(row[3]) : new Date(),
    delivery_date: row[4] ? new Date(row[4]) : null,
    total_amount: parseFloat(row[5]) || 0,
    status: row[6] || 'pending',
    created_by: userId
  };

  return await SalesOrder.create(salesOrderData);
}

/**
 * Process work order record
 */
async function processWorkOrderRecord(row, companyId, userId) {
  if (!row || !row[1]) return;

  const workOrderData = {
    company_id: companyId,
    work_order_number: row[1],
    sales_order_id: parseInt(row[2]) || null,
    start_date: row[3] ? new Date(row[3]) : new Date(),
    end_date: row[4] ? new Date(row[4]) : null,
    status: row[5] || 'pending',
    priority: row[6] || 'medium',
    created_by: userId
  };

  return await WorkOrder.create(workOrderData);
}

/**
 * Process machine record
 */
async function processMachineRecord(row, companyId, userId) {
  if (!row || !row[1]) return;

  const machineData = {
    company_id: companyId,
    machine_name: row[1],
    machine_code: row[2],
    machine_type: row[3],
    capacity: parseFloat(row[4]) || null,
    location: row[5],
    status: row[6] || 'active',
    created_by: userId
  };

  return await Machine.create(machineData);
}

/**
 * Process route record
 */
async function processRouteRecord(row, companyId, userId) {
  if (!row || !row[1]) return;

  const routeData = {
    company_id: companyId,
    route_name: row[1],
    route_code: row[2],
    description: row[3],
    sequence: parseInt(row[4]) || 1,
    status: row[5] || 'active',
    created_by: userId
  };

  return await Route.create(routeData);
}

/**
 * Process client record
 */
async function processClientRecord(row, companyId, userId) {
  if (!row || !row[1]) return;

  const clientData = {
    company_id: companyId,
    client_name: row[1],
    email: row[2],
    phone: row[3],
    address: row[4],
    city: row[5],
    state: row[6],
    country: row[7],
    status: row[8] || 'active',
    created_by: userId
  };

  return await Client.create(clientData);
}

/**
 * Process item record
 */
async function processItemRecord(row, companyId, userId) {
  if (!row || !row[1]) return;

  const itemData = {
    company_id: companyId,
    item_name: row[1],
    item_code: row[2],
    category: row[3],
    unit: row[4],
    price: parseFloat(row[5]) || 0,
    status: row[6] || 'active',
    created_by: userId
  };

  return await ItemMaster.create(itemData);
}

/**
 * Process purchase order record
 */
async function processPurchaseOrderRecord(row, companyId, userId) {
  if (!row || !row[1]) return;

  const poData = {
    company_id: companyId,
    po_number: row[1],
    supplier_name: row[2],
    po_date: row[3] ? new Date(row[3]) : new Date(),
    delivery_date: row[4] ? new Date(row[4]) : null,
    total_amount: parseFloat(row[5]) || 0,
    status: row[6] || 'pending',
    created_by: userId
  };

  return await PurchaseOrder.create(poData);
}

/**
 * Process inventory record
 */
async function processInventoryRecord(row, companyId, userId) {
  if (!row || !row[1]) return;

  const inventoryData = {
    company_id: companyId,
    item_id: parseInt(row[1]) || null,
    quantity: parseFloat(row[2]) || 0,
    unit_price: parseFloat(row[3]) || 0,
    location: row[4],
    batch_number: row[5],
    expiry_date: row[6] ? new Date(row[6]) : null,
    created_by: userId
  };

  return await Inventory.create(inventoryData);
}

/**
 * Process SKU record
 */
async function processSkuRecord(row, companyId, userId) {
  if (!row || !row[1]) return;

  const skuData = {
    company_id: companyId,
    sku_name: row[1],
    sku_code: row[2],
    description: row[3],
    price: parseFloat(row[4]) || 0,
    status: row[5] || 'active',
    created_by: userId
  };

  return await Sku.create(skuData);
}

/**
 * Process category record
 */
async function processCategoryRecord(row, companyId, userId) {
  if (!row || !row[1]) return;

  const categoryData = {
    company_id: companyId,
    category_name: row[1],
    description: row[2],
    parent_id: parseInt(row[3]) || null,
    status: row[4] || 'active',
    created_by: userId
  };

  return await Categories.create(categoryData);
}

/**
 * Process package record
 */
async function processPackageRecord(row, companyId, userId) {
  if (!row || !row[1]) return;

  const packageData = {
    company_id: companyId,
    package_name: row[1],
    package_code: row[2],
    dimensions: row[3],
    weight: parseFloat(row[4]) || 0,
    material: row[5],
    created_by: userId
  };

  return await Package.create(packageData);
}

/**
 * Send completion email
 */
async function sendCompletionEmail(dataTransfer) {
  try {
    // Get user details
    const user = await db.User.findByPk(dataTransfer.user_id);
    
    const emailData = {
      to: dataTransfer.email,
      subject: `Data Transfer ${dataTransfer.status === 'completed' ? 'Completed' : 'Update'} - ${dataTransfer.module_name.replace('_', ' ')}`,
      html: DataTransferCompletionTemplate({
        userName: user ? user.name : 'User',
        moduleName: dataTransfer.module_name,
        fileName: dataTransfer.file_name,
        totalRecords: dataTransfer.total_records,
        processedRecords: dataTransfer.processed_records,
        failedRecords: dataTransfer.failed_records,
        status: dataTransfer.status,
        startedAt: dataTransfer.started_at,
        completedAt: dataTransfer.completed_at,
        dashboardUrl: process.env.FRONTEND_URL + '/dashboard',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@packworkx.com'
      })
    };

    await EmailService.sendEmail(emailData);
    
    // Mark email as sent
    await dataTransfer.update({ email_sent: true });
    
    logger.info(`Completion email sent for data transfer ${dataTransfer.id}`);
  } catch (error) {
    logger.error(`Failed to send completion email for data transfer ${dataTransfer.id}:`, error);
  }
}

/**
 * Get template structure for different modules
 */
function getModuleTemplate(moduleName) {
  const templates = {
    employee: {
      headers: ['S.No', 'Employee ID', 'Address', 'Skills', 'Hourly Rate', 'Department ID', 'Designation ID', 'Joining Date', 'Employment Type'],
      sampleData: [
        [1, 'EMP001', '123 Main St', 'JavaScript, Node.js', 25.50, 1, 1, '2024-01-15', 'Full-time'],
        [2, 'EMP002', '456 Oak Ave', 'Python, Django', 30.00, 2, 2, '2024-02-01', 'Part-time']
      ]
    },
    sale_order: {
      headers: ['S.No', 'Client ID', 'Order Number', 'Order Date', 'Delivery Date', 'Total Amount', 'Status'],
      sampleData: [
        [1, 1, 'SO001', '2024-06-01', '2024-06-15', 1500.00, 'pending'],
        [2, 2, 'SO002', '2024-06-02', '2024-06-16', 2500.00, 'confirmed']
      ]
    },
    work_order: {
      headers: ['S.No', 'Work Order Number', 'Sales Order ID', 'Start Date', 'End Date', 'Status', 'Priority'],
      sampleData: [
        [1, 'WO001', 1, '2024-06-01', '2024-06-10', 'pending', 'high'],
        [2, 'WO002', 2, '2024-06-05', '2024-06-15', 'in_progress', 'medium']
      ]
    },
    machine: {
      headers: ['S.No', 'Machine Name', 'Machine Code', 'Machine Type', 'Capacity', 'Location', 'Status'],
      sampleData: [
        [1, 'Printing Machine 1', 'PM001', 'Printing', 1000, 'Floor 1', 'active'],
        [2, 'Cutting Machine 1', 'CM001', 'Cutting', 500, 'Floor 2', 'active']
      ]
    },
    route: {
      headers: ['S.No', 'Route Name', 'Route Code', 'Description', 'Sequence', 'Status'],
      sampleData: [
        [1, 'Standard Route', 'RT001', 'Standard production route', 1, 'active'],
        [2, 'Express Route', 'RT002', 'Express production route', 2, 'active']
      ]
    },
    client: {
      headers: ['S.No', 'Client Name', 'Email', 'Phone', 'Address', 'City', 'State', 'Country', 'Status'],
      sampleData: [
        [1, 'ABC Corp', 'contact@abc.com', '+1234567890', '123 Business St', 'New York', 'NY', 'USA', 'active'],
        [2, 'XYZ Ltd', 'info@xyz.com', '+1987654321', '456 Trade Ave', 'Los Angeles', 'CA', 'USA', 'active']
      ]
    },
    item: {
      headers: ['S.No', 'Item Name', 'Item Code', 'Category', 'Unit', 'Price', 'Status'],
      sampleData: [
        [1, 'Cardboard Sheet', 'ITM001', 'Raw Material', 'Sheets', 5.00, 'active'],
        [2, 'Printing Ink', 'ITM002', 'Consumables', 'Liters', 25.00, 'active']
      ]
    },
    purchase_order: {
      headers: ['S.No', 'PO Number', 'Supplier Name', 'PO Date', 'Delivery Date', 'Total Amount', 'Status'],
      sampleData: [
        [1, 'PO001', 'Supplier ABC', '2024-06-01', '2024-06-15', 5000.00, 'pending'],
        [2, 'PO002', 'Supplier XYZ', '2024-06-02', '2024-06-16', 7500.00, 'approved']
      ]
    },
    inventory: {
      headers: ['S.No', 'Item ID', 'Quantity', 'Unit Price', 'Location', 'Batch Number', 'Expiry Date'],
      sampleData: [
        [1, 1, 100, 5.00, 'Warehouse A', 'BATCH001', '2025-12-31'],
        [2, 2, 50, 25.00, 'Warehouse B', 'BATCH002', '2024-12-31']
      ]
    },
    sku: {
      headers: ['S.No', 'SKU Name', 'SKU Code', 'Description', 'Price', 'Status'],
      sampleData: [
        [1, 'Box Type A', 'SKU001', 'Small cardboard box', 10.00, 'active'],
        [2, 'Box Type B', 'SKU002', 'Large cardboard box', 15.00, 'active']
      ]
    },
    category: {
      headers: ['S.No', 'Category Name', 'Description', 'Parent ID', 'Status'],
      sampleData: [
        [1, 'Raw Materials', 'All raw materials', null, 'active'],
        [2, 'Finished Goods', 'All finished products', null, 'active']
      ]
    },
    package: {
      headers: ['S.No', 'Package Name', 'Package Code', 'Dimensions', 'Weight', 'Material'],
      sampleData: [
        [1, 'Standard Box', 'PKG001', '10x8x6 inches', 0.5, 'Cardboard'],
        [2, 'Large Box', 'PKG002', '20x16x12 inches', 1.2, 'Corrugated']
      ]
    }
  };

  return templates[moduleName] || null;
}

/**
 * Dashboard API Endpoint - Data Transfer Summary
 */
v1Router.get("/dashboard", authenticateJWT, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    
    // Default date range (current month if not provided)
    const startDate = from_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = to_date || new Date();

    const whereClause = {
      company_id: req.user.company_id,
      created_at: {
        [Op.between]: [startDate, endDate]
      }
    };

    // Get transfer statistics
    const totalTransfers = await DataTransfer.count({ where: whereClause });
    
    const statusCounts = await DataTransfer.findAll({
      where: whereClause,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    const moduleCounts = await DataTransfer.findAll({
      where: whereClause,
      attributes: [
        'module_name',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['module_name'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
    });

    // Get recent transfers
    const recentTransfers = await DataTransfer.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: 10,
      include: [
        {
          model: db.User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.json({
      success: true,
      data: {
        summary: {
          total_transfers: totalTransfers,
          status_breakdown: statusCounts.reduce((acc, item) => {
            acc[item.status] = parseInt(item.get('count'));
            return acc;
          }, {}),
          module_breakdown: moduleCounts.map(item => ({
            module: item.module_name,
            count: parseInt(item.get('count'))
          }))
        },
        recent_transfers: recentTransfers
      },
      message: "Dashboard data retrieved successfully"
    });
  } catch (error) {
    logger.error('Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get dashboard data",
      error: error.message
    });
  }
});

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Data Transfer Service is running",
    timestamp: new Date(),
    modules_supported: ['employee', 'sale_order', 'work_order', 'machine', 'route', 'client', 'item', 'purchase_order', 'inventory', 'sku', 'category', 'package']
  });
});

// Use Version 1 Router
app.use("/api/data-transfer", v1Router);

const PORT = process.env.PORT_DATA_TRANSFER || 3020;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Data-transfer Service running on port ${PORT}`);
});
