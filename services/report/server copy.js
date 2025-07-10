/**
 * Report Service for PACKWORKX ERP System
 * 
 * IMPORTANT: Fixed database collation error in UNION queries
 * Date: 2025-06-26
 * Fixed: Added pagination to all GET APIs (non-export only)
 * Fixed: Missing pagination utility functions
 * Fixed: File structure and syntax errors
 */

import express, { json, Router } from "express";
import cors from "cors";
// import db from "../../common/models/index.js";
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

// Utility function to handle pagination parameters
const getPaginationParams = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

// Utility function to format paginated response
const formatPaginatedResponse = (data, totalCount, page, limit) => {
  const totalPages = Math.ceil(totalCount / limit);

  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalRecords: totalCount,
      recordsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
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

// =================== SALES ORDER REPORTS ===================
v1Router.get("/sales-orders", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, sales_status, client_id, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate),
      ...(sales_status && { sales_status }),
      ...(client_id && { client_id })
    };

    if (isExport === 'excel') {
      const salesOrders = await SalesOrder.findAll({
        where: filter,
        include: [
          {
            model: Client,
            attributes: ['display_name', 'email']
          },
          {
            model: Company,
            attributes: ['name']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const columns = [
        { header: 'Sales Order ID', key: 'sales_generate_id', width: 20 },
        { header: 'Client', key: 'client', width: 20 },
        { header: 'Estimated Date', key: 'estimated', width: 15 },
        { header: 'Sales Status', key: 'sales_status', width: 15 },
        { header: 'Total Amount', key: 'total_amount', width: 15 },
        { header: 'Total Incl GST', key: 'total_incl_gst', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(salesOrders, 'Sales Orders Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="sales_orders_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: salesOrders } = await SalesOrder.findAndCountAll({
      where: filter,
      include: [
        {
          model: Client,
          attributes: ['display_name', 'email']
        },
        {
          model: Company,
          attributes: ['name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const htmlData = salesOrders.map(order => ({
      sales_generate_id: order.sales_generate_id,
      client: order.client,
      estimated: order.estimated,
      sales_status: order.sales_status,
      total_amount: order.total_amount,
      total_incl_gst: order.total_incl_gst
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Sales orders report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching sales orders report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// =================== PURCHASE ORDER REPORTS ===================
v1Router.get("/purchase-orders", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, vendor_id, po_status, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate),
      ...(vendor_id && { vendor_id }),
      ...(po_status && { po_status })
    };

    if (isExport === 'excel') {
      const purchaseOrders = await PurchaseOrder.findAll({
        where: filter,
        include: [
          {
            model: Client,
            attributes: ['display_name', 'email']
          },
          {
            model: Company,
            attributes: ['name']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const columns = [
        { header: 'PO Number', key: 'po_number', width: 20 },
        { header: 'Vendor', key: 'vendor_name', width: 20 },
        { header: 'PO Date', key: 'po_date', width: 15 },
        { header: 'PO Status', key: 'po_status', width: 15 },
        { header: 'Total Amount', key: 'total_amount', width: 15 },
        { header: 'Total Incl GST', key: 'total_incl_gst', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(purchaseOrders, 'Purchase Orders Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="purchase_orders_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: purchaseOrders } = await PurchaseOrder.findAndCountAll({
      where: filter,
      include: [
        {
          model: Client,
          attributes: ['display_name', 'email']
        },
        {
          model: Company,
          attributes: ['name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const htmlData = purchaseOrders.map(po => ({
      po_number: po.po_number,
      vendor_name: po.vendor_name,
      po_date: po.po_date,
      po_status: po.po_status,
      total_amount: po.total_amount,
      total_incl_gst: po.total_incl_gst
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Purchase orders report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching purchase orders report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// =================== MACHINE REPORTS ===================
v1Router.get("/machines", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, machine_type, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate),
      ...(machine_type && { machine_type })
    };

    if (isExport === 'excel') {
      const machines = await Machine.findAll({
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
        { header: 'Machine ID', key: 'machine_id', width: 15 },
        { header: 'Machine Name', key: 'machine_name', width: 20 },
        { header: 'Machine Type', key: 'machine_type', width: 15 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(machines, 'Machines Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="machines_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: machines } = await Machine.findAndCountAll({
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

    const htmlData = machines.map(machine => ({
      machine_id: machine.machine_id,
      machine_name: machine.machine_name,
      machine_type: machine.machine_type,
      status: machine.status
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Machines report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching machines report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// =================== PROCESS REPORTS ===================
v1Router.get("/processes", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate)
    };

    if (isExport === 'excel') {
      const processes = await ProcessName.findAll({
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
        { header: 'Process ID', key: 'id', width: 15 },
        { header: 'Process Name', key: 'process_name', width: 20 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(processes, 'Processes Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="processes_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: processes } = await ProcessName.findAndCountAll({
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

    const htmlData = processes.map(process => ({
      id: process.id,
      process_name: process.process_name,
      description: process.description,
      status: process.status
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Processes report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching processes report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// =================== ROUTES REPORTS ===================
v1Router.get("/routes", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate)
    };

    if (isExport === 'excel') {
      const routes = await Route.findAll({
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
        { header: 'Route ID', key: 'id', width: 15 },
        { header: 'Route Name', key: 'route_name', width: 20 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(routes, 'Routes Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="routes_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: routes } = await Route.findAndCountAll({
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

    const htmlData = routes.map(route => ({
      id: route.id,
      route_name: route.route_name,
      description: route.description,
      status: route.status
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Routes report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching routes report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// =================== WORK ORDER REPORTS ===================
v1Router.get("/work-orders", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, status_wo, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate),
      ...(status_wo && { status_wo })
    };

    if (isExport === 'excel') {
      const workOrders = await WorkOrder.findAll({
        where: filter,
        include: [
          {
            model: SalesOrder,
            attributes: ['sales_generate_id', 'client']
          },
          {
            model: Company,
            attributes: ['name']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const columns = [
        { header: 'Work Order ID', key: 'work_order_generate_id', width: 20 },
        { header: 'Sales Order ID', key: 'sales_order_id', width: 20 },
        { header: 'Work Order Date', key: 'work_order_date', width: 15 },
        { header: 'Status', key: 'status_wo', width: 15 },
        { header: 'Priority', key: 'priority', width: 10 },
        { header: 'Expected Completion', key: 'expected_completion_date', width: 20 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(workOrders, 'Work Orders Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="work_orders_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: workOrders } = await WorkOrder.findAndCountAll({
      where: filter,
      include: [
        {
          model: SalesOrder,
          attributes: ['sales_generate_id', 'client']
        },
        {
          model: Company,
          attributes: ['name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const htmlData = workOrders.map(order => ({
      work_order_generate_id: order.work_order_generate_id,
      work_order_date: order.work_order_date,
      status_wo: order.status_wo,
      priority: order.priority,
      expected_completion_date: order.expected_completion_date
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Work orders report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching work orders report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// =================== SKU DETAILS REPORTS ===================
v1Router.get("/sku-details", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, sku_type_id, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate),
      ...(sku_type_id && { sku_type_id })
    };

    if (isExport === 'excel') {
      const skuDetails = await Sku.findAll({
        where: filter,
        include: [
          {
            model: SkuType,
            attributes: ['sku_type_name']
          },
          {
            model: Company,
            attributes: ['name']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const columns = [
        { header: 'SKU ID', key: 'sku_id', width: 15 },
        { header: 'SKU Name', key: 'sku_name', width: 20 },
        { header: 'SKU Type', key: 'sku_type_name', width: 15 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Unit Price', key: 'unit_price', width: 15 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(skuDetails, 'SKU Details Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="sku_details_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: skuDetails } = await Sku.findAndCountAll({
      where: filter,
      include: [
        {
          model: SkuType,
          attributes: ['sku_type_name']
        },
        {
          model: Company,
          attributes: ['name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const htmlData = skuDetails.map(sku => ({
      sku_id: sku.sku_id,
      sku_name: sku.sku_name,
      description: sku.description,
      unit_price: sku.unit_price,
      status: sku.status
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "SKU details report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching SKU details report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});


v1Router.get("/inventory", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, item_id, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate),
      ...(item_id && { item_id })
    };

    if (isExport === 'excel') {
      const inventory = await Inventory.findAll({
        where: filter,
        include: [
          {
            model: ItemMaster,
            attributes: ['item_name', 'item_code']
          },
          {
            model: Company,
            attributes: ['name']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const columns = [
        { header: 'Item Code', key: 'item_code', width: 15 },
        { header: 'Item Name', key: 'item_name', width: 20 },
        { header: 'Available Qty', key: 'available_qty', width: 15 },
        { header: 'Total Qty', key: 'total_qty', width: 15 },
        { header: 'Unit Price', key: 'unit_price', width: 15 },
        { header: 'Location', key: 'location', width: 20 },
        { header: 'Last Updated', key: 'updated_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(inventory, 'Inventory Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: inventory } = await Inventory.findAndCountAll({
      where: filter,
      include: [
        {
          model: ItemMaster,
          attributes: ['item_name', 'item_code']
        },
        {
          model: Company,
          attributes: ['name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const htmlData = inventory.map(item => ({
      item_code: item.item_code,
      item_name: item.item_name,
      available_qty: item.available_qty,
      total_qty: item.total_qty,
      unit_price: item.unit_price,
      location: item.location
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Inventory report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching inventory report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});
// =================== SALES RETURN REPORTS ===================
v1Router.get("/sales-returns", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, client_id, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate),
      ...(client_id && { client_id })
    };

    if (isExport === 'excel') {
      const salesReturns = await SalesReturn.findAll({
        where: filter,
        include: [
          {
            model: Client,
            attributes: ['display_name', 'email']
          },
          {
            model: SalesOrder,
            attributes: ['sales_generate_id']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const columns = [
        { header: 'Return ID', key: 'return_id', width: 20 },
        { header: 'Sales Order ID', key: 'sales_order_id', width: 20 },
        { header: 'Client Name', key: 'client_name', width: 20 },
        { header: 'Return Date', key: 'return_date', width: 15 },
        { header: 'Return Reason', key: 'return_reason', width: 25 },
        { header: 'Return Amount', key: 'return_amount', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(salesReturns, 'Sales Returns Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="sales_returns_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: salesReturns } = await SalesReturn.findAndCountAll({
      where: filter,
      include: [
        {
          model: Client,
          attributes: ['display_name', 'email']
        },
        {
          model: SalesOrder,
          attributes: ['sales_generate_id']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const htmlData = salesReturns.map(ret => ({
      return_id: ret.return_id,
      return_date: ret.return_date,
      return_reason: ret.return_reason,
      return_amount: ret.return_amount,
      status: ret.status
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Sales returns report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching sales returns report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// =================== GRN REPORTS ===================
v1Router.get("/grn", authenticateJWT, async (req, res) => {
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
      const grns = await GRN.findAll({
        where: filter,
        include: [
          {
            model: Client,
            attributes: ['display_name', 'email']
          },
          {
            model: PurchaseOrder,
            attributes: ['po_number']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const columns = [
        { header: 'GRN Number', key: 'grn_number', width: 20 },
        { header: 'PO Number', key: 'po_number', width: 20 },
        { header: 'Vendor Name', key: 'vendor_name', width: 20 },
        { header: 'GRN Date', key: 'grn_date', width: 15 },
        { header: 'Received Qty', key: 'received_qty', width: 15 },
        { header: 'Total Amount', key: 'total_amount', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(grns, 'GRN Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="grn_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: grns } = await GRN.findAndCountAll({
      where: filter,
      include: [
        {
          model: Client,
          attributes: ['display_name', 'email']
        },
        {
          model: PurchaseOrder,
          attributes: ['po_number']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const htmlData = grns.map(grn => ({
      grn_number: grn.grn_number,
      grn_date: grn.grn_date,
      received_qty: grn.received_qty,
      total_amount: grn.total_amount,
      status: grn.status
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "GRN report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching GRN report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// =================== CREDIT NOTE REPORTS ===================
v1Router.get("/credit-notes", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, client_id, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate),
      ...(client_id && { client_id })
    };

    if (isExport === 'excel') {
      const creditNotes = await CreditNote.findAll({
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
        { header: 'Credit Note Number', key: 'credit_note_number', width: 20 },
        { header: 'Client Name', key: 'client_name', width: 20 },
        { header: 'Credit Note Date', key: 'credit_note_date', width: 15 },
        { header: 'Reference', key: 'reference', width: 20 },
        { header: 'Credit Amount', key: 'credit_amount', width: 15 },
        { header: 'Reason', key: 'reason', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(creditNotes, 'Credit Notes Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="credit_notes_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: creditNotes } = await CreditNote.findAndCountAll({
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

    const htmlData = creditNotes.map(note => ({
      credit_note_number: note.credit_note_number,
      credit_note_date: note.credit_note_date,
      credit_amount: note.credit_amount,
      reason: note.reason,
      status: note.status
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Credit notes report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching credit notes report:", error);
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

// =================== STOCK ADJUSTMENTS REPORTS ===================
v1Router.get("/stock-adjustments", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, adjustment_type, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate),
      ...(adjustment_type && { adjustment_type })
    };

    if (isExport === 'excel') {
      const stockAdjustments = await stockAdjustment.findAll({
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
        { header: 'Adjustment ID', key: 'adjustment_id', width: 20 },
        { header: 'Adjustment Date', key: 'adjustment_date', width: 15 },
        { header: 'Adjustment Type', key: 'adjustment_type', width: 15 },
        { header: 'Reference', key: 'reference', width: 20 },
        { header: 'Reason', key: 'reason', width: 25 },
        { header: 'Total Adjustment Value', key: 'total_adjustment_value', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(stockAdjustments, 'Stock Adjustments Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="stock_adjustments_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: stockAdjustments } = await stockAdjustment.findAndCountAll({
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

    const htmlData = stockAdjustments.map(adj => ({
      adjustment_id: adj.adjustment_id,
      adjustment_date: adj.adjustment_date,
      adjustment_type: adj.adjustment_type,
      reason: adj.reason,
      total_adjustment_value: adj.total_adjustment_value,
      status: adj.status
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Stock adjustments report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching stock adjustments report:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// =================== PRODUCTS REPORTS ===================
v1Router.get("/products", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, item_id, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const filter = {
      company_id,
      status: 'active',
      ...buildDateFilter(fromDate, toDate),
      ...(item_id && { item_id })
    };

    if (isExport === 'excel') {
      const products = await ItemMaster.findAll({
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
        { header: 'Item Code', key: 'item_code', width: 15 },
        { header: 'Item Name', key: 'item_name', width: 20 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Purchase Rate', key: 'purchase_rate', width: 15 },
        { header: 'Selling Rate', key: 'selling_rate', width: 15 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(products, 'Products Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="products_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    const { count: totalCount, rows: products } = await ItemMaster.findAndCountAll({
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

    const htmlData = products.map(product => ({
      item_code: product.item_code,
      item_name: product.item_name,
      category: product.category,
      unit: product.unit,
      purchase_rate: product.purchase_rate,
      selling_rate: product.selling_rate,
      status: product.status
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);

    res.status(200).json({
      success: true,
      message: "Products report retrieved successfully",
      ...response
    });

  } catch (error) {
    logger.error("Error fetching products report:", error);
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
