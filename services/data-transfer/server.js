/**
 * Data Transfer Service for PACKWORKX ERP System
 * 
 * This service handles module-based Excel file uploads and data transfers
 * Two-step process: 1) Upload file 2) Map columns and process
 * 
 * Features:
 * - File upload with validation
 * - Column mapping interface
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
import { 
  branchFilterMiddleware, 
  resetBranchFilter, 
  setupBranchFiltering,
  patchModelForBranchFiltering 
} from "../../common/helper/branchFilter.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(json());
app.use(cors());

// SETUP BRANCH FILTERING
setupBranchFiltering(sequelize);

const v1Router = Router();
// ADD MIDDLEWARE TO ROUTER
v1Router.use(branchFilterMiddleware);
v1Router.use(resetBranchFilter);

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

patchModelForBranchFiltering(DataTransfer);


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
 * Step 1: Upload Excel file (without processing)
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

    // Read Excel file to get headers and preview data
    const { headers, previewData, totalRecords } = await readExcelHeaders(req.file.path);

    // Create data transfer record
    const dataTransfer = await DataTransfer.create({
      company_id: req.user.company_id,
      user_id: req.user.id,
      module_name: module_name,
      file_name: req.file.originalname,
      file_path: req.file.path,
      file_size: req.file.size,
      email: email,
      status: 'uploaded', // New status for uploaded but not processed
      total_records: totalRecords,
      created_by: req.user.id
    });

    // Get database fields for the module
    const dbFields = getModuleFields(module_name);

    res.json({
      success: true,
      data: {
        transfer_id: dataTransfer.id,
        file_name: req.file.originalname,
        file_size: req.file.size,
        module_name: module_name,
        status: 'uploaded',
        total_records: totalRecords,
        excel_headers: headers,
        preview_data: previewData,
        database_fields: dbFields
      },
      message: "File uploaded successfully. Please map columns to proceed."
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
 * Step 2: Map columns and start processing
 */
v1Router.post("/map-columns/:transfer_id", authenticateJWT, async (req, res) => {
  try {
    const { transfer_id } = req.params;
    const { column_mapping } = req.body;
    
    // Validate input
    if (!column_mapping || typeof column_mapping !== 'object') {
      return res.status(400).json({
        success: false,
        message: "Column mapping is required and must be an object"
      });
    }

    // Find the data transfer record
    const dataTransfer = await DataTransfer.findOne({
      where: {
        id: transfer_id,
        company_id: req.user.company_id,
        status: 'uploaded' // Only allow mapping for uploaded files
      }
    });

    if (!dataTransfer) {
      return res.status(404).json({
        success: false,
        message: "Data transfer not found or already processed"
      });
    }

    // Validate that at least one mapping exists
    const mappedFields = Object.values(column_mapping).filter(field => field && field !== '');
    if (mappedFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one column must be mapped"
      });
    }

    // Get module fields to validate mapping
    const moduleFields = getModuleFields(dataTransfer.module_name);
    const requiredFields = moduleFields.filter(f => f.required).map(f => f.key);
    const validFieldKeys = moduleFields.map(f => f.key);

    // Validate that all mapped fields are valid for the module
    const invalidFields = mappedFields.filter(field => !validFieldKeys.includes(field));
    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid field mappings",
        invalid_fields: invalidFields,
        valid_fields: validFieldKeys
      });
    }

    // Check if required fields are mapped
    const mappedFieldKeys = Object.values(column_mapping).filter(f => f);
    const missingRequired = requiredFields.filter(field => !mappedFieldKeys.includes(field));
    
    if (missingRequired.length > 0) {
      logger.warn(`Missing required fields for transfer ${transfer_id}: ${missingRequired.join(', ')}`);
      // We'll allow processing to continue but log the warning
    }

    // Update the data transfer record with column mapping
    await dataTransfer.update({
      column_mapping: JSON.stringify(column_mapping),
      status: 'pending'
    });

    // Start processing in the background
    processDataTransferWithMapping(transfer_id, column_mapping).catch(error => {
      logger.error(`Background processing failed for transfer ${transfer_id}:`, error);
    });

    res.json({
      success: true,
      data: {
        transfer_id: dataTransfer.id,
        status: 'queued',
        message: "Column mapping saved. Processing started.",
        column_mapping: column_mapping,
        missing_required_fields: missingRequired.length > 0 ? missingRequired : undefined
      },
      message: "Column mapping successful. Data transfer is now being processed."
    });

  } catch (error) {
    logger.error('Error mapping columns:', error);
    res.status(500).json({
      success: false,
      message: "Failed to map columns",
      error: error.message
    });
  }
});

