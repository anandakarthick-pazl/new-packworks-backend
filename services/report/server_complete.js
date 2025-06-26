/**
 * Report Service for PACKWORKX ERP System
 * 
 * IMPORTANT: Fixed database collation error in UNION queries
 * Date: 2025-06-25
 * Issue: "Illegal mix of collations for operation 'UNION'"
 * Solution: Added COLLATE utf8mb4_unicode_ci to all string columns in UNION queries
 * Location: Recent Transactions query section
 * 
 * Updated: Added comprehensive pagination to all API endpoints
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
import QRCode from "qrcode";
import ExcelJS from "exceljs";
import { Readable } from "stream";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import axios from 'axios';
import FormData from "form-data";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

// Import all required models
const {
  Client,
  ClientAddress,
  Company,
  User,
  Machine,
  ProcessName,
  Route,
  SalesOrder,
  WorkOrder,
  Sku,
  SkuType,
  PurchaseOrder,
  PurchaseOrderItem,
  Inventory,
  SalesReturn,
  SalesReturnItem,
  PurchaseOrderReturn,
  PurchaseOrderReturnItem,
  GRN,
  GRNItem,
  PurchaseOrderBilling,
  CreditNote,
  DebitNote,
  stockAdjustment,
  stockAdjustmentItem,
  ItemMaster
} = db;

// =================== PAGINATION UTILITIES ===================
const getPaginationParams = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
};

const formatPaginatedResponse = (data, totalCount, page, limit) => {
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return {
    data,
    pagination: {
      total: totalCount,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null
    }
  };
};

// Utility function to create Excel workbook
const createExcelWorkbook = async (data, sheetName, columns) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  
  // Add headers
  worksheet.addRow(columns.map(col => col.header));
  
  // Style headers
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Add data rows
  data.forEach(row => {
    const rowData = columns.map(col => {
      const value = row[col.key];
      return value instanceof Date ? value.toLocaleDateString() : value;
    });
    worksheet.addRow(rowData);
  });
  
  // Auto-fit columns
  columns.forEach((col, index) => {
    const column = worksheet.getColumn(index + 1);
    column.width = col.width || 15;
  });
  
  return workbook;
};

// Common filter function
const buildDateFilter = (fromDate, toDate, dateField = 'created_at') => {
  const filter = {};
  if (fromDate && toDate) {
    filter[dateField] = {
      [Op.between]: [new Date(fromDate), new Date(toDate)]
    };
  } else if (fromDate) {
    filter[dateField] = {
      [Op.gte]: new Date(fromDate)
    };
  } else if (toDate) {
    filter[dateField] = {
      [Op.lte]: new Date(toDate)
    };
  }
  return filter;
};

// =================== CLIENT REPORTS ===================
v1Router.get("/clients", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, entity_type, customer_type, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    if (!company_id) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate),
      ...(entity_type && { entity_type }),
      ...(customer_type && { customer_type })
    };

    if (isExport === 'excel') {
      const clients = await Client.findAll({
        where: filter,
        include: [
          {
            model: Company,
            attributes: ['name']
          },
          {
            model: User,
            as: 'creator',
            attributes: ['first_name', 'last_name']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const columns = [
        { header: 'Client ID', key: 'client_ref_id', width: 15 },
        { header: 'Display Name', key: 'display_name', width: 20 },
        { header: 'Company Name', key: 'company_name', width: 20 },
        { header: 'Entity Type', key: 'entity_type', width: 15 },
        { header: 'Customer Type', key: 'customer_type', width: 15 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Mobile', key: 'mobile', width: 15 },
        { header: 'GST Number', key: 'gst_number', width: 20 },
        { header: 'Opening Balance', key: 'opening_balance', width: 15 },
        { header: 'Credit Balance', key: 'credit_balance', width: 15 },
        { header: 'Debit Balance', key: 'debit_balance', width: 15 },
        { header: 'Payment Terms', key: 'payment_terms', width: 20 },
        { header: 'Created Date', key: 'created_at', width: 15 },
        { header: 'Status', key: 'status', width: 10 }
      ];

      const workbook = await createExcelWorkbook(clients, 'Clients Report', columns);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="clients_report.xlsx"');
      
      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: clients } = await Client.findAndCountAll({
      where: filter,
      include: [
        {
          model: Company,
          attributes: ['name']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['first_name', 'last_name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    // HTML table data (minimal)
    const htmlData = clients.map(client => ({
      client_ref_id: client.client_ref_id,
      display_name: client.display_name,
      entity_type: client.entity_type,
      email: client.email,
      mobile: client.mobile,
      opening_balance: client.opening_balance,
      status: client.status
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Clients report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching clients report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// =================== VENDOR REPORTS ===================
v1Router.get("/vendors", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      entity_type: 'Vendor',
      status: 'active',
      ...buildDateFilter(fromDate, toDate)
    };

    if (isExport === 'excel') {
      const vendors = await Client.findAll({
        where: filter,
        include: [
          {
            model: Company,
            attributes: ['name']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const columns = [
        { header: 'Vendor ID', key: 'client_ref_id', width: 15 },
        { header: 'Display Name', key: 'display_name', width: 20 },
        { header: 'Company Name', key: 'company_name', width: 20 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Mobile', key: 'mobile', width: 15 },
        { header: 'GST Number', key: 'gst_number', width: 20 },
        { header: 'Opening Balance', key: 'opening_balance', width: 15 },
        { header: 'Payment Terms', key: 'payment_terms', width: 20 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(vendors, 'Vendors Report', columns);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="vendors_report.xlsx"');
      
      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: vendors } = await Client.findAndCountAll({
      where: filter,
      include: [
        {
          model: Company,
          attributes: ['name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const htmlData = vendors.map(vendor => ({
      client_ref_id: vendor.client_ref_id,
      display_name: vendor.display_name,
      email: vendor.email,
      mobile: vendor.mobile,
      opening_balance: vendor.opening_balance
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Vendors report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching vendors report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// =================== DEBIT NOTE REPORTS ===================
v1Router.get("/debit-notes", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, vendor_id, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate),
      ...(vendor_id && { vendor_id })
    };

    if (isExport === 'excel') {
      const debitNotes = await DebitNote.findAll({
        where: filter,
        include: [
          {
            model: Client,
            attributes: ['display_name', 'email']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const columns = [
        { header: 'Debit Note Number', key: 'debit_note_number', width: 20 },
        { header: 'Vendor Name', key: 'vendor_name', width: 20 },
        { header: 'Debit Note Date', key: 'debit_note_date', width: 15 },
        { header: 'Reference', key: 'reference', width: 20 },
        { header: 'Debit Amount', key: 'debit_amount', width: 15 },
        { header: 'Reason', key: 'reason', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(debitNotes, 'Debit Notes Report', columns);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="debit_notes_report.xlsx"');
      
      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: debitNotes } = await DebitNote.findAndCountAll({
      where: filter,
      include: [
        {
          model: Client,
          attributes: ['display_name', 'email']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const htmlData = debitNotes.map(note => ({
      debit_note_number: note.debit_note_number,
      debit_note_date: note.debit_note_date,
      debit_amount: note.debit_amount,
      reason: note.reason,
      status: note.status
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Debit notes report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching debit notes report:", error);
    res.status(500).json({
      message: "Internal Server Error",
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
app.use("/api/report", v1Router);

const PORT = process.env.PORT_REPORT;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Report Service running on port ${PORT}`);
});
