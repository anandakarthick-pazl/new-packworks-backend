import { Op } from "sequelize";
import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import puppeteer from "puppeteer";
import handlebars from "handlebars";
import HtmlTemplate from "../../common/models/htmlTemplate.model.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const WorkOrderInvoice = db.WorkOrderInvoice;
const WorkOrder = db.WorkOrder;
const SalesOrder = db.SalesOrder;
const Client = db.Client;

// POST create new work order invoice
v1Router.post("/create", authenticateJWT, async (req, res) => {
  const invoiceDetails = req.body;

  if (!invoiceDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  try {
    const invoice_number = await generateId(
      req.user.company_id,
      WorkOrderInvoice,
      "work_invoice"
    );

    let skuDetails = null;

    try {
      if (typeof invoiceDetails.sku_details === 'string') {
        skuDetails = JSON.parse(invoiceDetails.sku_details);
      } else if (typeof invoiceDetails.sku_details === 'object') {
        skuDetails = invoiceDetails.sku_details;
      }
    } catch (err) {
      console.error("Invalid JSON in sku_details:", err);
      skuDetails = null;
    }

    // Create Work Order Invoice
    const newInvoice = await WorkOrderInvoice.create({
      invoice_number: invoice_number,
      company_id: req.user.company_id,
      client_id: invoiceDetails.client_id,
      // sku_id: invoiceDetails.sku_id || null,
      sku_version_id: invoiceDetails.sku_version_id || null,
      status: invoiceDetails.status || "active",
      sale_id: invoiceDetails.sale_id || null,
      work_id: invoiceDetails.work_id || null,
      due_date: invoiceDetails.due_date || null,
      total: invoiceDetails.total || 0.0,
      balance: invoiceDetails.balance || 0.0,
      payment_expected_date: invoiceDetails.payment_expected_date || null,
      transaction_type: invoiceDetails.transaction_type || null,
      discount_type: invoiceDetails.discount_type || null,
      discount: invoiceDetails.discount || 0.0,
      total_tax: invoiceDetails.total_tax || 0.0,
      total_amount: invoiceDetails.total_amount || 0.0,
      payment_status: invoiceDetails.payment_status || null,
      created_by: req.user.id,
      updated_by: req.user.id,
      quantity: invoiceDetails.quantity || null,
      sku_details: skuDetails || null,
      client_name: invoiceDetails.client_name || null


    });

    res.status(201).json({
      message: "Work Order Invoice created successfully",
      data: newInvoice.get({ plain: true }),
    });
  } catch (error) {
    logger.error("Error creating work order invoice:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET all work order invoices with pagination, filtering, and search
v1Router.get("/get", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      work_id,
      sale_id,
      payment_status,
      status = "active", // Default to 'active' status
      search = "", // Add search parameter
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const whereClause = {
      company_id: req.user.company_id, // Add company filter for security
    };

    // Status filtering - default to active, but allow override
    if (status === "all") {
      // Don't filter by status if 'all' is specified
    } else {
      whereClause.status = status;
    }

    if (work_id) {
      whereClause.work_id = work_id;
    }
    if (sale_id) {
      whereClause.sale_id = sale_id;
    }
    if (payment_status) {
      whereClause.payment_status = payment_status;
    }

    // Add search functionality if search parameter is provided
    if (search && search.trim() !== "") {
      const searchTerm = `%${search.trim()}%`; // Add wildcards for partial matching

      // Define search condition to look across multiple fields
      const searchCondition = {
        [Op.or]: [
          // Search in WorkOrderInvoice fields
          { invoice_number: { [Op.like]: searchTerm } },
          //   { description: { [Op.like]: searchTerm } },
          { due_date: { [Op.like]: searchTerm } },

          // Search in related WorkOrder fields using Sequelize's nested include where
          { "$workOrder.work_generate_id$": { [Op.like]: searchTerm } },
          { "$workOrder.sku_name$": { [Op.like]: searchTerm } },

          // Search in related SalesOrder fields
          { "$salesOrder.sales_generate_id$": { [Op.like]: searchTerm } },
        ],
      };

      // Add search condition to where clause
      whereClause[Op.and] = whereClause[Op.and] || [];
      whereClause[Op.and].push(searchCondition);
    }

    // Fetch from database with pagination, filters, and search
    const { count, rows } = await WorkOrderInvoice.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset: offset,
      order: [["updated_at", "DESC"]],
      include: [
        {
          model: WorkOrder,
          as: "workOrder",
          attributes: ["id", "work_generate_id", "sku_name", "qty", "status"],
        },
        {
          model: SalesOrder,
          as: "salesOrder",
          attributes: ["id", "sales_generate_id", "status"],
        },
      ],
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / limitNum);

    res.json({
      // invoices: rows.map((invoice) => invoice.get({ plain: true })),

      invoices: rows.map((invoice) => {
          const plain = invoice.get({ plain: true });
          if (plain.sku_details && typeof plain.sku_details === "string") {
            try {
              plain.sku_details = JSON.parse(plain.sku_details);
            } catch (err) {
              plain.sku_details = null; // fallback if JSON invalid
            }
          }
          return plain;
        }),

      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (error) {
    logger.error("Error fetching work order invoices:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});
// GET specific work order invoice by ID
v1Router.get("/get/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { status = "active" } = req.query;

    const whereClause = {
      id: id,
      company_id: req.user.company_id,
    };

    if (status !== "all") {
      whereClause.status = status;
    }

    const invoice = await WorkOrderInvoice.findOne({
      where: whereClause,
      include: [
        {
          model: WorkOrder,
          as: "workOrder",
          attributes: ["id", "work_generate_id", "sku_name", "qty", "status"],
        },
        {
          model: SalesOrder,
          as: "salesOrder",
          attributes: ["id", "sales_generate_id", "status"],
        },
      ],
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const result = invoice.get({ plain: true });

    if (typeof result.sku_details === "string") {
      try {
        result.sku_details = JSON.parse(result.sku_details);
      } catch (e) {
        result.sku_details = null; // fallback if parsing fails
      }
    }

    res.json(result);
  } catch (error) {
    logger.error("Error fetching work order invoice:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

async function generateOriginalInvoicePDF(req, res, workOrderInvoice) {
  try {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=work-order-invoice-${workOrderInvoice.invoice_number}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('WORK ORDER INVOICE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`Invoice Number: ${workOrderInvoice.invoice_number}`, 40);
    doc.text(`Date: ${workOrderInvoice.due_date ? new Date(workOrderInvoice.due_date).toLocaleDateString() : ''}`, 40);
    
    // Updated to use client details
    const clientName = workOrderInvoice.Client?.display_name || 
                      workOrderInvoice.Client?.company_name || 
                      workOrderInvoice.client_name || 
                      workOrderInvoice.salesOrder?.Client?.display_name || 
                      workOrderInvoice.salesOrder?.Client?.company_name || 
                      `${workOrderInvoice.Client?.first_name || ''} ${workOrderInvoice.Client?.last_name || ''}`.trim() || 
                      `${workOrderInvoice.salesOrder?.Client?.first_name || ''} ${workOrderInvoice.salesOrder?.Client?.last_name || ''}`.trim() || '';
    
    doc.text(`Client: ${clientName}`, 40);
    doc.moveDown(1);
    doc.text(`Total Amount: ${parseFloat(workOrderInvoice.total_amount || 0).toFixed(2)}`, 40);

    doc.end();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to generate fallback PDF: ${error.message}`
    });
  }
}
v1Router.get("/download/:id", async (req, res) => {
  let browser;
  try {
    const invoiceId = req.params.id;

    // Fetch invoice data with client details
    const workOrderInvoice = await WorkOrderInvoice.findOne({
      where: { id: invoiceId, status: "active" },
      include: [
        {
          model: WorkOrder,
          as: "workOrder",
          attributes: ["id", "work_generate_id", "sku_name", "qty", "status"],
        },
        {
          model: SalesOrder,
          as: "salesOrder",
          attributes: ["id", "sales_generate_id", "status", "client_id"],
          include: [
            {
              model: Client, // Make sure to import Client model
              as: "Client", // Use capital C to match the association alias
              attributes: [
                "client_id", 
                "display_name", 
                "first_name", 
                "last_name", 
                "company_name", 
                "email", 
                "work_phone", 
                "mobile", 
                "customer_type",
                "salutation",
                "PAN",
                "gst_number",
                "client_ref_id"
              ]
            }
          ]
        },
        {
          model: Client, // Direct client association if it exists
          as: "Client", // Use capital C to match the association alias
          attributes: [
            "client_id", 
            "display_name", 
            "first_name", 
            "last_name", 
            "company_name", 
            "email", 
            "work_phone", 
            "mobile", 
            "customer_type",
            "salutation",
            "PAN",
            "gst_number",
            "client_ref_id"
          ]
        }
      ],
    });

    if (!workOrderInvoice) {
      return res.status(404).json({ success: false, message: "Work Order Invoice not found" });
    }

    // Try to fetch HTML template, fallback to default if not found
    let htmlTemplate = await HtmlTemplate.findOne({
      where: {
        company_id: workOrderInvoice.company_id,
        template: "work_order_invoice",
        status: "active"
      }
    });

    if (!htmlTemplate) {
      htmlTemplate = await HtmlTemplate.findOne({
        where: { template: "work_order_invoice", status: "active" },
        order: [['id', 'ASC']]
      });
    }

    if (!htmlTemplate) {
      return generateOriginalInvoicePDF(req, res, workOrderInvoice);
    }

    // Prepare data for template
    let skuDetails = workOrderInvoice.sku_details;
    if (typeof skuDetails === "string") {
      try { skuDetails = JSON.parse(skuDetails); } catch { skuDetails = []; }
    }

    // Map skuDetails to template fields
    const items = (skuDetails || []).map((item, idx) => ({
      serial_number: idx + 1,
      item_name: item.item_name || item.sku || item.name || "",
      quantity: item.quantity || item.quantity_required || item.qty || "",
      unit_price: item.unit_price || item.rate_per_sku || item.price || "",
      tax_percentage: item.tax_percentage || item.gst || "",
      total_amount: item.total_amount || item.total_incl_gst || "",
    }));

    console.log("Mapped SKU Details:", items);

    // Get client details from different possible sources
    const clientDetails = workOrderInvoice.Client || 
                         workOrderInvoice.salesOrder?.Client || 
                         null;

    const templateData = {
      workOrderInvoice: {
        id: workOrderInvoice.id,
        invoice_number: workOrderInvoice.invoice_number,
        due_date: workOrderInvoice.due_date,
        due_date_formatted: workOrderInvoice.due_date ? new Date(workOrderInvoice.due_date).toLocaleDateString('en-IN') : '',
        client_name: clientDetails?.display_name || 
                    clientDetails?.company_name || 
                    `${clientDetails?.first_name || ''} ${clientDetails?.last_name || ''}`.trim() || 
                    workOrderInvoice.client_name || '',
        status: workOrderInvoice.status,
        total: workOrderInvoice.total || 0,
        total_tax: workOrderInvoice.total_tax || 0,
        total_amount: workOrderInvoice.total_amount || 0,
        payment_status: workOrderInvoice.payment_status || '',
        description: workOrderInvoice.description || '',
        quantity: workOrderInvoice.quantity || 0,
        discount: workOrderInvoice.discount || 0,
        discount_type: workOrderInvoice.discount_type || '',
        payment_expected_date: workOrderInvoice.payment_expected_date || '',
        transaction_type: workOrderInvoice.transaction_type || '',
        balance: workOrderInvoice.balance || 0,
      },
      workOrder: workOrderInvoice.workOrder || null,
      salesOrder: workOrderInvoice.salesOrder || null,
      // Add client details to template data
      client: clientDetails ? {
        client_id: clientDetails.client_id,
        display_name: clientDetails.display_name || '',
        first_name: clientDetails.first_name || '',
        last_name: clientDetails.last_name || '',
        full_name: `${clientDetails.first_name || ''} ${clientDetails.last_name || ''}`.trim(),
        company_name: clientDetails.company_name || '',
        email: clientDetails.email || '',
        work_phone: clientDetails.work_phone || '',
        mobile: clientDetails.mobile || '',
        customer_type: clientDetails.customer_type || '',
        salutation: clientDetails.salutation || '',
        PAN: clientDetails.PAN || '',
        gst_number: clientDetails.gst_number || '',
        client_ref_id: clientDetails.client_ref_id || ''
      } : null,
      sku_details: items, // <-- mapped for template
      current_date: new Date().toLocaleDateString('en-IN')
    };

    // Compile Handlebars template
    const template = handlebars.compile(htmlTemplate.html_template);
    const html = template(templateData);

    // Generate PDF using Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });

    await browser.close();

    // Send PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=work-order-invoice-${workOrderInvoice.invoice_number}.pdf`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);

  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    return res.status(500).json({
      success: false,
      message: `Failed to generate PDF: ${error.message}`,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
// --- Work Order Invoice HTML Preview ---
v1Router.get("/view/:id", async (req, res) => {
  try {
    const invoiceId = req.params.id;

    const workOrderInvoice = await WorkOrderInvoice.findOne({
      where: { id: invoiceId, status: "active" },
      include: [
        {
          model: WorkOrder,
          as: "workOrder",
          attributes: ["id", "work_generate_id", "sku_name", "qty", "status"],
        },
        {
          model: SalesOrder,
          as: "salesOrder",
          attributes: ["id", "sales_generate_id", "status", "client_id"],
          include: [
            {
              model: Client,
              as: "Client",
              attributes: [
                "client_id", 
                "display_name", 
                "first_name", 
                "last_name", 
                "company_name", 
                "email", 
                "work_phone", 
                "mobile", 
                "customer_type",
                "salutation",
                "PAN",
                "gst_number",
                "client_ref_id"
              ]
            }
          ]
        },
        {
          model: Client,
          as: "Client",
          attributes: [
            "client_id", 
            "display_name", 
            "first_name", 
            "last_name", 
            "company_name", 
            "email", 
            "work_phone", 
            "mobile", 
            "customer_type",
            "salutation",
            "PAN",
            "gst_number",
            "client_ref_id"
          ]
        }
      ],
    });

    if (!workOrderInvoice) {
      return res.status(404).send('<h1>Work Order Invoice not found</h1>');
    }

    let htmlTemplate = await HtmlTemplate.findOne({
      where: {
        company_id: workOrderInvoice.company_id,
        template: "work_order_invoice",
        status: "active"
      }
    });

    if (!htmlTemplate) {
      htmlTemplate = await HtmlTemplate.findOne({
        where: { template: "work_order_invoice", status: "active" },
        order: [['id', 'ASC']]
      });
    }

    if (!htmlTemplate) {
      return res.status(404).send('<h1>No HTML template found</h1>');
    }

    // Parse sku_details if it's a string
    let skuDetails = workOrderInvoice.sku_details;
    if (typeof skuDetails === "string") {
      try { 
        skuDetails = JSON.parse(skuDetails); 
      } catch { 
        skuDetails = []; 
      }
    }

    // Map skuDetails to template fields (same as download route)
    const items = (skuDetails || []).map((item, idx) => ({
      serial_number: idx + 1,
      item_name: item.item_name || item.sku || item.name || "",
      quantity: item.quantity || item.quantity_required || item.qty || "",
      unit_price: item.unit_price || item.rate_per_sku || item.price || "",
      tax_percentage: item.tax_percentage || item.gst || "",
      total_amount: item.total_amount || item.total_incl_gst || "",
    }));

    // Get client details from different possible sources
    const clientDetails = workOrderInvoice.Client || 
                         workOrderInvoice.salesOrder?.Client || 
                         null;

    const templateData = {
      workOrderInvoice: {
        id: workOrderInvoice.id,
        invoice_number: workOrderInvoice.invoice_number,
        due_date_formatted: workOrderInvoice.due_date ? new Date(workOrderInvoice.due_date).toLocaleDateString('en-IN') : '',
        client_name: clientDetails?.display_name || 
                    clientDetails?.company_name || 
                    `${clientDetails?.first_name || ''} ${clientDetails?.last_name || ''}`.trim() || 
                    workOrderInvoice.client_name || '',
        status: workOrderInvoice.status,
        total: workOrderInvoice.total || 0,
        total_tax: workOrderInvoice.total_tax || 0,
        total_amount: workOrderInvoice.total_amount || 0,
        payment_status: workOrderInvoice.payment_status || '',
        description: workOrderInvoice.description || '',
        quantity: workOrderInvoice.quantity || 0,
        discount: workOrderInvoice.discount || 0,
        discount_type: workOrderInvoice.discount_type || '',
        payment_expected_date: workOrderInvoice.payment_expected_date || '',
        transaction_type: workOrderInvoice.transaction_type || '',
        balance: workOrderInvoice.balance || 0,
      },
      workOrder: workOrderInvoice.workOrder || null,
      salesOrder: workOrderInvoice.salesOrder || null,
      client: clientDetails ? {
        client_id: clientDetails.client_id,
        display_name: clientDetails.display_name || '',
        first_name: clientDetails.first_name || '',
        last_name: clientDetails.last_name || '',
        full_name: `${clientDetails.first_name || ''} ${clientDetails.last_name || ''}`.trim(),
        company_name: clientDetails.company_name || '',
        email: clientDetails.email || '',
        work_phone: clientDetails.work_phone || '',
        mobile: clientDetails.mobile || '',
        customer_type: clientDetails.customer_type || '',
        salutation: clientDetails.salutation || '',
        PAN: clientDetails.PAN || '',
        gst_number: clientDetails.gst_number || '',
        client_ref_id: clientDetails.client_ref_id || ''
      } : null,
      sku_details: items, // <-- Now using mapped items instead of raw skuDetails
      current_date: new Date().toLocaleDateString('en-IN')
    };

    const template = handlebars.compile(htmlTemplate.html_template);
    const html = template(templateData);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    return res.status(500).send(`<h1>Error: ${error.message}</h1>`);
  }
});
// --- Render all Work Order Invoice Templates ---
v1Router.get("/templates/rendered", async (req, res) => {
  try {
    const templates = await HtmlTemplate.findAll({
      where: { template: "work_order_invoice" },
      order: [['id', 'ASC']]
    });

    if (!templates || templates.length === 0) {
      return res.status(404).send("<h1>No HTML templates found</h1>");
    }

    // Dummy data to render inside template

  // Updated sample data with correct property names
const sampleData = {
  workOrderInvoice: {
    invoice_number: "INV-2024-001",
    due_date_formatted: "12/06/2025",
    client_name: "Sample Client",
    status: "active",
    total: 1500,
    total_tax: 250,
    total_amount: 1650,
    payment_status: "pending",
    description: "Sample work order invoice",
    quantity: 100,
    discount: 5,
    discount_type: "bulk qty",
    payment_expected_date: "12/12/2025",
    transaction_type: "UPI",
    balance: 100,
  },
  workOrder: {
    work_generate_id: "WO-2024-001",
    sku_name: "60ml",
    qty: 100,
    status: "active"
  },
  salesOrder: {
    sales_generate_id: "SO-2024-001",
    status: "active"
  },
  sku_details: [
    {
      serial_number: 1,
      item_name: "60ml Bottle",           // Changed from 'sku'
      quantity: 100,                      // Changed from 'quantity_required'
      unit_price: 15,                     // Changed from 'rate_per_sku'
      tax_percentage: 12,                 // Changed from 'gst'
      total_amount: 1680                  // Changed from 'total_incl_gst'
    },
    {
      serial_number: 2,
      item_name: "30ml Bottle",
      quantity: 50,
      unit_price: 10,
      tax_percentage: 12,
      total_amount: 560
    }
  ],
  current_date: new Date().toLocaleDateString('en-IN')
};

    // Render all templates
    const renderedBlocks = templates.map((template, index) => {
      let renderedHTML = '';
      try {
        const compiled = handlebars.compile(template.html_template);
        renderedHTML = compiled(sampleData);
      } catch (err) {
        renderedHTML = `<div style="color:red;">Error rendering template ID ${template.id}: ${err.message}</div>`;
      }

      return `
        <div class="template-block">
          <div class="template-info"><strong>Template ID:</strong> ${template.id}</div>
          ${renderedHTML}
        </div>
        ${index !== templates.length - 1 ? '<hr/>' : ''}
      `;
    }).join('');

    // Final full HTML
    const html = `
      <html>
        <head>
          <title>Rendered Work Order Invoice Templates</title>
          <style>
            body { font-family: Arial, sans-serif; background: #f5f7fa; padding: 20px; }
            .template-block { margin: 40px auto; max-width: 900px; background: #fff; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 24px; }
            .template-info { margin-bottom: 10px; color: #1976d2; font-weight: bold; }
            hr { border: none; border-top: 2px solid #1976d2; margin: 40px 0; }
          </style>
        </head>
        <body>
          <h2 style="text-align:center;">All Rendered Work Order Invoice Templates</h2>
          ${renderedBlocks}
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    res.status(500).send(`<h1>Error: ${error.message}</h1>`);
  }
});
// --- Activate Work Order Invoice Template ---
v1Router.get("/activate/:id", async (req, res) => {
  const templateId = parseInt(req.params.id);

  try {
    // 1. Set the selected template to active
    await HtmlTemplate.update(
      { status: "active" },
      { where: { id: templateId, template: "work_order_invoice" } }
    );

    // 2. Set all other templates to inactive
    await HtmlTemplate.update(
      { status: "inactive" },
      { where: { id: { [Op.ne]: templateId }, template: "work_order_invoice" } }
    );

    return res.status(200).json({
      success: true,
      message: `Template ID ${templateId} activated successfully.`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while activating the template.",
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
app.use("/api/work-order-invoice", v1Router);
// await db.sequelize.sync();
const PORT = 3030;
app.listen(process.env.PORT_WORK_INVOICE, '0.0.0.0', () => {
  console.log(`Work-Invoice Service running on port ${process.env.PORT_WORK_INVOICE}`);
});