/**
 * Get preview data for column mapping
 */
v1Router.get("/preview/:transfer_id", authenticateJWT, async (req, res) => {
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

    // Read Excel file to get headers and preview data
    const { headers, previewData } = await readExcelHeaders(dataTransfer.file_path);
    
    // Get database fields for the module
    const dbFields = getModuleFields(dataTransfer.module_name);

    res.json({
      success: true,
      data: {
        transfer_id: dataTransfer.id,
        module_name: dataTransfer.module_name,
        excel_headers: headers,
        preview_data: previewData,
        database_fields: dbFields,
        total_records: dataTransfer.total_records
      },
      message: "Preview data retrieved successfully"
    });
  } catch (error) {
    logger.error('Error getting preview data:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get preview data",
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
        email_sent: dataTransfer.email_sent,
        column_mapping: dataTransfer.column_mapping ? JSON.parse(dataTransfer.column_mapping) : null
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
 * Get all data transfers for company (simple version without associations)
 */
v1Router.get("/history-simple", authenticateJWT, async (req, res) => {
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
      offset: parseInt(offset)
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
    logger.error('Error getting transfer history (simple):', error);
    res.status(500).json({
      success: false,
      message: "Failed to get transfer history",
      error: error.message
    });
  }
});

/**
 * Get all data transfers for company (simplified without associations)
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

    // Use simple query without associations for now
    const { count, rows } = await DataTransfer.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Manually add creator info for each transfer
    const transfersWithCreator = await Promise.all(
      rows.map(async (transfer) => {
        try {
          const creator = await db.User.findByPk(transfer.created_by, {
            attributes: ['id', 'name', 'email']
          });
          return {
            ...transfer.toJSON(),
            creator: creator ? creator.toJSON() : null
          };
        } catch (error) {
          logger.warn(`Could not fetch creator for transfer ${transfer.id}:`, error.message);
          return {
            ...transfer.toJSON(),
            creator: null
          };
        }
      })
    );

    res.json({
      success: true,
      data: {
        transfers: transfersWithCreator,
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

    // Get recent transfers (simplified without associations)
    const recentTransfersData = await DataTransfer.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: 10
    });

    // Manually add creator info for recent transfers
    const recentTransfers = await Promise.all(
      recentTransfersData.map(async (transfer) => {
        try {
          const creator = await db.User.findByPk(transfer.created_by, {
            attributes: ['id', 'name', 'email']
          });
          return {
            ...transfer.toJSON(),
            creator: creator ? creator.toJSON() : null
          };
        } catch (error) {
          return {
            ...transfer.toJSON(),
            creator: null
          };
        }
      })
    );

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

/**
 * Read Excel file headers and preview data
 */
async function readExcelHeaders(filePath) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('No worksheet found in the Excel file');
    }

    const headers = [];
    const previewData = [];
    let totalRecords = 0;

    // Get headers from first row
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      if (cell.value) {
        headers.push({
          index: colNumber - 1,
          name: cell.value.toString().trim(),
          letter: String.fromCharCode(64 + colNumber) // A, B, C, etc.
        });
      }
    });

    // Get preview data (first 5 rows)
    let rowCount = 0;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        totalRecords++;
        if (rowCount < 5) { // Only get first 5 rows for preview
          const rowData = [];
          row.eachCell((cell, colNumber) => {
            rowData[colNumber - 1] = cell.value ? cell.value.toString() : '';
          });
          previewData.push(rowData);
          rowCount++;
        }
      }
    });

    return { headers, previewData, totalRecords };
  } catch (error) {
    logger.error('Error reading Excel headers:', error);
    throw error;
  }
}

