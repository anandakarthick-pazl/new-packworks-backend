/**
 * Report Service for PACKWORKX ERP System
 * 
 * IMPORTANT: Converted from ORM to Sequelize Raw Queries
 * Date: 2025-06-27
 * Features: Raw MySQL queries with pagination and Excel export using existing Sequelize
 */

import express, { json, Router } from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import sequelize from "../../common/database/database.js";
import { QueryTypes } from "sequelize";
import { authenticateJWT } from "../../common/middleware/auth.js";
// import { generateId } from "../../common/inputvalidation/generateId.js";
// import QRCode from "qrcode";
import ExcelJS from "exceljs";
// import { Readable } from "stream";
// import path from "path";
// import { fileURLToPath } from "url";
// import fs from "fs";
// import axios from 'axios';
// import FormData from "form-data";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

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

// Utility function to execute raw queries with Sequelize
const executeQuery = async (query, replacements = []) => {
  return await sequelize.query(query, {
    replacements,
    type: QueryTypes.SELECT
  });
};

// Utility function to get count from query result
const getCountFromResult = (result) => {
  return result[0]?.total || 0;
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
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      if (col.key === 'estimated' && value) {
        const date = new Date(value);
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
      }
      return value;
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

// Common filter function for date ranges
const buildDateFilter = (fromDate, toDate, dateField = 'created_at') => {
  const conditions = [];
  const params = [];

  if (fromDate && toDate) {
    conditions.push(`${dateField} BETWEEN ? AND ?`);
    params.push(fromDate, toDate);
  } else if (fromDate) {
    conditions.push(`${dateField} >= ?`);
    params.push(fromDate);
  } else if (toDate) {
    conditions.push(`${dateField} <= ?`);
    params.push(toDate);
  }

  return { conditions, params };
};

// Common search filter function
const buildSearchFilter = (search, searchFields) => {
  if (!search || !search.trim()) {
    return { conditions: [], params: [] };
  }

  const searchTerm = `%${search.trim()}%`;
  const conditions = searchFields.map(field => `${field} LIKE ?`);
  const params = new Array(searchFields.length).fill(searchTerm);

  return {
    conditions: [`(${conditions.join(' OR ')})`],
    params
  };
};

// =================== CLIENT REPORTS ===================
v1Router.get("/clients", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, entity_type, customer_type, status, search, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    if (!company_id) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    // Build WHERE conditions
    const whereConditions = ['c.company_id = ?'];
    const queryParams = [company_id];

    // Add filters
    if (entity_type) {
      whereConditions.push('c.entity_type = ?');
      queryParams.push(entity_type);
    }
    if (customer_type) {
      whereConditions.push('c.customer_type = ?');
      queryParams.push(customer_type);
    }
    if (status) {
      whereConditions.push('c.status = ?');
      queryParams.push(status);
    }

    // Date filter
    const dateFilter = buildDateFilter(fromDate, toDate, 'c.created_at');
    whereConditions.push(...dateFilter.conditions);
    queryParams.push(...dateFilter.params);

    // Search filter
    const searchFilter = buildSearchFilter(search, [
      'c.display_name', 'c.email', 'c.mobile', 'c.client_ref_id', 'c.gst_number'
    ]);
    whereConditions.push(...searchFilter.conditions);
    queryParams.push(...searchFilter.params);

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Base query
    const baseQuery = `
      SELECT 
        c.*,
        comp.company_name,
        u.name as creator_name
      FROM clients c
      LEFT JOIN companies comp ON c.company_id = comp.id
      LEFT JOIN users u ON c.created_by = u.id
      ${whereClause}
      ORDER BY c.created_at DESC
    `;

    // Export to Excel
    if (isExport === 'excel') {
      const clients = await sequelize.query(baseQuery, {
        replacements: queryParams,
        type: QueryTypes.SELECT
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

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM clients c
      LEFT JOIN companies comp ON c.company_id = comp.id
      LEFT JOIN users u ON c.created_by = u.id
      ${whereClause}
    `;

    const [countResult] = await sequelize.query(countQuery, {
      replacements: queryParams,
      type: QueryTypes.SELECT
    });
    const totalCount = countResult.total;

    // Paginated query
    const paginatedQuery = `${baseQuery} LIMIT ? OFFSET ?`;
    const clients = await sequelize.query(paginatedQuery, {
      replacements: [...queryParams, limit, offset],
      type: QueryTypes.SELECT
    });

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

// =================== SALES ORDER REPORTS ===================
v1Router.get("/sales-orders", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, sales_status, client_id, search, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    // Build WHERE conditions
    const whereConditions = ['so.company_id = ?', 'so.status = ?'];
    const queryParams = [company_id, 'active'];

    // Add filters
    if (sales_status) {
      whereConditions.push('so.sales_status = ?');
      queryParams.push(sales_status);
    }
    if (client_id) {
      whereConditions.push('so.client_id = ?');
      queryParams.push(client_id);
    }

    // Date filter
    const dateFilter = buildDateFilter(fromDate, toDate, 'so.created_at');
    whereConditions.push(...dateFilter.conditions);
    queryParams.push(...dateFilter.params);

    // Search filter
    const searchFilter = buildSearchFilter(search, [
      'so.sales_generate_id', 'so.estimated', 'ssd.sku_name', 'c.display_name', 'c.email'
    ]);
    whereConditions.push(...searchFilter.conditions);
    queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Base query with date formatting for estimated field
    const baseQuery = `
      SELECT 
        so.*,
        c.display_name as client_name,
        c.email as client_email,
        comp.company_name,
        DATE_FORMAT(so.estimated, '%d/%m/%Y') as estimated_formatted,
        ssd.sku
      FROM sales_order so
      LEFT JOIN sales_sku_details ssd ON so.id = ssd.sales_order_id
      LEFT JOIN clients c ON so.client_id = c.client_id
      LEFT JOIN companies comp ON so.company_id = comp.id
      ${whereClause}
      ORDER BY so.created_at DESC
    `;

    if (isExport === 'excel') {
      const salesOrders = await sequelize.query(baseQuery, {
        replacements: queryParams,
        type: QueryTypes.SELECT
      });

      const columns = [
        { header: 'Sales Order ID', key: 'sales_generate_id', width: 20 },
        { header: 'Client', key: 'client_name', width: 20 },
        { header: 'SKU Name', key: 'sku', width: 20 },
        { header: 'Estimated Date', key: 'estimated_formatted', width: 15 },
        { header: 'Sales Status', key: 'sales_status', width: 15 },
        { header: 'Total Amount', key: 'total_amount', width: 15 },
        { header: 'Total Incl GST', key: 'total_incl_gst', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ];

      const workbook = await createExcelWorkbook(salesOrders, 'Sales Orders Report', columns);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="sales_order_report.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sales_order so
      LEFT JOIN clients c ON so.client_id = c.client_id
      LEFT JOIN companies comp ON so.company_id = comp.id
      LEFT JOIN sales_sku_details ssd ON so.id = ssd.sales_order_id
      ${whereClause}
    `;

    const [countResult] = await sequelize.query(countQuery, {
      replacements: queryParams,
      type: QueryTypes.SELECT
    });
    const totalCount = countResult.total;

    // Paginated query
    const paginatedQuery = `${baseQuery} LIMIT ? OFFSET ?`;
    const salesOrders = await sequelize.query(paginatedQuery, {
      replacements: [...queryParams, limit, offset],
      type: QueryTypes.SELECT
    });

    const htmlData = salesOrders.map(order => ({
      sales_generate_id: order.sales_generate_id,
      client: order.client_name,
      sku_name: order.sku,
      estimated: order.estimated_formatted,
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
    const { fromDate, toDate, vendor_id, po_status, search, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['po.company_id = ?', 'po.status = ?'];
    const queryParams = [company_id, 'active'];

    if (vendor_id) {
      whereConditions.push('po.supplier_id = ?');
      queryParams.push(vendor_id);
    }
    if (po_status) {
      whereConditions.push('po.po_status = ?');
      queryParams.push(po_status);
    }

    const dateFilter = buildDateFilter(fromDate, toDate, 'po.created_at');
    whereConditions.push(...dateFilter.conditions);
    queryParams.push(...dateFilter.params);

    const searchFilter = buildSearchFilter(search, [
      'po.po_number', 'po.vendor_name', 'po.po_status', 'po.reference'
    ]);
    whereConditions.push(...searchFilter.conditions);
    queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const baseQuery = `
      SELECT 
        po.*,
        c.display_name as vendor_display_name,
        c.email as vendor_email,
        comp.company_name,
        DATE_FORMAT(po.po_date, '%d/%m/%Y') as po_date_formatted
      FROM purchase_orders po
      LEFT JOIN clients c ON po.supplier_id = c.client_id
      LEFT JOIN companies comp ON po.company_id = comp.id
      ${whereClause}
      ORDER BY po.created_at DESC
    `;

    if (isExport === 'excel') {
      const purchaseOrders = await sequelize.query(baseQuery, {
        replacements: queryParams,
        type: QueryTypes.SELECT
      });

      const columns = [
        { header: 'PO Number', key: 'po_number', width: 20 },
        { header: 'Vendor', key: 'vendor_name', width: 20 },
        { header: 'PO Date', key: 'po_date_formatted', width: 15 },
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

    const countQuery = `SELECT COUNT(*) as total FROM purchase_orders po LEFT JOIN clients c ON po.supplier_id = c.client_id LEFT JOIN companies comp ON po.company_id = comp.id ${whereClause}`;
    const [countResult] = await sequelize.query(countQuery, { replacements: queryParams, type: QueryTypes.SELECT });
    const totalCount = countResult.total;

    const paginatedQuery = `${baseQuery} LIMIT ? OFFSET ?`;
    const purchaseOrders = await sequelize.query(paginatedQuery, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = purchaseOrders.map(po => ({
      po_number: po.po_number,
      vendor_name: po.vendor_name,
      po_date: po.po_date_formatted,
      po_status: po.po_status,
      total_amount: po.total_amount,
      total_incl_gst: po.total_incl_gst
    }));

    const response = formatPaginatedResponse(htmlData, totalCount, page, limit);
    res.status(200).json({ success: true, message: "Purchase orders report retrieved successfully", ...response });

  } catch (error) {
    logger.error("Error fetching purchase orders report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// =================== MACHINE REPORTS ===================
v1Router.get("/machines", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, machine_type, search, status, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['m.company_id = ?'];
    const queryParams = [company_id];

    if (machine_type) {
      whereConditions.push('m.machine_type = ?');
      queryParams.push(machine_type);
    }
    if (status) {
      whereConditions.push('m.status = ?');
      queryParams.push(status);
    }

    const dateFilter = buildDateFilter(fromDate, toDate, 'm.created_at');
    whereConditions.push(...dateFilter.conditions);
    queryParams.push(...dateFilter.params);

    const searchFilter = buildSearchFilter(search, ['m.machine_generate_id', 'm.machine_name', 'm.machine_type', 'm.model_number', 'm.serial_number', 'm.manufacturer']);
    whereConditions.push(...searchFilter.conditions);
    queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const baseQuery = `SELECT m.*, comp.company_name FROM machines m LEFT JOIN companies comp ON m.company_id = comp.id ${whereClause} ORDER BY m.created_at DESC`;

    if (isExport === 'excel') {
      const machines = await sequelize.query(baseQuery, { replacements: queryParams, type: QueryTypes.SELECT });
      const columns = [
        { header: 'Machine ID', key: 'machine_generate_id', width: 15 },
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

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM machines m LEFT JOIN companies comp ON m.company_id = comp.id ${whereClause}`, { replacements: queryParams, type: QueryTypes.SELECT });
    const totalCount = countResult.total;

    const machines = await sequelize.query(`${baseQuery} LIMIT ? OFFSET ?`, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = machines.map(machine => ({
      machine_id: machine.machine_generate_id,
      machine_name: machine.machine_name,
      machine_type: machine.machine_type,
      status: machine.status
    }));

    res.status(200).json({ success: true, message: "Machines report retrieved successfully", ...formatPaginatedResponse(htmlData, totalCount, page, limit) });

  } catch (error) {
    logger.error("Error fetching machines report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// =================== PROCESSES REPORTS ===================
v1Router.get("/processes", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, search, status, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['p.company_id = ?'];
    const queryParams = [company_id];

    if (status) { whereConditions.push('p.status = ?'); queryParams.push(status); }
    const dateFilter = buildDateFilter(fromDate, toDate, 'p.created_at');
    whereConditions.push(...dateFilter.conditions); queryParams.push(...dateFilter.params);
    const searchFilter = buildSearchFilter(search, ['p.process_name']);
    whereConditions.push(...searchFilter.conditions); queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const baseQuery = `SELECT p.*, comp.company_name FROM process_name p LEFT JOIN companies comp ON p.company_id = comp.id ${whereClause} ORDER BY p.created_at DESC`;

    if (isExport === 'excel') {
      const processes = await sequelize.query(baseQuery, { replacements: queryParams, type: QueryTypes.SELECT });
      const workbook = await createExcelWorkbook(processes, 'Processes Report', [
        { header: 'Process ID', key: 'id', width: 15 },
        { header: 'Process Name', key: 'process_name', width: 20 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="processes_report.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM process_name p LEFT JOIN companies comp ON p.company_id = comp.id ${whereClause}`, { replacements: queryParams, type: QueryTypes.SELECT });
    const processes = await sequelize.query(`${baseQuery} LIMIT ? OFFSET ?`, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = processes.map(process => ({ id: process.id, process_name: process.process_name, status: process.status }));
    res.status(200).json({ success: true, message: "Processes report retrieved successfully", ...formatPaginatedResponse(htmlData, countResult.total, page, limit) });

  } catch (error) {
    logger.error("Error fetching processes report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// =================== ROUTES REPORTS ===================
v1Router.get("/routes", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, search, status, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['r.company_id = ?'];
    const queryParams = [company_id];

    if (status) { whereConditions.push('r.status = ?'); queryParams.push(status); }
    const dateFilter = buildDateFilter(fromDate, toDate, 'r.created_at');
    whereConditions.push(...dateFilter.conditions); queryParams.push(...dateFilter.params);
    const searchFilter = buildSearchFilter(search, ['r.route_name']);
    whereConditions.push(...searchFilter.conditions); queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const baseQuery = `SELECT r.*, comp.company_name FROM route r LEFT JOIN companies comp ON r.company_id = comp.id ${whereClause} ORDER BY r.created_at DESC`;

    if (isExport === 'excel') {
      const routes = await sequelize.query(baseQuery, { replacements: queryParams, type: QueryTypes.SELECT });
      const workbook = await createExcelWorkbook(routes, 'Routes Report', [
        { header: 'Route ID', key: 'id', width: 15 },
        { header: 'Route Name', key: 'route_name', width: 20 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="routes_report.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM route r LEFT JOIN companies comp ON r.company_id = comp.id ${whereClause}`, { replacements: queryParams, type: QueryTypes.SELECT });
    const routes = await sequelize.query(`${baseQuery} LIMIT ? OFFSET ?`, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = routes.map(route => ({ id: route.id, route_name: route.route_name, status: route.status }));
    res.status(200).json({ success: true, message: "Routes report retrieved successfully", ...formatPaginatedResponse(htmlData, countResult.total, page, limit) });

  } catch (error) {
    logger.error("Error fetching routes report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// =================== WORK ORDER REPORTS ===================
v1Router.get("/work-orders", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, status_wo, search, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['wo.company_id = ?', 'wo.status = ?'];
    const queryParams = [company_id, 'active'];

    if (status_wo) { whereConditions.push('wo.status_wo = ?'); queryParams.push(status_wo); }
    const dateFilter = buildDateFilter(fromDate, toDate, 'wo.created_at');
    whereConditions.push(...dateFilter.conditions); queryParams.push(...dateFilter.params);
    const searchFilter = buildSearchFilter(search, ['wo.work_order_generate_id', 'wo.status_wo', 'wo.priority']);
    whereConditions.push(...searchFilter.conditions); queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const baseQuery = `
      SELECT wo.*, so.sales_generate_id, so.client as sales_order_client, comp.company_name,
             DATE_FORMAT(wo.created_at, '%d/%m/%Y') as work_order_date_formatted,
             DATE_FORMAT(wo.edd, '%d/%m/%Y') as expected_completion_formatted
      FROM work_order wo
      LEFT JOIN sales_order so ON wo.sales_order_id = so.id
      LEFT JOIN companies comp ON wo.company_id = comp.id
      ${whereClause} ORDER BY wo.created_at DESC
    `;

    if (isExport === 'excel') {
      const workOrders = await sequelize.query(baseQuery, { replacements: queryParams, type: QueryTypes.SELECT });
      const workbook = await createExcelWorkbook(workOrders, 'Work Orders Report', [
        { header: 'Work Order ID', key: 'work_order_generate_id', width: 20 },
        { header: 'Sales Order ID', key: 'sales_generate_id', width: 20 },
        { header: 'Work Order Date', key: 'work_order_date_formatted', width: 15 },
        { header: 'Status', key: 'status_wo', width: 15 },
        { header: 'Priority', key: 'priority', width: 10 },
        { header: 'Expected Completion', key: 'expected_completion_formatted', width: 20 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="work_orders_report.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM work_order wo LEFT JOIN sales_order so ON wo.sales_order_id = so.id LEFT JOIN companies comp ON wo.company_id = comp.id ${whereClause}`, { replacements: queryParams, type: QueryTypes.SELECT });
    const workOrders = await sequelize.query(`${baseQuery} LIMIT ? OFFSET ?`, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = workOrders.map(order => ({
      work_order_generate_id: order.work_order_generate_id,
      work_order_date: order.work_order_date_formatted,
      status_wo: order.status_wo,
      priority: order.priority,
      expected_completion_date: order.expected_completion_formatted
    }));

    res.status(200).json({ success: true, message: "Work orders report retrieved successfully", ...formatPaginatedResponse(htmlData, countResult.total, page, limit) });

  } catch (error) {
    logger.error("Error fetching work orders report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// =================== SKU DETAILS REPORTS ===================
v1Router.get("/sku-details", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, sku_type_id, search, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['s.company_id = ?', 's.status = ?'];
    const queryParams = [company_id, 'active'];

    if (sku_type_id) { whereConditions.push('s.sku_type = ?'); queryParams.push(sku_type_id); }
    const dateFilter = buildDateFilter(fromDate, toDate, 's.created_at');
    whereConditions.push(...dateFilter.conditions); queryParams.push(...dateFilter.params);
    const searchFilter = buildSearchFilter(search, ['s.sku_id', 's.sku_name', 's.description']);
    whereConditions.push(...searchFilter.conditions); queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const baseQuery = `SELECT s.*, st.sku_type AS sku_type_name, comp.company_name FROM sku s LEFT JOIN sku_type st ON s.sku_type = st.id LEFT JOIN companies comp ON s.company_id = comp.id ${whereClause} ORDER BY s.created_at DESC`;

    if (isExport === 'excel') {
      const skuDetails = await sequelize.query(baseQuery, { replacements: queryParams, type: QueryTypes.SELECT });
      const workbook = await createExcelWorkbook(skuDetails, 'SKU Details Report', [
        { header: 'SKU ID', key: 'sku_id', width: 15 },
        { header: 'SKU Name', key: 'sku_name', width: 20 },
        { header: 'SKU Type', key: 'sku_type_name', width: 15 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Unit Price', key: 'unit_price', width: 15 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="sku_details_report.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM sku s LEFT JOIN sku_type st ON s.sku_type = st.id LEFT JOIN companies comp ON s.company_id = comp.id ${whereClause}`, { replacements: queryParams, type: QueryTypes.SELECT });
    const skuDetails = await sequelize.query(`${baseQuery} LIMIT ? OFFSET ?`, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = skuDetails.map(sku => ({ sku_id: sku.sku_id, sku_name: sku.sku_name, description: sku.description, unit_price: sku.unit_price, status: sku.status }));
    res.status(200).json({ success: true, message: "SKU details report retrieved successfully", ...formatPaginatedResponse(htmlData, countResult.total, page, limit) });

  } catch (error) {
    logger.error("Error fetching SKU details report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// =================== INVENTORY REPORTS ===================
v1Router.get("/inventory", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, item_id, search, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['i.company_id = ?', 'i.status = ?'];
    const queryParams = [company_id, 'active'];

    if (item_id) { whereConditions.push('i.item_id = ?'); queryParams.push(item_id); }
    const dateFilter = buildDateFilter(fromDate, toDate, 'i.created_at');
    whereConditions.push(...dateFilter.conditions); queryParams.push(...dateFilter.params);
    const searchFilter = buildSearchFilter(search, ['i.location']);
    whereConditions.push(...searchFilter.conditions); queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const baseQuery = `SELECT i.*, im.item_name, im.item_code, comp.company_name FROM inventory i LEFT JOIN item_master im ON i.item_id = im.id LEFT JOIN companies comp ON i.company_id = comp.id ${whereClause} ORDER BY i.created_at DESC`;

    if (isExport === 'excel') {
      const inventory = await sequelize.query(baseQuery, { replacements: queryParams, type: QueryTypes.SELECT });
      const workbook = await createExcelWorkbook(inventory, 'Inventory Report', [
        { header: 'Item Code', key: 'item_code', width: 15 },
        { header: 'Item Name', key: 'item_name', width: 20 },
        { header: 'Available Qty', key: 'available_qty', width: 15 },
        { header: 'Total Qty', key: 'total_qty', width: 15 },
        { header: 'Unit Price', key: 'unit_price', width: 15 },
        { header: 'Location', key: 'location', width: 20 },
        { header: 'Last Updated', key: 'updated_at', width: 15 }
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory_report.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM inventory i LEFT JOIN item_master im ON i.item_id = im.id LEFT JOIN companies comp ON i.company_id = comp.id ${whereClause}`, { replacements: queryParams, type: QueryTypes.SELECT });
    const inventory = await sequelize.query(`${baseQuery} LIMIT ? OFFSET ?`, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = inventory.map(item => ({
      item_code: item.item_code,
      item_name: item.item_name,
      available_qty: item.available_qty,
      total_qty: item.total_qty,
      unit_price: item.unit_price,
      location: item.location
    }));

    res.status(200).json({ success: true, message: "Inventory report retrieved successfully", ...formatPaginatedResponse(htmlData, countResult.total, page, limit) });

  } catch (error) {
    logger.error("Error fetching inventory report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// =================== SALES RETURN REPORTS ===================
v1Router.get("/sales-returns", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, client_id, search, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['sr.company_id = ?'];
    const queryParams = [company_id];

    if (client_id) { whereConditions.push('sr.client_id = ?'); queryParams.push(client_id); }
    const dateFilter = buildDateFilter(fromDate, toDate, 'sr.created_at');
    whereConditions.push(...dateFilter.conditions); queryParams.push(...dateFilter.params);
    const searchFilter = buildSearchFilter(search, ['sr.return_id', 'sr.return_reason']);
    whereConditions.push(...searchFilter.conditions); queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const baseQuery = `
      SELECT sr.*, c.display_name as client_name, c.email as client_email, so.sales_generate_id,
             DATE_FORMAT(sr.return_date, '%d/%m/%Y') as return_date_formatted
      FROM sales_returns sr
      LEFT JOIN clients c ON sr.client_id = c.client_id
      LEFT JOIN sales_order so ON sr.sales_id = so.id
      ${whereClause} ORDER BY sr.created_at DESC
    `;

    if (isExport === 'excel') {
      const salesReturns = await sequelize.query(baseQuery, { replacements: queryParams, type: QueryTypes.SELECT });
      const workbook = await createExcelWorkbook(salesReturns, 'Sales Returns Report', [
        { header: 'Return ID', key: 'return_id', width: 20 },
        { header: 'Sales Order ID', key: 'sales_generate_id', width: 20 },
        { header: 'Client Name', key: 'client_name', width: 20 },
        { header: 'Return Date', key: 'return_date_formatted', width: 15 },
        { header: 'Return Reason', key: 'return_reason', width: 25 },
        { header: 'Return Amount', key: 'return_amount', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="sales_returns_report.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM sales_returns sr LEFT JOIN clients c ON sr.client_id = c.client_id LEFT JOIN sales_order so ON sr.sales_id = so.id ${whereClause}`, { replacements: queryParams, type: QueryTypes.SELECT });
    const salesReturns = await sequelize.query(`${baseQuery} LIMIT ? OFFSET ?`, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = salesReturns.map(ret => ({
      return_id: ret.return_id,
      return_date: ret.return_date_formatted,
      return_reason: ret.return_reason,
      return_amount: ret.return_amount,
      status: ret.status
    }));

    res.status(200).json({ success: true, message: "Sales returns report retrieved successfully", ...formatPaginatedResponse(htmlData, countResult.total, page, limit) });

  } catch (error) {
    logger.error("Error fetching sales returns report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// =================== GRN REPORTS ===================
v1Router.get("/grn", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, vendor_id, search, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['g.company_id = ?', 'g.status = ?'];
    const queryParams = [company_id, 'active'];

    // if (vendor_id) { whereConditions.push('g.vendor_id = ?'); queryParams.push(vendor_id); }
    const dateFilter = buildDateFilter(fromDate, toDate, 'g.created_at');
    whereConditions.push(...dateFilter.conditions); queryParams.push(...dateFilter.params);
    const searchFilter = buildSearchFilter(search, ['g.grn_number', 'g.vendor_name', 'g.status']);
    whereConditions.push(...searchFilter.conditions); queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const baseQuery = `
      SELECT g.*, po.purchase_generate_id,
             DATE_FORMAT(g.grn_date, '%d/%m/%Y') as grn_date_formatted
      FROM grn g
      
      LEFT JOIN purchase_orders po ON g.po_id = po.id
      ${whereClause} ORDER BY g.created_at DESC
    `;

    if (isExport === 'excel') {
      const grns = await sequelize.query(baseQuery, { replacements: queryParams, type: QueryTypes.SELECT });
      const workbook = await createExcelWorkbook(grns, 'GRN Report', [
        { header: 'GRN Number', key: 'grn_number', width: 20 },
        { header: 'PO Number', key: 'po_number', width: 20 },
        { header: 'Vendor Name', key: 'vendor_name', width: 20 },
        { header: 'GRN Date', key: 'grn_date_formatted', width: 15 },
        { header: 'Received Qty', key: 'received_qty', width: 15 },
        { header: 'Total Amount', key: 'total_amount', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="grn_report.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM grn g LEFT JOIN purchase_orders po ON g.po_id = po.id ${whereClause}`, { replacements: queryParams, type: QueryTypes.SELECT });
    const grns = await sequelize.query(`${baseQuery} LIMIT ? OFFSET ?`, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = grns.map(grn => ({
      grn_number: grn.grn_number,
      grn_date: grn.grn_date_formatted,
      received_qty: grn.received_qty,
      total_amount: grn.total_amount,
      status: grn.status
    }));

    res.status(200).json({ success: true, message: "GRN report retrieved successfully", ...formatPaginatedResponse(htmlData, countResult.total, page, limit) });

  } catch (error) {
    logger.error("Error fetching GRN report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// =================== CREDIT NOTE REPORTS ===================
v1Router.get("/credit-notes", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, client_id, search, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['cn.company_id = ?', 'cn.status = ?'];
    const queryParams = [company_id, 'active'];

    if (client_id) { whereConditions.push('cn.client_id = ?'); queryParams.push(client_id); }
    const dateFilter = buildDateFilter(fromDate, toDate, 'cn.created_at');
    whereConditions.push(...dateFilter.conditions); queryParams.push(...dateFilter.params);
    const searchFilter = buildSearchFilter(search, ['cn.credit_note_number', 'cn.reference', 'cn.reason', 'cn.status']);
    whereConditions.push(...searchFilter.conditions); queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const baseQuery = `
      SELECT cn.*, c.display_name as client_name, c.email as client_email,
             DATE_FORMAT(cn.created_at, '%d/%m/%Y') as credit_note_date_formatted
      FROM credit_notes cn
      LEFT JOIN clients c ON cn.client_id = c.client_id
      ${whereClause} ORDER BY cn.created_at DESC
    `;

    if (isExport === 'excel') {
      const creditNotes = await sequelize.query(baseQuery, { replacements: queryParams, type: QueryTypes.SELECT });
      const workbook = await createExcelWorkbook(creditNotes, 'Credit Notes Report', [
        { header: 'Credit Note Number', key: 'credit_note_number', width: 20 },
        { header: 'Client Name', key: 'client_name', width: 20 },
        { header: 'Credit Note Date', key: 'credit_note_date_formatted', width: 15 },
        { header: 'Reference', key: 'reference', width: 20 },
        { header: 'Credit Amount', key: 'credit_amount', width: 15 },
        { header: 'Reason', key: 'reason', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="credit_notes_report.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM credit_notes cn LEFT JOIN clients c ON cn.client_id = c.client_id ${whereClause}`, { replacements: queryParams, type: QueryTypes.SELECT });
    const creditNotes = await sequelize.query(`${baseQuery} LIMIT ? OFFSET ?`, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = creditNotes.map(note => ({
      credit_note_number: note.credit_note_number,
      credit_note_date: note.credit_note_date_formatted,
      credit_amount: note.credit_amount,
      reason: note.reason,
      status: note.status
    }));

    res.status(200).json({ success: true, message: "Credit notes report retrieved successfully", ...formatPaginatedResponse(htmlData, countResult.total, page, limit) });

  } catch (error) {
    logger.error("Error fetching credit notes report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// =================== DEBIT NOTE REPORTS ===================
v1Router.get("/debit-notes", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, vendor_id, search, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['dn.company_id = ?', 'dn.status = ?'];
    const queryParams = [company_id, 'active'];

    if (vendor_id) { whereConditions.push('dn.supplier_id = ?'); queryParams.push(vendor_id); }
    const dateFilter = buildDateFilter(fromDate, toDate, 'dn.created_at');
    whereConditions.push(...dateFilter.conditions); queryParams.push(...dateFilter.params);
    const searchFilter = buildSearchFilter(search, ['dn.debit_note_number', 'dn.vendor_name', 'dn.reference', 'dn.reason', 'dn.status']);
    whereConditions.push(...searchFilter.conditions); queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const baseQuery = `
      SELECT dn.*, c.display_name as vendor_display_name, c.email as vendor_email,
             DATE_FORMAT(dn.debit_note_date, '%d/%m/%Y') as debit_note_date_formatted
      FROM debit_notes dn
      LEFT JOIN clients c ON dn.supplier_id = c.client_id
      ${whereClause} ORDER BY dn.created_at DESC
    `;

    if (isExport === 'excel') {
      const debitNotes = await sequelize.query(baseQuery, { replacements: queryParams, type: QueryTypes.SELECT });
      const workbook = await createExcelWorkbook(debitNotes, 'Debit Notes Report', [
        { header: 'Debit Note Number', key: 'debit_note_number', width: 20 },
        { header: 'Vendor Name', key: 'vendor_name', width: 20 },
        { header: 'Debit Note Date', key: 'debit_note_date_formatted', width: 15 },
        { header: 'Reference', key: 'reference', width: 20 },
        { header: 'Debit Amount', key: 'debit_amount', width: 15 },
        { header: 'Reason', key: 'reason', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="debit_notes_report.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM debit_notes dn LEFT JOIN clients c ON dn.supplier_id = c.client_id ${whereClause}`, { replacements: queryParams, type: QueryTypes.SELECT });
    const debitNotes = await sequelize.query(`${baseQuery} LIMIT ? OFFSET ?`, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = debitNotes.map(note => ({
      debit_note_number: note.debit_note_number,
      debit_note_date: note.debit_note_date_formatted,
      debit_amount: note.debit_amount,
      reason: note.reason,
      status: note.status
    }));

    res.status(200).json({ success: true, message: "Debit notes report retrieved successfully", ...formatPaginatedResponse(htmlData, countResult.total, page, limit) });

  } catch (error) {
    logger.error("Error fetching debit notes report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// =================== STOCK ADJUSTMENTS REPORTS ===================
v1Router.get("/stock-adjustments", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, adjustment_type, search, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['sa.company_id = ?', 'sa.status = ?'];
    const queryParams = [company_id, 'active'];

    if (adjustment_type) { whereConditions.push('sa.adjustment_type = ?'); queryParams.push(adjustment_type); }
    const dateFilter = buildDateFilter(fromDate, toDate, 'sa.created_at');
    whereConditions.push(...dateFilter.conditions); queryParams.push(...dateFilter.params);
    const searchFilter = buildSearchFilter(search, ['sa.adjustment_id', 'sa.adjustment_type', 'sa.reference', 'sa.reason', 'sa.status']);
    whereConditions.push(...searchFilter.conditions); queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const baseQuery = `
      SELECT sa.*, comp.company_name,
             DATE_FORMAT(sa.adjustment_date, '%d/%m/%Y') as adjustment_date_formatted
      FROM stock_adjustments sa
      LEFT JOIN companies comp ON sa.company_id = comp.id
      ${whereClause} ORDER BY sa.created_at DESC
    `;

    if (isExport === 'excel') {
      const stockAdjustments = await sequelize.query(baseQuery, { replacements: queryParams, type: QueryTypes.SELECT });
      const workbook = await createExcelWorkbook(stockAdjustments, 'Stock Adjustments Report', [
        { header: 'Adjustment ID', key: 'adjustment_id', width: 20 },
        { header: 'Adjustment Date', key: 'adjustment_date_formatted', width: 15 },
        { header: 'Adjustment Type', key: 'adjustment_type', width: 15 },
        { header: 'Reference', key: 'reference', width: 20 },
        { header: 'Reason', key: 'reason', width: 25 },
        { header: 'Total Adjustment Value', key: 'total_adjustment_value', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="stock_adjustments_report.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM stock_adjustments sa LEFT JOIN companies comp ON sa.company_id = comp.id ${whereClause}`, { replacements: queryParams, type: QueryTypes.SELECT });
    const stockAdjustments = await sequelize.query(`${baseQuery} LIMIT ? OFFSET ?`, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = stockAdjustments.map(adj => ({
      adjustment_id: adj.adjustment_id,
      adjustment_date: adj.adjustment_date_formatted,
      adjustment_type: adj.adjustment_type,
      reason: adj.reason,
      total_adjustment_value: adj.total_adjustment_value,
      status: adj.status
    }));

    res.status(200).json({ success: true, message: "Stock adjustments report retrieved successfully", ...formatPaginatedResponse(htmlData, countResult.total, page, limit) });

  } catch (error) {
    logger.error("Error fetching stock adjustments report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// =================== PRODUCTS REPORTS ===================
v1Router.get("/products", authenticateJWT, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { fromDate, toDate, item_id, search, export: isExport } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);

    const whereConditions = ['im.company_id = ?', 'im.status = ?'];
    const queryParams = [company_id, 'active'];

    if (item_id) { whereConditions.push('im.id = ?'); queryParams.push(item_id); }
    const dateFilter = buildDateFilter(fromDate, toDate, 'im.created_at');
    whereConditions.push(...dateFilter.conditions); queryParams.push(...dateFilter.params);
    const searchFilter = buildSearchFilter(search, ['im.item_code', 'im.item_name', 'im.category', 'im.unit', 'im.description']);
    whereConditions.push(...searchFilter.conditions); queryParams.push(...searchFilter.params);

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const baseQuery = `SELECT im.*, comp.company_name FROM item_master im LEFT JOIN companies comp ON im.company_id = comp.id ${whereClause} ORDER BY im.created_at DESC`;

    if (isExport === 'excel') {
      const products = await sequelize.query(baseQuery, { replacements: queryParams, type: QueryTypes.SELECT });
      const workbook = await createExcelWorkbook(products, 'Products Report', [
        { header: 'Item Code', key: 'item_code', width: 15 },
        { header: 'Item Name', key: 'item_name', width: 20 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Purchase Rate', key: 'purchase_rate', width: 15 },
        { header: 'Selling Rate', key: 'selling_rate', width: 15 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Created Date', key: 'created_at', width: 15 }
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="products_report.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total FROM item_master im LEFT JOIN companies comp ON im.company_id = comp.id ${whereClause}`, { replacements: queryParams, type: QueryTypes.SELECT });
    const products = await sequelize.query(`${baseQuery} LIMIT ? OFFSET ?`, { replacements: [...queryParams, limit, offset], type: QueryTypes.SELECT });

    const htmlData = products.map(product => ({
      item_code: product.item_code,
      item_name: product.item_name,
      category: product.category,
      unit: product.unit,
      purchase_rate: product.purchase_rate,
      selling_rate: product.selling_rate,
      status: product.status
    }));

    res.status(200).json({ success: true, message: "Products report retrieved successfully", ...formatPaginatedResponse(htmlData, countResult.total, page, limit) });

  } catch (error) {
    logger.error("Error fetching products report:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
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

export default app;