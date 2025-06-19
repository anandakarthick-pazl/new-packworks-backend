/**
 * Dashboard Service for PACKWORKX ERP System
 * 
 * IMPORTANT: Fixed database collation error in UNION queries
 * Date: 2025-06-19
 * Issue: "Illegal mix of collations for operation 'UNION'"
 * Solution: Added COLLATE utf8mb4_unicode_ci to all string columns in UNION queries
 * Location: Recent Transactions query section
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
const WorkOrder = db.WorkOrder;
const SalesOrder = db.SalesOrder;



/**
 * Dashboard API Endpoint with Date Filtering
 * 
 * Query Parameters:
 * - from_date: Start date in YYYY-MM-DD format (optional)
 * - to_date: End date in YYYY-MM-DD format (optional)
 * 
 * Default Behavior (when dates are empty):
 * - from_date: First day of current month
 * - to_date: Today
 * 
 * Examples:
 * - /api/dashboard (uses defaults)
 * - /api/dashboard?from_date=2024-01-01&to_date=2024-01-31
 * - /api/dashboard?from_date=&to_date= (uses defaults)
 */
v1Router.get("/dashboard", authenticateJWT, async (req, res) => {
  try {
    const company_id = req.user.company_id;

    // Extract date parameters from query string
    const { from_date, to_date } = req.query;

    // Set default dates if parameters are empty
    let startDate, endDate;
    
    if (!from_date || !to_date || from_date === '' || to_date === '') {
      // Default: First day of current month to today
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1+1); // First day of current month
     
      endDate = new Date(); // Today
      
    } else {
      // Use provided dates
      startDate = new Date(from_date);
      endDate = new Date(to_date);
      
      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Please use YYYY-MM-DD format.",
          error: "Invalid date parameters"
        });
      }
      
      // Ensure start date is not after end date
      if (startDate > endDate) {
        return res.status(400).json({
          success: false,
          message: "Start date cannot be after end date.",
          error: "Invalid date range"
        });
      }
    }
    
    // Set end date to end of day for proper filtering
    endDate.setHours(23, 59, 59, 999);
    
    // Calculate additional date ranges for charts (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Log the date range being used
    logger.info(`Dashboard request for company_id: ${company_id}, Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    // Parallel database queries for better performance with error handling
    const queryResults = await Promise.allSettled([
      // Sales Orders Count (within date range)
      SalesOrder.count({
        where: { 
          company_id,
          status: 'active',
          created_at: { [Op.between]: [startDate, endDate] }
        }
      }),
      
      // Work Orders Count (within date range)
      WorkOrder.count({
        where: { 
          company_id,
          status: 'active',
          created_at: { [Op.between]: [startDate, endDate] },
          progress: { [Op.in]: ['Pending', 'Raw Material Allocation', 'Production Planned'] }
        }
      }),
      
      // SKU Count
      db.Sku.count({
        where: { 
          company_id,
          status: 'active'
        }
      }),
      
      // Total Machines Count
      db.Machine.count({
        where: { 
          company_id,
          status: 'active'
        }
      }),
      
      // Active Machines Count
      db.Machine.count({
        where: { 
          company_id,
          status: 'active',
          machine_status: 'Active'
        }
      }),
      
      // Employees Count
      db.User.count({
        where: { 
          company_id,
          status: 'active',
          is_superadmin: 0
        }
      }),
      
      // Clients Count
      db.Client.count({
        where: { 
          company_id,
          status: 'active'
        }
      }),
      
      // Purchase Orders Count (within date range)
      db.PurchaseOrder.count({
        where: { 
          company_id,
          status: 'active',
          created_at: { [Op.between]: [startDate, endDate] }
        }
      }),
      
      // GRN Count (within date range)
      db.GRN.count({
        where: { 
          company_id,
          status: 'active',
          created_at: { [Op.between]: [startDate, endDate] }
        }
      }),
      
      // Stock Adjustments Count (within date range)
      db.stockAdjustment.count({
        where: { 
          company_id,
          status: 'active',
          created_at: { [Op.between]: [startDate, endDate] }
        }
      }),
      
      // Purchase Return Count (within date range)
      db.PurchaseReturn ? db.PurchaseReturn.count({
        where: { 
          company_id,
          status: 'active',
          created_at: { [Op.between]: [startDate, endDate] }
        }
      }) : Promise.resolve(0),
      
      // Credit Note Count (within date range)
      db.CreditNote ? db.CreditNote.count({
        where: { 
          company_id,
          status: 'active',
          created_at: { [Op.between]: [startDate, endDate] }
        }
      }) : Promise.resolve(0),
      
      // Debit Note Count (within date range)
      db.DebitNote ? db.DebitNote.count({
        where: { 
          company_id,
          status: 'active',
          created_at: { [Op.between]: [startDate, endDate] }
        }
      }) : Promise.resolve(0),
      
      // Sales Trend Data (within specified date range)
      sequelize.query(`
        SELECT 
          DATE_FORMAT(created_at, '%b') as month,
          DATE_FORMAT(created_at, '%Y-%m') as year_month,
          COUNT(*) as sales_orders,
          (SELECT COUNT(*) FROM purchase_orders WHERE company_id = :company_id 
           AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(so.created_at, '%Y-%m')
           AND created_at BETWEEN :startDate AND :endDate) as purchase_orders
        FROM sales_order so 
        WHERE company_id = :company_id 
        AND created_at BETWEEN :startDate AND :endDate
        GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b')
        ORDER BY year_month ASC
      `, {
        replacements: { company_id, startDate, endDate },
        type: sequelize.QueryTypes.SELECT
      }),
      
      // Machine Efficiency Data
      db.Machine.findAll({
        where: { 
          company_id,
          status: 'active'
        },
        attributes: ['machine_name', 'machine_status'],
        limit: 6
      }),
      
      // Recent Transactions with fixed collation (within date range)
      sequelize.query(`
        (SELECT 
          'Sales Order' COLLATE utf8mb4_unicode_ci as type, 
          sales_generate_id COLLATE utf8mb4_unicode_ci as reference, 
          client COLLATE utf8mb4_unicode_ci as client_name, 
          CAST(total_incl_gst AS CHAR) COLLATE utf8mb4_unicode_ci as amount, 
          sales_status COLLATE utf8mb4_unicode_ci as status, 
          created_at as date, 
          'High' COLLATE utf8mb4_unicode_ci as priority
         FROM sales_order 
         WHERE company_id = :company_id AND status = 'active' 
         AND created_at BETWEEN :startDate AND :endDate
         ORDER BY created_at DESC LIMIT 2)
        UNION ALL
        (SELECT 
          'Work Order' COLLATE utf8mb4_unicode_ci as type, 
          work_generate_id COLLATE utf8mb4_unicode_ci as reference, 
          COALESCE(
            (SELECT client COLLATE utf8mb4_unicode_ci FROM sales_order WHERE id = wo.sales_order_id), 
            'Internal Production'
          ) COLLATE utf8mb4_unicode_ci as client_name,
          '0' COLLATE utf8mb4_unicode_ci as amount, 
          progress COLLATE utf8mb4_unicode_ci as status, 
          created_at as date, 
          COALESCE(priority, 'Medium') COLLATE utf8mb4_unicode_ci as priority
         FROM work_order wo 
         WHERE company_id = :company_id AND status = 'active' 
         AND created_at BETWEEN :startDate AND :endDate
         ORDER BY created_at DESC LIMIT 2)
        UNION ALL
        (SELECT 
          'Purchase Order' COLLATE utf8mb4_unicode_ci as type, 
          purchase_generate_id COLLATE utf8mb4_unicode_ci as reference, 
          supplier_name COLLATE utf8mb4_unicode_ci as client_name,
          CAST(total_amount AS CHAR) COLLATE utf8mb4_unicode_ci as amount, 
          po_status COLLATE utf8mb4_unicode_ci as status, 
          created_at as date, 
          'Medium' COLLATE utf8mb4_unicode_ci as priority
         FROM purchase_orders 
         WHERE company_id = :company_id AND status = 'active' 
         AND created_at BETWEEN :startDate AND :endDate
         ORDER BY created_at DESC LIMIT 1)
        UNION ALL
        (SELECT 
          'GRN' COLLATE utf8mb4_unicode_ci as type, 
          grn_generate_id COLLATE utf8mb4_unicode_ci as reference, 
          supplier_name COLLATE utf8mb4_unicode_ci as client_name,
          CAST(total_amount AS CHAR) COLLATE utf8mb4_unicode_ci as amount, 
          grn_status COLLATE utf8mb4_unicode_ci as status, 
          created_at as date, 
          'Low' COLLATE utf8mb4_unicode_ci as priority
         FROM grn 
         WHERE company_id = :company_id AND status = 'active' 
         AND created_at BETWEEN :startDate AND :endDate
         ORDER BY created_at DESC LIMIT 1)
        ORDER BY date DESC LIMIT 8
      `, {
        replacements: { company_id, startDate, endDate },
        type: sequelize.QueryTypes.SELECT
      }).catch(error => {
        logger.error('Error in recent transactions query:', error);
        // Return empty array as fallback
        return [];
      }),
      
      // Production Metrics (within date range)
      sequelize.query(`
        SELECT 
          COUNT(*) as total_work_orders,
          SUM(CASE WHEN progress = 'Completed' THEN 1 ELSE 0 END) as completed_orders,
          AVG(CASE WHEN progress = 'Completed' THEN 100 ELSE 
              CASE WHEN progress = 'Production Planned' THEN 75 ELSE
              CASE WHEN progress = 'Raw Material Allocation' THEN 50 ELSE 25 END END END) as avg_progress
        FROM work_order 
        WHERE company_id = :company_id AND status = 'active'
        AND created_at BETWEEN :startDate AND :endDate
      `, {
        replacements: { company_id, startDate, endDate },
        type: sequelize.QueryTypes.SELECT
      })
    ]);

    // Extract results with fallback values for failed queries
    const [
      salesOrdersCount = 0,
      workOrdersCount = 0,
      skuCount = 0,
      machinesCount = 1, // Default to 1 to avoid division by zero
      activeMachinesCount = 0,
      employeesCount = 0,
      clientsCount = 0,
      purchaseOrdersCount = 0,
      grnCount = 0,
      stockAdjustmentsCount = 0,
      purchaseReturnCount = 0,
      creditNoteCount = 0,
      debitNoteCount = 0,
      salesTrendData = [],
      machineEfficiencyData = [],
      recentTransactions = [],
      productionMetrics = [{ total_work_orders: 0, completed_orders: 0, avg_progress: 85 }]
    ] = queryResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Log the error for debugging
        logger.error(`Query ${index} failed:`, result.reason);
        // Return default values based on query index
        const defaults = [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, [], [], [], [{ total_work_orders: 0, completed_orders: 0, avg_progress: 85 }]];
        return defaults[index];
      }
    });

    // Calculate growth percentages (mock calculations for demo)
    const calculateGrowth = (current, previous = current * 0.9) => {
      const growth = ((current - previous) / previous * 100).toFixed(1);
      return growth > 0 ? `+${growth}%` : `${growth}%`;
    };

    // Build dashboard response
    const dashboardResponse = {
      dashboardConfig: {
        title: "PACKWORKX ERP Dashboard",
        subtitle: "Complete overview of your manufacturing operations and business processes",
        dateRange: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        },
        appliedFilters: {
          from_date: from_date || 'auto',
          to_date: to_date || 'auto',
          filterDescription: from_date && to_date ? 
            `Custom date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}` :
            `Default range: ${startDate.toISOString().split('T')[0]} (month start) to ${endDate.toISOString().split('T')[0]} (today)`
        }
      },
      themeColors: {
        production: "#e74c3c",
        inventory: "#3498db",
        sales: "#2ecc71",
        purchase: "#f39c12",
        quality: "#9b59b6",
        maintenance: "#e67e22",
        finance: "#34495e",
        hr: "#1abc9c"
      },
      // alerts: [
      //   {
      //     id: 1,
      //     type: "info",
      //     message: from_date && to_date ? 
      //       `Dashboard showing data for custom date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}` :
      //       `Dashboard showing data for default range: ${startDate.toISOString().split('T')[0]} (month start) to ${endDate.toISOString().split('T')[0]} (today)`,
      //     time: "now",
      //     icon: "cilCalendar",
      //     module: "System"
      //   },
      //   {
      //     id: 2,
      //     type: "warning",
      //     message: `${workOrdersCount} work orders are currently in progress`,
      //     time: "30 minutes ago",
      //     icon: "cilWarning",
      //     module: "Production"
      //   },
      //   {
      //     id: 3,
      //     type: activeMachinesCount < machinesCount ? "warning" : "success",
      //     message: `${activeMachinesCount}/${machinesCount} machines are currently active`,
      //     time: "1 hour ago",
      //     icon: "cilCalculator",
      //     module: "Maintenance"
      //   }
      // ],
      alert:[],
      erpWidgets: [
        {
          title: "Sales Orders",
          value: salesOrdersCount.toString(),
          change: calculateGrowth(salesOrdersCount),
          trend: "up",
          description: "Active orders",
          color: "#2ecc71",
          icon: "cilCart",
          target: Math.max(salesOrdersCount * 1.2, 100).toString(),
          urgentCount: Math.floor(salesOrdersCount * 0.1),
          bgGradient: "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)"
        },
        {
          title: "Work Orders",
          value: workOrdersCount.toString(),
          change: calculateGrowth(workOrdersCount),
          trend: "up",
          description: "In production",
          color: "#e74c3c",
          icon: "cilPencil",
          target: Math.max(workOrdersCount * 1.3, 50).toString(),
          urgentCount: Math.floor(workOrdersCount * 0.15),
          bgGradient: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)"
        },
        {
          title: "SKU Inventory",
          value: skuCount.toLocaleString(),
          change: calculateGrowth(skuCount),
          trend: skuCount > 100 ? "up" : "down",
          description: "Total items",
          color: "#3498db",
          icon: "cilList",
          target: Math.max(skuCount * 1.2, 200).toString(),
          urgentCount: Math.floor(skuCount * 0.05),
          bgGradient: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)"
        },
        {
          title: "Active Machines",
          value: `${activeMachinesCount}/${machinesCount}`,
          change: calculateGrowth(activeMachinesCount, machinesCount * 0.8),
          trend: "up",
          description: "Operational status",
          color: "#e67e22",
          icon: "cilCalculator",
          target: machinesCount.toString(),
          urgentCount: machinesCount - activeMachinesCount,
          bgGradient: "linear-gradient(135deg, #e67e22 0%, #d35400 100%)"
        },
        {
          title: "Employees",
          value: employeesCount.toString(),
          change: calculateGrowth(employeesCount),
          trend: "up",
          description: "Active workforce",
          color: "#1abc9c",
          icon: "cilUser",
          target: Math.max(employeesCount * 1.1, 50).toString(),
          urgentCount: Math.floor(employeesCount * 0.02),
          bgGradient: "linear-gradient(135deg, #1abc9c 0%, #16a085 100%)"
        },
        {
          title: "Clients/Vendors",
          value: clientsCount.toLocaleString(),
          change: calculateGrowth(clientsCount),
          trend: "up",
          description: "Active partners",
          color: "#34495e",
          icon: "cilUserPlus",
          target: Math.max(clientsCount * 1.2, 100).toString(),
          urgentCount: Math.floor(clientsCount * 0.03),
          bgGradient: "linear-gradient(135deg, #34495e 0%, #2c3e50 100%)"
        },
        {
          title: "Purchase Orders",
          value: purchaseOrdersCount.toString(),
          change: calculateGrowth(purchaseOrdersCount),
          trend: "up",
          description: "Pending orders",
          color: "#f39c12",
          icon: "cilTruck",
          target: Math.max(purchaseOrdersCount * 1.3, 30).toString(),
          urgentCount: Math.floor(purchaseOrdersCount * 0.1),
          bgGradient: "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)"
        },
        {
          title: "Routes",
          value: "12", // Static for now, can be made dynamic
          change: "+3.8%",
          trend: "up",
          description: "Active routes",
          color: "#9b59b6",
          icon: "cilExternalLink",
          target: "15",
          urgentCount: 2,
          bgGradient: "linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)"
        }
      ],
      financialWidgets: [
        {
          title: "GRN Processed",
          value: grnCount.toString(),
          change: calculateGrowth(grnCount),
          description: "Goods received",
          color: "#3498db",
          icon: "cilHome",
          amount: `₹${(grnCount * 2500).toLocaleString()}`
        },
        {
          title: "Stock Adjustments",
          value: stockAdjustmentsCount.toString(),
          change: calculateGrowth(stockAdjustmentsCount),
          description: "Inventory corrections",
          color: "#e67e22",
          icon: "cilSettings",
          amount: `₹${(stockAdjustmentsCount * 500).toLocaleString()}`
        },
        {
          title: "Purchase Returns",
          value: purchaseReturnCount.toString(),
          change: calculateGrowth(purchaseReturnCount),
          description: "Returns to suppliers",
          color: "#e74c3c",
          icon: "cilArrowBottom",
          amount: `₹${(purchaseReturnCount * 1200).toLocaleString()}`
        },
        {
          title: "Credit Notes",
          value: creditNoteCount.toString(),
          change: calculateGrowth(creditNoteCount),
          description: "Issued credits",
          color: "#34495e",
          icon: "cilCreditCard",
          amount: `₹${(creditNoteCount * 800).toLocaleString()}`
        },
        {
          title: "Debit Notes",
          value: debitNoteCount.toString(),
          change: calculateGrowth(debitNoteCount),
          description: "Issued debits",
          color: "#9b59b6",
          icon: "cilFile",
          amount: `₹${(debitNoteCount * 600).toLocaleString()}`
        }
      ],
      productionMetrics: [
        {
          label: "Daily Production Target",
          current: Math.min(productionMetrics[0]?.total_work_orders || 0, 100),
          target: 100,
          color: "#e74c3c",
          unit: "units",
          efficiency: Math.min(Math.round((productionMetrics[0]?.avg_progress || 85)), 120)
        },
        {
          label: "Quality Pass Rate",
          current: 96.8,
          target: 95,
          color: "#9b59b6",
          unit: "%",
          efficiency: 102
        },
        {
          label: "Machine Utilization",
          current: Math.round((activeMachinesCount / Math.max(machinesCount, 1)) * 100),
          target: 85,
          color: "#e67e22",
          unit: "%",
          efficiency: Math.round((activeMachinesCount / Math.max(machinesCount, 1)) * 100 / 85 * 100)
        },
        {
          label: "On-time Delivery",
          current: 92.3,
          target: 95,
          color: "#2ecc71",
          unit: "%",
          efficiency: 97
        }
      ],
      recentTransactions: (recentTransactions || []).map((transaction, index) => ({
        id: index + 1,
        type: transaction.type,
        reference: transaction.reference,
        client: transaction.client_name,
        amount: transaction.amount ? `₹${parseFloat(transaction.amount).toLocaleString()}` : 'N/A',
        status: transaction.status,
        date: new Date(transaction.date).toISOString().split('T')[0],
        priority: transaction.priority,
        icon: transaction.type === 'Sales Order' ? 'cilCart' : 
              transaction.type === 'Work Order' ? 'cilPencil' :
              transaction.type === 'Purchase Order' ? 'cilTruck' : 
              transaction.type === 'GRN' ? 'cilHome' :
              transaction.type === 'Purchase Return' ? 'cilArrowBottom' :
              transaction.type === 'Credit Note' ? 'cilCreditCard' :
              transaction.type === 'Debit Note' ? 'cilFile' : 'cilInfo',
        color: transaction.type === 'Sales Order' ? '#2ecc71' : 
               transaction.type === 'Work Order' ? '#e74c3c' :
               transaction.type === 'Purchase Order' ? '#f39c12' : 
               transaction.type === 'GRN' ? '#3498db' :
               transaction.type === 'Purchase Return' ? '#e74c3c' :
               transaction.type === 'Credit Note' ? '#34495e' :
               transaction.type === 'Debit Note' ? '#9b59b6' : '#95a5a6'
      })),
      chartData: {
        salesTrend: {
          labels: (salesTrendData || []).map(item => item.month),
          datasets: [
            {
              label: "Sales Orders",
              data: (salesTrendData || []).map(item => item.sales_orders || 0),
              borderColor: "#2ecc71",
              backgroundColor: "#2ecc7120",
              fill: true,
              tension: 0.4
            },
            {
              label: "Purchase Orders",
              data: (salesTrendData || []).map(item => item.purchase_orders || 0),
              borderColor: "#f39c12",
              backgroundColor: "#f39c1220",
              fill: true,
              tension: 0.4
            }
          ]
        },
        inventoryDistribution: {
          labels: ["Raw Materials", "Work in Progress", "Finished Goods", "Packaging", "Consumables"],
          datasets: [{
            data: [35, 25, 20, 15, 5],
            backgroundColor: ["#3498db", "#e74c3c", "#2ecc71", "#e67e22", "#9b59b6"],
            borderWidth: 2,
            borderColor: "#fff"
          }]
        },
        machineEfficiency: {
          labels: (machineEfficiencyData || []).map(machine => machine.machine_name || `M-${machine.id || '001'}`),
          datasets: [{
            label: "Efficiency %",
            data: (machineEfficiencyData || []).map(machine => 
              machine.machine_status === 'Active' ? Math.floor(Math.random() * 20) + 80 : Math.floor(Math.random() * 30) + 50
            ),
            backgroundColor: (machineEfficiencyData || []).map((_, index) => 
              index % 2 === 0 ? "#e67e22" : "#e74c3c"
            ),
            borderRadius: 8
          }]
        },
        employeePerformance: {
          labels: ["Production", "Quality", "Maintenance", "Logistics", "Admin"],
          datasets: [{
            label: "Performance",
            data: [Math.floor(employeesCount * 0.6), Math.floor(employeesCount * 0.15), Math.floor(employeesCount * 0.1), Math.floor(employeesCount * 0.1), Math.floor(employeesCount * 0.05)],
            backgroundColor: ["#e74c3c", "#9b59b6", "#e67e22", "#f39c12", "#1abc9c"]
          }]
        }
      },
      quickActions: [
        {
          label: "New Sales Order",
          icon: "cilCart",
          color: "#2ecc71",
          action: "createSalesOrder"
        },
        {
          label: "Create Work Order",
          icon: "cilPencil",
          color: "#e74c3c",
          action: "createWorkOrder"
        },
        {
          label: "Add SKU",
          icon: "cilList",
          color: "#3498db",
          action: "addSKU"
        },
        {
          label: "Purchase Order",
          icon: "cilTruck",
          color: "#f39c12",
          action: "createPurchaseOrder"
        },
        {
          label: "Process GRN",
          icon: "cilHome",
          color: "#3498db",
          action: "processGRN"
        },
        {
          label: "Add Employee",
          icon: "cilUser",
          color: "#1abc9c",
          action: "addEmployee"
        }
      ],
      statusConfig: {
        statusStyles: {
          "Confirmed": "success",
          "Pending": "warning",
          "In-progress": "info",
          "Completed": "success",
          "created": "primary",
          "Raw Material Allocation": "warning",
          "Production Planned": "info",
          "Invoiced": "success",
          "received": "primary",
          "Rejected": "danger"
        },
        priorityColors: {
          "High": "danger",
          "Medium": "warning",
          "Low": "success"
        }
      },
      metadata: {
        lastUpdated: new Date().toISOString(),
        version: "1.0.0",
        dataSource: "PACKWORKX ERP System",
        refreshInterval: 300000,
        dateFilter: {
          applied: true,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          isDefault: !from_date || !to_date || from_date === '' || to_date === '',
          daysDifference: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
        }
      }
    };

    res.status(200).json({
      success: true,
      message: "Dashboard data retrieved successfully",
      data: dashboardResponse
    });

    // Log successful dashboard load
    logger.info(`Dashboard data loaded successfully for company_id: ${company_id}`);

  } catch (error) {
    logger.error("Error fetching dashboard data:", error);
    
    // Provide more specific error information
    const errorMessage = error.message || 'Unknown error occurred';
    
    res
      .status(500)
      .json({ 
        message: "Internal Server Error", 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
app.use("/api", v1Router);
// await db.sequelize.sync();
const PORT = process.env.PORT_DASHBOARD;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Dashboard Service running on port ${PORT}`);
});