/**
 * Get database fields for module
 */
function getModuleFields(moduleName) {
  const fieldMappings = {
    employee: [
      { key: 'employee_id', label: 'Employee ID', type: 'string', required: true },
      { key: 'address', label: 'Address', type: 'text', required: false },
      { key: 'skills', label: 'Skills', type: 'text', required: false },
      { key: 'hourly_rate', label: 'Hourly Rate', type: 'number', required: false },
      { key: 'department_id', label: 'Department ID', type: 'number', required: false },
      { key: 'designation_id', label: 'Designation ID', type: 'number', required: false },
      { key: 'joining_date', label: 'Joining Date', type: 'date', required: false },
      { key: 'employment_type', label: 'Employment Type', type: 'string', required: false },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date', required: false },
      { key: 'marital_status', label: 'Marital Status', type: 'string', required: false }
    ],
    sale_order: [
      { key: 'client_id', label: 'Client ID', type: 'number', required: true },
      { key: 'order_number', label: 'Order Number', type: 'string', required: true },
      { key: 'order_date', label: 'Order Date', type: 'date', required: true },
      { key: 'delivery_date', label: 'Delivery Date', type: 'date', required: false },
      { key: 'total_amount', label: 'Total Amount', type: 'number', required: false },
      { key: 'status', label: 'Status', type: 'string', required: false },
      { key: 'description', label: 'Description', type: 'text', required: false }
    ],
    work_order: [
      { key: 'work_order_number', label: 'Work Order Number', type: 'string', required: true },
      { key: 'sales_order_id', label: 'Sales Order ID', type: 'number', required: false },
      { key: 'start_date', label: 'Start Date', type: 'date', required: true },
      { key: 'end_date', label: 'End Date', type: 'date', required: false },
      { key: 'status', label: 'Status', type: 'string', required: false },
      { key: 'priority', label: 'Priority', type: 'string', required: false },
      { key: 'description', label: 'Description', type: 'text', required: false }
    ],
    machine: [
      { key: 'machine_name', label: 'Machine Name', type: 'string', required: true },
      { key: 'machine_code', label: 'Machine Code', type: 'string', required: true },
      { key: 'machine_type', label: 'Machine Type', type: 'string', required: false },
      { key: 'capacity', label: 'Capacity', type: 'number', required: false },
      { key: 'location', label: 'Location', type: 'string', required: false },
      { key: 'status', label: 'Status', type: 'string', required: false },
      { key: 'description', label: 'Description', type: 'text', required: false }
    ],
    route: [
      { key: 'route_name', label: 'Route Name', type: 'string', required: true },
      { key: 'route_code', label: 'Route Code', type: 'string', required: true },
      { key: 'description', label: 'Description', type: 'text', required: false },
      { key: 'sequence', label: 'Sequence', type: 'number', required: false },
      { key: 'status', label: 'Status', type: 'string', required: false }
    ],
    client: [
      { key: 'client_name', label: 'Client Name', type: 'string', required: true },
      { key: 'email', label: 'Email', type: 'email', required: false },
      { key: 'phone', label: 'Phone', type: 'string', required: false },
      { key: 'address', label: 'Address', type: 'text', required: false },
      { key: 'city', label: 'City', type: 'string', required: false },
      { key: 'state', label: 'State', type: 'string', required: false },
      { key: 'country', label: 'Country', type: 'string', required: false },
      { key: 'status', label: 'Status', type: 'string', required: false }
    ],
    item: [
      { key: 'item_name', label: 'Item Name', type: 'string', required: true },
      { key: 'item_code', label: 'Item Code', type: 'string', required: true },
      { key: 'category', label: 'Category', type: 'string', required: false },
      { key: 'unit', label: 'Unit', type: 'string', required: false },
      { key: 'price', label: 'Price', type: 'number', required: false },
      { key: 'status', label: 'Status', type: 'string', required: false },
      { key: 'description', label: 'Description', type: 'text', required: false }
    ],
    purchase_order: [
      { key: 'po_number', label: 'PO Number', type: 'string', required: true },
      { key: 'supplier_name', label: 'Supplier Name', type: 'string', required: true },
      { key: 'po_date', label: 'PO Date', type: 'date', required: true },
      { key: 'delivery_date', label: 'Delivery Date', type: 'date', required: false },
      { key: 'total_amount', label: 'Total Amount', type: 'number', required: false },
      { key: 'status', label: 'Status', type: 'string', required: false }
    ],
    inventory: [
      { key: 'item_id', label: 'Item ID', type: 'number', required: true },
      { key: 'quantity', label: 'Quantity', type: 'number', required: true },
      { key: 'unit_price', label: 'Unit Price', type: 'number', required: false },
      { key: 'location', label: 'Location', type: 'string', required: false },
      { key: 'batch_number', label: 'Batch Number', type: 'string', required: false },
      { key: 'expiry_date', label: 'Expiry Date', type: 'date', required: false }
    ],
    sku: [
      { key: 'sku_name', label: 'SKU Name', type: 'string', required: true },
      { key: 'sku_code', label: 'SKU Code', type: 'string', required: true },
      { key: 'description', label: 'Description', type: 'text', required: false },
      { key: 'price', label: 'Price', type: 'number', required: false },
      { key: 'status', label: 'Status', type: 'string', required: false }
    ],
    category: [
      { key: 'category_name', label: 'Category Name', type: 'string', required: true },
      { key: 'description', label: 'Description', type: 'text', required: false },
      { key: 'parent_id', label: 'Parent ID', type: 'number', required: false },
      { key: 'status', label: 'Status', type: 'string', required: false }
    ],
    package: [
      { key: 'package_name', label: 'Package Name', type: 'string', required: true },
      { key: 'package_code', label: 'Package Code', type: 'string', required: true },
      { key: 'dimensions', label: 'Dimensions', type: 'string', required: false },
      { key: 'weight', label: 'Weight', type: 'number', required: false },
      { key: 'material', label: 'Material', type: 'string', required: false }
    ]
  };

  return fieldMappings[moduleName] || [];
}

/**
 * Process data transfer with column mapping
 */
async function processDataTransferWithMapping(transferId, columnMapping) {
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

    // Process each row based on module with column mapping
    for (let i = 0; i < rows.length; i++) {
      try {
        await processModuleRecordWithMapping(
          dataTransfer.module_name, 
          rows[i], 
          columnMapping,
          dataTransfer.company_id, 
          dataTransfer.user_id
        );
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
 * Process individual record with column mapping
 */
async function processModuleRecordWithMapping(moduleName, row, columnMapping, companyId, userId) {
  // Skip empty rows
  if (!row || row.length <= 1) return;

  // Map Excel columns to database fields using column mapping
  const mappedData = {};
  
  Object.entries(columnMapping).forEach(([excelColumn, dbField]) => {
    if (dbField && dbField !== '') {
      const columnIndex = parseInt(excelColumn);
      const value = row[columnIndex + 1]; // Excel is 1-indexed, array is 0-indexed, and row[0] is usually null
      
      if (value !== undefined && value !== null && value !== '') {
        // Process the value based on field type
        mappedData[dbField] = processFieldValue(value, dbField);
      }
    }
  });

  // Add common fields
  mappedData.company_id = companyId;
  mappedData.created_by = userId;

  // Call the appropriate processing function
  switch (moduleName) {
    case 'employee':
      return await processEmployeeRecordMapped(mappedData, userId);
    case 'sale_order':
      return await processSalesOrderRecordMapped(mappedData);
    case 'work_order':
      return await processWorkOrderRecordMapped(mappedData);
    case 'machine':
      return await processMachineRecordMapped(mappedData);
    case 'route':
      return await processRouteRecordMapped(mappedData);
    case 'client':
      return await processClientRecordMapped(mappedData);
    case 'item':
      return await processItemRecordMapped(mappedData);
    case 'purchase_order':
      return await processPurchaseOrderRecordMapped(mappedData);
    case 'inventory':
      return await processInventoryRecordMapped(mappedData);
    case 'sku':
      return await processSkuRecordMapped(mappedData);
    case 'category':
      return await processCategoryRecordMapped(mappedData);
    case 'package':
      return await processPackageRecordMapped(mappedData);
    default:
      throw new Error(`Unknown module: ${moduleName}`);
  }
}

/**
 * Process field value based on type
 */
function processFieldValue(value, fieldName) {
  // Handle null or undefined values
  if (value === null || value === undefined) {
    return null;
  }
  
  const stringValue = value.toString().trim();
  
  // Date fields
  if (fieldName.includes('date') || fieldName.includes('Date')) {
    if (stringValue === '') return null;
    const date = new Date(stringValue);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Numeric fields
  if (fieldName.includes('id') || fieldName.includes('Id') || 
      fieldName.includes('rate') || fieldName.includes('amount') || 
      fieldName.includes('price') || fieldName.includes('quantity') || 
      fieldName.includes('weight') || fieldName.includes('capacity')) {
    const num = parseFloat(stringValue);
    return isNaN(num) ? null : num;
  }
  
  // Status field - keep as string and truncate if needed
  // Most status fields in database are VARCHAR(20) or VARCHAR(50)
  if (fieldName === 'status') {
    // Truncate to 20 characters to be safe (adjust based on your DB schema)
    return stringValue.substring(0, 20);
  }
  
  // Text fields that might have length limits
  if (fieldName === 'employment_type' || fieldName === 'marital_status' || 
      fieldName === 'priority' || fieldName === 'unit' || fieldName === 'category') {
    // These fields typically have shorter limits
    return stringValue.substring(0, 50);
  }
  
  // Email field - basic validation and truncation
  if (fieldName === 'email') {
    // Basic email validation and truncate to reasonable length
    return stringValue.substring(0, 100);
  }
  
  // Phone field - remove special characters and limit length
  if (fieldName === 'phone') {
    // Keep only digits, +, -, (, ), and spaces
    const cleanPhone = stringValue.replace(/[^0-9+\-() ]/g, '');
    return cleanPhone.substring(0, 20);
  }
  
  // Code fields - usually have specific formats
  if (fieldName.includes('_code') || fieldName.includes('_number')) {
    return stringValue.substring(0, 50);
  }
  
  // Name fields - reasonable length limit
  if (fieldName.includes('_name') || fieldName === 'name') {
    return stringValue.substring(0, 100);
  }
  
  // Description and address fields - longer text
  if (fieldName === 'description' || fieldName === 'address' || fieldName === 'skills') {
    // These are typically TEXT fields, but let's limit to reasonable length
    return stringValue.substring(0, 500);
  }
  
  // Default: return as string with reasonable length limit
  return stringValue.substring(0, 255);
}

/**
 * Module-specific processing functions with mapped data
 */
async function processEmployeeRecordMapped(mappedData, userId) {
  // Ensure user_id is set for employee
  if (!mappedData.user_id) {
    mappedData.user_id = userId;
  }
  
  const model = Employee || db.User;
  return await model.create(mappedData);
}

async function processSalesOrderRecordMapped(mappedData) {
  if (!mappedData.order_date) {
    mappedData.order_date = new Date();
  }
  if (!mappedData.status) {
    mappedData.status = 'pending';
  }
  return await SalesOrder.create(mappedData);
}

async function processWorkOrderRecordMapped(mappedData) {
  if (!mappedData.start_date) {
    mappedData.start_date = new Date();
  }
  if (!mappedData.status) {
    mappedData.status = 'pending';
  }
  if (!mappedData.priority) {
    mappedData.priority = 'medium';
  }
  return await WorkOrder.create(mappedData);
}

async function processMachineRecordMapped(mappedData) {
  if (!mappedData.status) {
    mappedData.status = 'active';
  }
  return await Machine.create(mappedData);
}

async function processRouteRecordMapped(mappedData) {
  if (!mappedData.sequence) {
    mappedData.sequence = 1;
  }
  if (!mappedData.status) {
    mappedData.status = 'active';
  }
  return await Route.create(mappedData);
}

async function processClientRecordMapped(mappedData) {
  if (!mappedData.status) {
    mappedData.status = 'active';
  }
  return await Client.create(mappedData);
}

async function processItemRecordMapped(mappedData) {
  if (!mappedData.status) {
    mappedData.status = 'active';
  }
  return await ItemMaster.create(mappedData);
}

async function processPurchaseOrderRecordMapped(mappedData) {
  if (!mappedData.po_date) {
    mappedData.po_date = new Date();
  }
  if (!mappedData.status) {
    mappedData.status = 'pending';
  }
  return await PurchaseOrder.create(mappedData);
}

async function processInventoryRecordMapped(mappedData) {
  return await Inventory.create(mappedData);
}

async function processSkuRecordMapped(mappedData) {
  // Validate and set default status if not provided or invalid
  const validStatuses = ['active', 'inactive', 'draft', 'archived'];
  
  if (!mappedData.status || mappedData.status === '') {
    mappedData.status = 'active';
  } else {
    // Normalize status value
    const normalizedStatus = mappedData.status.toString().toLowerCase().trim();
    
    // Check if it's a valid status
    if (validStatuses.includes(normalizedStatus)) {
      mappedData.status = normalizedStatus;
    } else {
      // If status is not in valid list, default to 'active'
      // You could also throw an error here if you want strict validation
      logger.warn(`Invalid status '${mappedData.status}' for SKU, defaulting to 'active'`);
      mappedData.status = 'active';
    }
  }
  
  // Ensure status doesn't exceed database column length (typically VARCHAR(20))
  mappedData.status = mappedData.status.substring(0, 20);
  
  // Additional validation for other SKU fields
  if (mappedData.sku_name) {
    mappedData.sku_name = mappedData.sku_name.substring(0, 100);
  }
  
  if (mappedData.sku_code) {
    mappedData.sku_code = mappedData.sku_code.substring(0, 50);
  }
  
  if (mappedData.description) {
    mappedData.description = mappedData.description.substring(0, 500);
  }
  
  // Create the SKU record
  return await Sku.create(mappedData);
}

async function processCategoryRecordMapped(mappedData) {
  if (!mappedData.status) {
    mappedData.status = 'active';
  }
  return await Categories.create(mappedData);
}

async function processPackageRecordMapped(mappedData) {
  return await Package.create(mappedData);
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
      headers: ['Employee ID', 'Address', 'Skills', 'Hourly Rate', 'Department ID', 'Designation ID', 'Joining Date', 'Employment Type', 'Date of Birth', 'Marital Status'],
      sampleData: [
        ['EMP001', '123 Main St', 'JavaScript, Node.js', 25.50, 1, 1, '2024-01-15', 'Full-time', '1990-05-15', 'single'],
        ['EMP002', '456 Oak Ave', 'Python, Django', 30.00, 2, 2, '2024-02-01', 'Part-time', '1985-08-20', 'married']
      ]
    },
    sale_order: {
      headers: ['Client ID', 'Order Number', 'Order Date', 'Delivery Date', 'Total Amount', 'Status', 'Description'],
      sampleData: [
        [1, 'SO001', '2024-06-01', '2024-06-15', 1500.00, 'pending', 'Sample order'],
        [2, 'SO002', '2024-06-02', '2024-06-16', 2500.00, 'confirmed', 'Urgent order']
      ]
    },
    work_order: {
      headers: ['Work Order Number', 'Sales Order ID', 'Start Date', 'End Date', 'Status', 'Priority', 'Description'],
      sampleData: [
        ['WO001', 1, '2024-06-01', '2024-06-10', 'pending', 'high', 'Urgent work order'],
        ['WO002', 2, '2024-06-05', '2024-06-15', 'in_progress', 'medium', 'Standard work order']
      ]
    },
    machine: {
      headers: ['Machine Name', 'Machine Code', 'Machine Type', 'Capacity', 'Location', 'Status', 'Description'],
      sampleData: [
        ['Printing Machine 1', 'PM001', 'Printing', 1000, 'Floor 1', 'active', 'Main printing machine'],
        ['Cutting Machine 1', 'CM001', 'Cutting', 500, 'Floor 2', 'active', 'Primary cutting machine']
      ]
    },
    route: {
      headers: ['Route Name', 'Route Code', 'Description', 'Sequence', 'Status'],
      sampleData: [
        ['Standard Route', 'RT001', 'Standard production route', 1, 'active'],
        ['Express Route', 'RT002', 'Express production route', 2, 'active']
      ]
    },
    client: {
      headers: ['Client Name', 'Email', 'Phone', 'Address', 'City', 'State', 'Country', 'Status'],
      sampleData: [
        ['ABC Corp', 'contact@abc.com', '+1234567890', '123 Business St', 'New York', 'NY', 'USA', 'active'],
        ['XYZ Ltd', 'info@xyz.com', '+1987654321', '456 Trade Ave', 'Los Angeles', 'CA', 'USA', 'active']
      ]
    },
    item: {
      headers: ['Item Name', 'Item Code', 'Category', 'Unit', 'Price', 'Status', 'Description'],
      sampleData: [
        ['Cardboard Sheet', 'ITM001', 'Raw Material', 'Sheets', 5.00, 'active', 'Standard cardboard'],
        ['Printing Ink', 'ITM002', 'Consumables', 'Liters', 25.00, 'active', 'Black printing ink']
      ]
    },
    purchase_order: {
      headers: ['PO Number', 'Supplier Name', 'PO Date', 'Delivery Date', 'Total Amount', 'Status'],
      sampleData: [
        ['PO001', 'Supplier ABC', '2024-06-01', '2024-06-15', 5000.00, 'pending'],
        ['PO002', 'Supplier XYZ', '2024-06-02', '2024-06-16', 7500.00, 'approved']
      ]
    },
    inventory: {
      headers: ['Item ID', 'Quantity', 'Unit Price', 'Location', 'Batch Number', 'Expiry Date'],
      sampleData: [
        [1, 100, 5.00, 'Warehouse A', 'BATCH001', '2025-12-31'],
        [2, 50, 25.00, 'Warehouse B', 'BATCH002', '2024-12-31']
      ]
    },
    sku: {
      headers: ['SKU Name', 'SKU Code', 'Description', 'Price', 'Status'],
      sampleData: [
        ['Box Type A', 'SKU001', 'Small cardboard box', 10.00, 'active'],
        ['Box Type B', 'SKU002', 'Large cardboard box', 15.00, 'active']
      ]
    },
    category: {
      headers: ['Category Name', 'Description', 'Parent ID', 'Status'],
      sampleData: [
        ['Raw Materials', 'All raw materials', null, 'active'],
        ['Finished Goods', 'All finished products', null, 'active']
      ]
    },
    package: {
      headers: ['Package Name', 'Package Code', 'Dimensions', 'Weight', 'Material'],
      sampleData: [
        ['Standard Box', 'PKG001', '10x8x6 inches', 0.5, 'Cardboard'],
        ['Large Box', 'PKG002', '20x16x12 inches', 1.2, 'Corrugated']
      ]
    }
  };

  return templates[moduleName] || null;
}

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
