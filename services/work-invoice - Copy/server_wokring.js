import { Op, fn, col } from "sequelize";
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
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Razorpay from 'razorpay';
import twilio from 'twilio';
import { sendEmail } from '../../common/helper/emailService.js';
import { PaymentLinkTemplate } from '../../common/services/email/templates/paymentLink.js';
import { InvoiceCreatedTemplate } from '../../common/services/email/templates/invoiceCreated.js';
// import { PaymentReceiptTemplate } from '../../common/services/email/templates/paymentReceipt.js';

// For ES6 modules, we need to recreate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_ID,
  process.env.TWILIO_AUTH_TOKEN
);

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const WorkOrderInvoice = db.WorkOrderInvoice;
const WorkOrder = db.WorkOrder;
const SalesOrder = db.SalesOrder;
const Client = db.Client;
const PartialPayment = db.PartialPayment;

/**
 * POST create new work order invoice
 * 
 * Features:
 * - Creates a new work order invoice in the database
 * - Automatically sends email with PDF attachment if client_email is provided
 * - Automatically sends WhatsApp notification if client_phone is provided
 * - Uses beautiful email template with invoice details and SKU information
 * - Uses professional WhatsApp message format with invoice links
 * - Returns detailed notification status in the response
 * 
 * Request Body:
 * - All standard invoice fields (client_name, client_email, client_phone, etc.)
 * - client_email: If provided, sends email with PDF attachment
 * - client_phone: If provided, sends WhatsApp notification
 * 
 * Response:
 * - Standard invoice creation response
 * - notifications.email: Email sending status and details
 * - notifications.whatsapp: WhatsApp sending status and details
 */
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
      client_name: invoiceDetails.client_name || null,
      client_email: invoiceDetails.client_email || null,
      client_phone: invoiceDetails.client_phone || null,
      received_amount: invoiceDetails.received_amount || 0.0,
      credit_amount: invoiceDetails.credit_amount || 0.0,
      rate_per_qty: invoiceDetails.rate_per_qty || 0.0,
      invoice_pdf: invoiceDetails.invoice_pdf || null,
    });
    
    // Create partial payment if payment status is not pending
    if (invoiceDetails.payment_status !== 'pending') {
      await PartialPayment.create({
        work_order_invoice_id: newInvoice.id,
        payment_type: "other",
        reference_number: invoice_number || null,
        amount: invoiceDetails.received_amount || 0.0,
        remarks: "Paid" || null,
        status: "completed",
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Check if client_email or client_phone is available for sending notifications
    const clientEmail = invoiceDetails.client_email;
    const clientPhone = invoiceDetails.client_phone;
    const clientName = invoiceDetails.client_name || 'Valued Customer';
    
    let emailResult = { success: false, error: null };
    let whatsappResult = { success: false, error: null };
    
    // Only send notifications if either email or phone is provided
    if (clientEmail || clientPhone) {
      try {
        // Generate PDF for attachment
        logger.info(`Generating PDF for invoice ${invoice_number} for notifications`);
        const pdfBuffer = await generateInvoicePDFBuffer({
          ...newInvoice.get({ plain: true }),
          company_id: req.user.company_id
        });
        
        // Send email with PDF attachment if client_email is available
        if (clientEmail && clientEmail.trim() !== '') {
          try {
            logger.info(`Sending invoice email to: ${clientEmail}`);
            emailResult = await sendEmailInvoice(clientEmail, clientName, newInvoice, pdfBuffer);
          } catch (emailError) {
            emailResult = { success: false, error: emailError.message };
            logger.error(`Failed to send invoice email to ${clientEmail}:`, emailError);
          }
        }
        
        // Send WhatsApp message if client_phone is available
        if (clientPhone && clientPhone.trim() !== '') {
          try {
            logger.info(`Sending WhatsApp notification to: ${clientPhone}`);
            whatsappResult = await sendWhatsAppInvoice(clientPhone, clientName, newInvoice, pdfBuffer);
          } catch (whatsappError) {
            whatsappResult = { success: false, error: whatsappError.message };
            logger.error(`Failed to send WhatsApp notification to ${clientPhone}:`, whatsappError);
          }
        }
        
      } catch (pdfError) {
        logger.error('Error generating PDF for notifications:', pdfError);
        emailResult = { success: false, error: 'PDF generation failed' };
        whatsappResult = { success: false, error: 'PDF generation failed' };
      }
    }
    
    // Prepare response with notification results
    const responseData = {
      message: "Work Order Invoice created successfully",
      data: newInvoice.get({ plain: true }),
      notifications: {
        email: {
          attempted: !!clientEmail,
          success: emailResult.success,
          recipient: clientEmail,
          error: emailResult.error
        },
        whatsapp: {
          attempted: !!clientPhone,
          success: whatsappResult.success,
          recipient: clientPhone,
          error: whatsappResult.error
        }
      }
    };
    
    // Log notification summary
    if (clientEmail || clientPhone) {
      const summary = [];
      if (clientEmail) {
        summary.push(`Email: ${emailResult.success ? 'Sent' : 'Failed'}`);
      }
      if (clientPhone) {
        summary.push(`WhatsApp: ${whatsappResult.success ? 'Sent' : 'Failed'}`);
      }
      logger.info(`Invoice ${invoice_number} notifications - ${summary.join(', ')}`);
    }
    
    res.status(201).json(responseData);
    
  } catch (error) {
    logger.error("Error creating work order invoice:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// Helper function to generate PDF buffer for email attachment
async function generateInvoicePDFBuffer(workOrderInvoice) {
  let browser;
  try {
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
      // Generate simple PDF using PDFKit as fallback
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      
      doc.fontSize(18).font('Helvetica-Bold').text('WORK ORDER INVOICE', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').text(`Invoice Number: ${workOrderInvoice.invoice_number}`, 40);
      doc.text(`Date: ${workOrderInvoice.due_date ? new Date(workOrderInvoice.due_date).toLocaleDateString() : ''}`, 40);
      doc.text(`Client: ${workOrderInvoice.client_name || 'N/A'}`, 40);
      doc.moveDown(1);
      doc.text(`Total Amount: ₹${parseFloat(workOrderInvoice.total_amount || 0).toFixed(2)}`, 40);
      
      doc.end();
      
      return new Promise((resolve) => {
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });
      });
    }

    // Parse SKU details if it's a string
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

    const templateData = {
      workOrderInvoice: {
        id: workOrderInvoice.id,
        invoice_number: workOrderInvoice.invoice_number,
        due_date: workOrderInvoice.due_date,
        due_date_formatted: workOrderInvoice.due_date ? new Date(workOrderInvoice.due_date).toLocaleDateString('en-IN') : '',
        client_name: workOrderInvoice.client_name || '',
        status: workOrderInvoice.status,
        total: workOrderInvoice.total || 0,
        total_tax: workOrderInvoice.total_tax || 0,
        total_amount: workOrderInvoice.total_amount || 0,
        payment_status: workOrderInvoice.payment_status || '',
        quantity: workOrderInvoice.quantity || 0,
        discount: workOrderInvoice.discount || 0,
        received_amount: workOrderInvoice.received_amount || 0.0,
        credit_amount: workOrderInvoice.credit_amount || 0.0,
        rate_per_qty: workOrderInvoice.rate_per_qty || 0.0,
      },
      sku_details: items,
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
    return pdf;

  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch { }
    }
    logger.error('Error generating PDF buffer:', error);
    throw error;
  }
}

// Helper function to send WhatsApp message using approved templates WITH PDF attachment
async function sendWhatsAppInvoice(clientPhone, clientName, invoiceDetails, pdfBuffer) {
  try {
    // Clean phone number (remove any non-digits and ensure it starts with country code)
    let cleanPhone = clientPhone.replace(/[^0-9]/g, '');
    
    // Add India country code if not present
    if (!cleanPhone.startsWith('91') && cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    
    const whatsappNumber = `whatsapp:+${cleanPhone}`;
    const frontendUrl = process.env.FRONTEND_URL || 'https://dev-packwork.pazl.info';
    const invoiceUrl = `${frontendUrl}/invoice/${invoiceDetails.id}`;
    
    // Create public PDF URL for WhatsApp media
    const publicPdfUrl = `${frontendUrl}/api/work-order-invoice/pdf/public/${invoiceDetails.id}`;
    
    // Format amount for display
    const formattedAmount = parseFloat(invoiceDetails.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const dueDate = invoiceDetails.due_date ? new Date(invoiceDetails.due_date).toLocaleDateString('en-IN') : 'N/A';
    
    console.log('Sending WhatsApp with PDF attachment to:', whatsappNumber);
    console.log('PDF URL:', publicPdfUrl);
    console.log('Template variables:', {
      clientName: clientName || 'Valued Customer',
      invoiceNumber: invoiceDetails.invoice_number,
      amount: formattedAmount,
      dueDate: dueDate,
      url: invoiceUrl
    });

    // Try different approaches for WhatsApp messaging with PDF
    let messageResponse;
    
    // Option 1: Send PDF as document attachment
    try {
      console.log('Attempting to send PDF as WhatsApp document');
      
      const pdfMessage = `📄 Invoice ${invoiceDetails.invoice_number}\n\nHi ${clientName || 'Customer'}!\n\nYour invoice for ₹${formattedAmount} is attached as PDF.\n\nDue Date: ${dueDate}\nView Online: ${invoiceUrl}\n\nPackWorkX Team`;
      
      messageResponse = await twilioClient.messages.create({
        body: pdfMessage,
        mediaUrl: [publicPdfUrl], // Send PDF as media attachment
        from: `whatsapp:${process.env.TWILIO_FROM_WHATSAPP_MOBILE_NUMBER}`,
        to: whatsappNumber
      });
      
      console.log('PDF sent successfully as WhatsApp document:', messageResponse.sid);
      
      logger.info(`WhatsApp invoice with PDF sent successfully to: ${whatsappNumber}, Message SID: ${messageResponse.sid}`);
      return { 
        success: true, 
        phone: whatsappNumber,
        messageId: messageResponse.sid,
        status: messageResponse.status,
        method: 'pdf_attachment'
      };
      
    } catch (pdfError) {
      console.error('Failed to send PDF as attachment:', pdfError.message);
      console.log('Falling back to text message with PDF download link');
      
      // Option 2: Fallback to text with download link
      try {
        const fallbackMessage = `Hi ${clientName || 'Customer'}! \n\nInvoice ${invoiceDetails.invoice_number} for ₹${formattedAmount} is ready.\n\nDue Date: ${dueDate}\n\n📄 Download PDF: ${publicPdfUrl}\n🌐 View Online: ${invoiceUrl}\n\nPackWorkX Team`;
        
        messageResponse = await twilioClient.messages.create({
          body: fallbackMessage,
          from: `whatsapp:${process.env.TWILIO_FROM_WHATSAPP_MOBILE_NUMBER}`,
          to: whatsappNumber
        });
        
        console.log('Fallback message sent successfully:', messageResponse.sid);
        
        logger.info(`WhatsApp invoice (fallback) sent successfully to: ${whatsappNumber}, Message SID: ${messageResponse.sid}`);
        return { 
          success: true, 
          phone: whatsappNumber,
          messageId: messageResponse.sid,
          status: messageResponse.status,
          method: 'text_with_pdf_link',
          note: 'PDF attachment failed, sent download link instead'
        };
        
      } catch (fallbackError) {
        console.error('Fallback message also failed:', fallbackError.message);
        
        // Option 3: Ultra-minimal message
        const minimalMessage = `Invoice ${invoiceDetails.invoice_number}: ₹${formattedAmount}. View: ${invoiceUrl}`;
        
        messageResponse = await twilioClient.messages.create({
          body: minimalMessage,
          from: `whatsapp:${process.env.TWILIO_FROM_WHATSAPP_MOBILE_NUMBER}`,
          to: whatsappNumber
        });
        
        console.log('Minimal message sent successfully:', messageResponse.sid);
        
        logger.info(`WhatsApp invoice (minimal) sent successfully to: ${whatsappNumber}, Message SID: ${messageResponse.sid}`);
        return { 
          success: true, 
          phone: whatsappNumber,
          messageId: messageResponse.sid,
          status: messageResponse.status,
          method: 'minimal_text',
          note: 'PDF and enhanced messages failed, sent minimal text'
        };
      }
    }

  } catch (error) {
    logger.error('Error sending WhatsApp invoice:', {
      message: error.message,
      code: error.code,
      moreInfo: error.moreInfo,
      status: error.status
    });
    throw error;
  }
}

// Helper function to send email with PDF attachment
async function sendEmailInvoice(clientEmail, clientName, invoiceDetails, pdfBuffer) {
  try {
    // Parse SKU details if needed
    let skuDetails = invoiceDetails.sku_details;
    if (typeof skuDetails === "string") {
      try { skuDetails = JSON.parse(skuDetails); } catch { skuDetails = []; }
    }

    const emailTemplate = InvoiceCreatedTemplate({
      clientName: clientName || 'Valued Customer',
      clientEmail: clientEmail,
      invoiceNumber: invoiceDetails.invoice_number,
      invoiceAmount: parseFloat(invoiceDetails.total_amount || 0),
      dueDate: invoiceDetails.due_date,
      skuDetails: skuDetails || [],
      companyName: 'PackWorkX',
      invoiceId: invoiceDetails.id,
      frontendUrl: process.env.FRONTEND_URL || 'https://dev-packwork.pazl.info'
    });

    // Prepare email attachment
    const attachments = [{
      filename: `invoice-${invoiceDetails.invoice_number}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }];

    await sendEmail(
      clientEmail,
      `Invoice ${invoiceDetails.invoice_number} - PackWorkX`,
      emailTemplate,
      attachments
    );

    logger.info(`Invoice email sent successfully to: ${clientEmail}`);
    return { success: true, email: clientEmail };

  } catch (error) {
    logger.error('Error sending invoice email:', error);
    throw error;
  }
}

// WhatsApp Debug endpoint to test configuration
v1Router.post("/debug/whatsapp", authenticateJWT, async (req, res) => {
  const { test_phone, test_message = 'Hello! This is a test WhatsApp message from PackWorkX.' } = req.body;

  if (!test_phone) {
    return res.status(400).json({ 
      message: "test_phone is required for WhatsApp debugging" 
    });
  }

  try {
    // Check environment variables
    const envCheck = {
      TWILIO_ACCOUNT_ID: !!process.env.TWILIO_ACCOUNT_ID,
      TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
      TWILIO_FROM_WHATSAPP_MOBILE_NUMBER: !!process.env.TWILIO_FROM_WHATSAPP_MOBILE_NUMBER,
      TWILIO_FROM_MOBILE_NUMBER: !!process.env.TWILIO_FROM_MOBILE_NUMBER,
    };

    console.log('Environment Variables Check:', envCheck);
    console.log('Twilio From WhatsApp Number:', process.env.TWILIO_FROM_WHATSAPP_MOBILE_NUMBER);
    console.log('Twilio From Mobile Number:', process.env.TWILIO_FROM_MOBILE_NUMBER);

    // Clean phone number
    let cleanPhone = test_phone.replace(/[^0-9]/g, '');
    if (!cleanPhone.startsWith('91') && cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const whatsappNumber = `whatsapp:+${cleanPhone}`;
    
    console.log('Original phone:', test_phone);
    console.log('Cleaned phone:', cleanPhone);
    console.log('WhatsApp number:', whatsappNumber);

    // Try to send message
    let result = { success: false, error: null, messageId: null };
    
    try {
      const messageResponse = await twilioClient.messages.create({
        body: test_message,
        from: `whatsapp:${process.env.TWILIO_FROM_WHATSAPP_MOBILE_NUMBER || process.env.TWILIO_FROM_MOBILE_NUMBER}`,
        to: whatsappNumber
      });
      
      result = {
        success: true,
        messageId: messageResponse.sid,
        status: messageResponse.status,
        direction: messageResponse.direction,
        from: messageResponse.from,
        to: messageResponse.to
      };
      
      console.log('WhatsApp message sent successfully:', messageResponse.sid);
      
    } catch (twilioError) {
      result = {
        success: false,
        error: twilioError.message,
        code: twilioError.code,
        moreInfo: twilioError.moreInfo,
        status: twilioError.status
      };
      
      console.error('Twilio WhatsApp Error:', {
        message: twilioError.message,
        code: twilioError.code,
        moreInfo: twilioError.moreInfo,
        status: twilioError.status
      });
    }

    res.status(200).json({
      message: "WhatsApp debug test completed",
      environment_check: envCheck,
      phone_processing: {
        original: test_phone,
        cleaned: cleanPhone,
        whatsapp_format: whatsappNumber
      },
      twilio_config: {
        account_id_exists: !!process.env.TWILIO_ACCOUNT_ID,
        auth_token_exists: !!process.env.TWILIO_AUTH_TOKEN,
        from_whatsapp_number: process.env.TWILIO_FROM_WHATSAPP_MOBILE_NUMBER,
        from_mobile_number: process.env.TWILIO_FROM_MOBILE_NUMBER
      },
      test_result: result,
      recommendations: [
        "1. Check if you're using Twilio WhatsApp Sandbox (limited to verified numbers)",
        "2. Verify your Twilio WhatsApp Business API is approved",
        "3. Ensure the 'from' number is a verified WhatsApp Business number",
        "4. Check if the recipient number needs to opt-in first (sandbox mode)",
        "5. Verify your Twilio account has WhatsApp messaging enabled"
      ]
    });

  } catch (error) {
    logger.error("Error in WhatsApp debug test:", error);
    res.status(500).json({
      message: "WhatsApp debug test failed",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Test endpoint specifically for PDF WhatsApp sending
v1Router.post("/test/whatsapp-pdf", authenticateJWT, async (req, res) => {
  const { test_phone, test_name = 'Test Customer' } = req.body;

  if (!test_phone) {
    return res.status(400).json({ 
      message: "test_phone is required for PDF WhatsApp testing" 
    });
  }

  try {
    // Create a sample invoice for PDF testing
    const sampleInvoice = {
      id: 'PDF-TEST-001',
      invoice_number: 'PDF-INV-001',
      total_amount: 2500.00,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      payment_status: 'pending',
      sku_details: [
        {
          item_name: 'PDF Test Product A',
          quantity: 3,
          unit_price: 500,
          total_amount: 1500
        },
        {
          item_name: 'PDF Test Product B', 
          quantity: 2,
          unit_price: 500,
          total_amount: 1000
        }
      ]
    };

    // Generate sample PDF for testing
    const pdfBuffer = await generateInvoicePDFBuffer({
      ...sampleInvoice,
      company_id: req.user.company_id,
      client_name: test_name
    });

    // Test WhatsApp PDF sending
    let whatsappResult = { success: false, error: null };
    
    try {
      whatsappResult = await sendWhatsAppInvoice(test_phone, test_name, sampleInvoice, pdfBuffer);
    } catch (error) {
      whatsappResult = { success: false, error: error.message };
    }

    res.status(200).json({
      message: "WhatsApp PDF test completed",
      test_data: {
        sample_invoice: sampleInvoice,
        test_phone,
        test_name,
        pdf_url: `${process.env.FRONTEND_URL || 'https://dev-packwork.pazl.info'}/api/work-order-invoice/pdf/public/PDF-TEST-001`
      },
      results: {
        whatsapp: {
          attempted: true,
          success: whatsappResult.success,
          method: whatsappResult.method || 'unknown',
          messageId: whatsappResult.messageId,
          note: whatsappResult.note || null,
          error: whatsappResult.error
        }
      }
    });

  } catch (error) {
    logger.error("Error in WhatsApp PDF test:", error);
    res.status(500).json({
      message: "WhatsApp PDF test failed",
      error: error.message
    });
  }
});

// Test endpoint for email and WhatsApp notifications
v1Router.post("/test/notifications", authenticateJWT, async (req, res) => {
  const { test_email, test_phone, test_name = 'Test User' } = req.body;

  if (!test_email && !test_phone) {
    return res.status(400).json({ 
      message: "Provide either test_email or test_phone to test notifications" 
    });
  }

  try {
    // Create a sample invoice data for testing
    const sampleInvoice = {
      id: 'TEST-001',
      invoice_number: 'TEST-INV-001',
      total_amount: 1500.00,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      payment_status: 'pending',
      sku_details: [
        {
          item_name: 'Test Product A',
          quantity: 2,
          unit_price: 500,
          total_amount: 1000
        },
        {
          item_name: 'Test Product B', 
          quantity: 1,
          unit_price: 500,
          total_amount: 500
        }
      ]
    };

    let emailResult = { success: false, error: null };
    let whatsappResult = { success: false, error: null };

    // Generate sample PDF for testing
    const pdfBuffer = await generateInvoicePDFBuffer({
      ...sampleInvoice,
      company_id: req.user.company_id,
      client_name: test_name
    });

    // Test email if provided
    if (test_email) {
      try {
        emailResult = await sendEmailInvoice(test_email, test_name, sampleInvoice, pdfBuffer);
      } catch (error) {
        emailResult = { success: false, error: error.message };
      }
    }

    // Test WhatsApp if provided  
    if (test_phone) {
      try {
        whatsappResult = await sendWhatsAppInvoice(test_phone, test_name, sampleInvoice, pdfBuffer);
      } catch (error) {
        whatsappResult = { success: false, error: error.message };
      }
    }

    res.status(200).json({
      message: "Notification test completed",
      test_data: {
        sample_invoice: sampleInvoice,
        test_email,
        test_phone,
        test_name
      },
      results: {
        email: {
          attempted: !!test_email,
          success: emailResult.success,
          error: emailResult.error
        },
        whatsapp: {
          attempted: !!test_phone,
          success: whatsappResult.success,
          error: whatsappResult.error
        }
      }
    });

  } catch (error) {
    logger.error("Error in notification test:", error);
    res.status(500).json({
      message: "Test failed",
      error: error.message
    });
  }
});

// Helper function to update received_amount for invoices
const updateReceivedAmountForInvoices = async (invoiceIds) => {
  try {
    // Get sum of payments for each invoice
    const paymentSums = await PartialPayment.findAll({
      attributes: [
        'work_order_invoice_id',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_received']
      ],
      where: {
        work_order_invoice_id: {
          [Op.in]: invoiceIds
        }
      },
      group: ['work_order_invoice_id'],
      raw: true
    });

    // Update each invoice with its calculated received_amount
    for (const payment of paymentSums) {
      await WorkOrderInvoice.update(
        { received_amount: payment.total_received || 0.0 },
        {
          where: {
            id: payment.work_order_invoice_id
          }
        }
      );
    }

    // Also update invoices that have no payments to 0.0
    const invoicesWithPayments = paymentSums.map(p => p.work_order_invoice_id);
    const invoicesWithoutPayments = invoiceIds.filter(id => !invoicesWithPayments.includes(id));

    if (invoicesWithoutPayments.length > 0) {
      await WorkOrderInvoice.update(
        { received_amount: 0.0 },
        {
          where: {
            id: {
              [Op.in]: invoicesWithoutPayments
            }
          }
        }
      );
    }
  } catch (error) {
    logger.error("Error updating received amounts:", error);
    // Don't throw error to avoid breaking the main API call
  }
};

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

    // Update received_amount for all fetched invoices
    const invoiceIds = rows.map(invoice => invoice.id);
    if (invoiceIds.length > 0) {
      await updateReceivedAmountForInvoices(invoiceIds);
    }

    // Re-fetch the updated data to get the latest received_amount values
    const updatedRows = await WorkOrderInvoice.findAll({
      where: {
        id: {
          [Op.in]: invoiceIds
        }
      },
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
      invoices: updatedRows.map((invoice) => {
        const plain = invoice.get({ plain: true });
        if (plain.sku_details && typeof plain.sku_details === "string") {
          try {
            plain.sku_details = JSON.parse(plain.sku_details);
          } catch (err) {
            plain.sku_details = null; // fallback if JSON invalid
          }
        }
        // Ensure default values for missing fields
        if (typeof plain.received_amount === 'undefined' || plain.received_amount === null) {
          plain.received_amount = 0.0;
        }
        if (typeof plain.credit_amount === 'undefined') {
          plain.credit_amount = 0.0;
        }
        if (typeof plain.rate_per_qty === 'undefined') {
          plain.rate_per_qty = 0.0;
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

    // Update received_amount for this specific invoice
    await updateReceivedAmountForInvoices([invoice.id]);

    // Re-fetch the invoice to get the updated received_amount
    const updatedInvoice = await WorkOrderInvoice.findOne({
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

    const result = updatedInvoice.get({ plain: true });

    if (typeof result.sku_details === "string") {
      try {
        result.sku_details = JSON.parse(result.sku_details);
      } catch (e) {
        result.sku_details = null; // fallback if parsing fails
      }
    }

    // Ensure default values for missing fields
    if (typeof result.received_amount === 'undefined' || result.received_amount === null) {
      result.received_amount = 0.0;
    }
    if (typeof result.credit_amount === 'undefined') {
      result.credit_amount = 0.0;
    }
    if (typeof result.rate_per_qty === 'undefined') {
      result.rate_per_qty = 0.0;
    }

    res.json(result);
  } catch (error) {
    logger.error("Error fetching work order invoice:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// Define your specific invoice storage path
const INVOICE_STORAGE_PATH = path.join(process.cwd(), 'public', 'invoice');

// Updated generateOriginalInvoicePDF function
async function generateOriginalInvoicePDF(req, res, workOrderInvoice) {
  try {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    const fileName = `work-order-invoice-${workOrderInvoice.invoice_number}.pdf`;

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    // Create a buffer to store the PDF data
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    // Generate PDF content
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

    // Handle PDF completion
    doc.on('end', async () => {
      const pdfData = Buffer.concat(buffers);

      // Use your specific path
      const fullFilePath = path.join(INVOICE_STORAGE_PATH, fileName);

      try {
        // Create directory if it doesn't exist
        await fs.mkdir(INVOICE_STORAGE_PATH, { recursive: true });

        // Save PDF to file
        await fs.writeFile(fullFilePath, pdfData);

        console.log(`PDF saved successfully at: ${fullFilePath}`);

        // Store the full path in database
        await WorkOrderInvoice.update(
          { invoice_pdf: fullFilePath },
          { where: { id: workOrderInvoice.id } }
        );

        console.log(`Database updated with PDF path: ${fullFilePath}`);

      } catch (saveError) {
        console.error('Error saving PDF to directory or updating database:', saveError);
        // Continue with response even if saving fails
      }
    });

    // Stream PDF to response
    doc.pipe(res);
    doc.end();

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to generate fallback PDF: ${error.message}`
    });
  }
}

// Updated main download route
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
        received_amount: workOrderInvoice.received_amount || 0.0,
        credit_amount: workOrderInvoice.credit_amount || 0.0,
        rate_per_qty: workOrderInvoice.rate_per_qty || 0.0,
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
      sku_details: items,
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

    // Save PDF to your specific directory
    const fileName = `work-order-invoice-${workOrderInvoice.invoice_number}.pdf`;
    const fullFilePath = path.join(INVOICE_STORAGE_PATH, fileName);

    try {
      // Create directory if it doesn't exist
      await fs.mkdir(INVOICE_STORAGE_PATH, { recursive: true });

      // Save PDF to file
      await fs.writeFile(fullFilePath, pdf);

      console.log(`PDF saved successfully at: ${fullFilePath}`);

      // Store the full path in database
      await WorkOrderInvoice.update(
        { invoice_pdf: fullFilePath },
        { where: { id: workOrderInvoice.id } }
      );

      console.log(`Database updated with PDF path: ${fullFilePath}`);

    } catch (saveError) {
      console.error('Error saving PDF to directory or updating database:', saveError);
      // Continue with response even if saving fails
    }

    // Send PDF response (original functionality)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);

  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch { }
    }
    return res.status(500).json({
      success: false,
      message: `Failed to generate PDF: ${error.message}`,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Add public PDF endpoint (no authentication required for WhatsApp access)
v1Router.get("/pdf/public/:id", async (req, res) => {
  try {
    const invoiceId = req.params.id;
    
    // Find the invoice (no auth check for public PDF access)
    const workOrderInvoice = await WorkOrderInvoice.findOne({
      where: { id: invoiceId, status: "active" },
      attributes: ["id", "invoice_number", "invoice_pdf"]
    });

    if (!workOrderInvoice || !workOrderInvoice.invoice_pdf) {
      return res.status(404).json({
        success: false,
        message: "PDF not found"
      });
    }

    // Use the stored full path directly
    const fullPath = workOrderInvoice.invoice_pdf;

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: "PDF file not found on server"
      });
    }

    // Get file stats for content length
    const stats = await fs.stat(fullPath);

    // Set headers for public access
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `inline; filename=invoice-${workOrderInvoice.invoice_number}.pdf`);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow public access
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Stream the file
    const fileStream = require('fs').createReadStream(fullPath);
    fileStream.pipe(res);

  } catch (error) {
    logger.error("Error serving public PDF:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// Updated PDF serving endpoint
v1Router.get("/pdf/:id", authenticateJWT, async (req, res) => {
  try {
    const invoiceId = req.params.id;

    // Find the invoice with the stored PDF path
    const workOrderInvoice = await WorkOrderInvoice.findOne({
      where: {
        id: invoiceId,
        company_id: req.user.company_id,
        status: "active"
      },
      attributes: ["id", "invoice_number", "invoice_pdf"]
    });

    if (!workOrderInvoice) {
      return res.status(404).json({
        success: false,
        message: "Work Order Invoice not found"
      });
    }

    if (!workOrderInvoice.invoice_pdf) {
      return res.status(404).json({
        success: false,
        message: "PDF file not found for this invoice"
      });
    }

    // Use the stored full path directly
    const fullPath = workOrderInvoice.invoice_pdf;

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: "PDF file not found on server",
        path: fullPath
      });
    }

    // Get file stats for content length
    const stats = await fs.stat(fullPath);

    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `inline; filename=work-order-invoice-${workOrderInvoice.invoice_number}.pdf`);

    // Stream the file
    const fileStream = require('fs').createReadStream(fullPath);
    fileStream.pipe(res);

  } catch (error) {
    logger.error("Error serving PDF file:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
});

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
        received_amount: workOrderInvoice.received_amount || 0.0,
        credit_amount: workOrderInvoice.credit_amount || 0.0,
        rate_per_qty: workOrderInvoice.rate_per_qty || 0.0, // <-- Added
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
        received_amount: 0.0,
        credit_amount: 0.0,
        rate_per_qty: 0.0, // <-- Added
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
<div style="display: flex; gap: 20px; align-items: center;">
            <div class="template-info"><strong>Template ID:</strong> ${template.id}</div>
            <div class="template-info">
              <strong>Template Status:</strong>
              <span style="color: ${template.status === "active" ? "green" : "red"};">
                ${template.status === "active" ? "Active" : "Inactive"}
              </span>
            </div>          
          </div>          ${renderedHTML}
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

// POST create new partial payment
v1Router.post("/partial-payment/create", authenticateJWT, async (req, res) => {
  const {
    work_order_invoice_id,
    payment_type,
    reference_number,
    amount,
    remarks,
    status
  } = req.body;

  if (!work_order_invoice_id || !payment_type || !amount) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Fetch total invoice amount
    const invoice = await WorkOrderInvoice.findOne({
      where: { id: work_order_invoice_id },
      attributes: ["total_amount"]
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const totalInvoiceAmount = parseFloat(invoice.total_amount);

    // Get total paid amount so far
    const paid = await PartialPayment.findOne({
      where: { work_order_invoice_id },
      attributes: [[sequelize.fn("SUM", sequelize.col("amount")), "total_paid"]],
      raw: true
    });

    const totalPaid = parseFloat(paid.total_paid) || 0;
    const newTotalPaid = totalPaid + parseFloat(amount);

    if (newTotalPaid > totalInvoiceAmount) {
      return res.status(400).json({ message: "Trying to overpay the invoice" });
    }

    // Determine updated payment status
    let paymentStatus = "partial";
    if (newTotalPaid === totalInvoiceAmount) {
      paymentStatus = "paid";
    }

    // Create new partial payment
    const newPartialPayment = await PartialPayment.create({
      work_order_invoice_id,
      payment_type,
      reference_number: reference_number || null,
      amount,
      remarks: remarks || null,
      status: status || "completed",
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Update invoice with new received amount and payment status
    await WorkOrderInvoice.update(
      {
        received_amount: sequelize.literal(`received_amount + ${amount}`),
        updated_at: new Date(),
        payment_status: paymentStatus
      },
      { where: { id: work_order_invoice_id } }
    );

    return res.status(201).json({
      message: "Partial payment created successfully",
      data: newPartialPayment
    });

  } catch (error) {
    logger.error("Error creating partial payment:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

v1Router.get("/partial-payment/status/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const partialPayments = await PartialPayment.findAll({
      where: { work_order_invoice_id: id },
      attributes: [
        "id", "payment_type", "reference_number", "amount", "remarks", "status", "created_at", "updated_at"
      ],
      order: [['created_at', 'DESC']],
    });
    
    res.status(200).json({
      message: "Payment history retrieved successfully",
      data: partialPayments
    });
  } catch (error) {
    logger.error("Error fetching payment history:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// GET comprehensive payment status for an invoice
v1Router.get("/payment/status/:invoiceId", authenticateJWT, async (req, res) => {
  const { invoiceId } = req.params;
  
  try {
    // Fetch invoice details
    const invoice = await WorkOrderInvoice.findOne({
      where: {
        id: invoiceId,
        company_id: req.user.company_id,
        status: 'active'
      },
      attributes: [
        'id', 'invoice_number', 'total_amount', 'received_amount', 
        'payment_status', 'due_date', 'created_at', 'updated_at'
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found",
        success: false
      });
    }

    // Fetch all payments for this invoice
    const payments = await PartialPayment.findAll({
      where: { work_order_invoice_id: invoiceId },
      attributes: [
        "id", "payment_type", "reference_number", "amount", 
        "remarks", "status", "created_at", "updated_at"
      ],
      order: [['created_at', 'DESC']]
    });

    // Calculate payment summary
    const totalPaid = payments.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount || 0);
    }, 0);

    const totalAmount = parseFloat(invoice.total_amount || 0);
    const remainingAmount = totalAmount - totalPaid;
    const isFullyPaid = remainingAmount <= 0;
    const isPartiallyPaid = totalPaid > 0 && remainingAmount > 0;

    // Payment status summary
    const paymentSummary = {
      total_amount: totalAmount,
      total_paid: totalPaid,
      remaining_amount: Math.max(0, remainingAmount),
      payment_percentage: totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0,
      is_fully_paid: isFullyPaid,
      is_partially_paid: isPartiallyPaid,
      is_overdue: invoice.due_date ? new Date(invoice.due_date) < new Date() && !isFullyPaid : false,
      payment_count: payments.length,
      last_payment_date: payments.length > 0 ? payments[0].created_at : null
    };

    res.status(200).json({
      message: "Payment status retrieved successfully",
      success: true,
      data: {
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          total_amount: invoice.total_amount,
          received_amount: invoice.received_amount,
          payment_status: invoice.payment_status,
          due_date: invoice.due_date,
          created_at: invoice.created_at,
          updated_at: invoice.updated_at
        },
        payment_summary: paymentSummary,
        payments: payments.map(payment => ({
          id: payment.id,
          payment_type: payment.payment_type,
          reference_number: payment.reference_number,
          amount: parseFloat(payment.amount || 0),
          remarks: payment.remarks,
          status: payment.status,
          created_at: payment.created_at,
          updated_at: payment.updated_at,
          formatted_amount: `₹${parseFloat(payment.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          formatted_date: new Date(payment.created_at).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }))
      }
    });

  } catch (error) {
    logger.error("Error fetching comprehensive payment status:", error);
    res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message
    });
  }
});

// Utility function to detect if input is email or mobile number
const detectContactType = (input) => {
  // Email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Mobile number regex pattern (supports various formats)
  const mobileRegex = /^[+]?[0-9]{10,15}$/;

  // Remove any spaces and special characters for mobile detection
  const cleanInput = input.replace(/[\s()-]/g, '');

  if (emailRegex.test(input)) {
    return { type: 'email', value: input.trim() };
  } else if (mobileRegex.test(cleanInput)) {
    // Remove country code if present and ensure it's 10 digits for Indian numbers
    let mobileNumber = cleanInput;
    if (mobileNumber.startsWith('+91')) {
      mobileNumber = mobileNumber.substring(3);
    } else if (mobileNumber.startsWith('91') && mobileNumber.length === 12) {
      mobileNumber = mobileNumber.substring(2);
    }
    return { type: 'mobile', value: mobileNumber };
  } else {
    return { type: 'invalid', value: null };
  }
};

// POST send payment link (Main Razorpay Integration)
v1Router.post("/send/payment/link", authenticateJWT, async (req, res) => {
  const { id, emailOrMobileNumber, amount } = req.body;

  // Validate required fields
  if (!id) {
    return res.status(400).json({
      message: "Invoice ID is required",
      success: false
    });
  }

  if (!emailOrMobileNumber) {
    return res.status(400).json({
      message: "Email or mobile number is required",
      success: false
    });
  }

  // Detect if input is email or mobile number
  const contactInfo = detectContactType(emailOrMobileNumber);

  if (contactInfo.type === 'invalid') {
    return res.status(400).json({
      message: "Invalid email or mobile number format",
      success: false
    });
  }
  console.log("Before query");
  
  // Check required environment variables
  console.log("Environment check:", {
    razorpay_key_id: !!process.env.RAZORPAY_KEY_ID,
    razorpay_key_secret: !!process.env.RAZORPAY_KEY_SECRET,
    twilio_account_id: !!process.env.TWILIO_ACCOUNT_ID,
    twilio_auth_token: !!process.env.TWILIO_AUTH_TOKEN,
    twilio_from_number: !!process.env.TWILIO_FROM_MOBILE_NUMBER,
    frontend_url: !!process.env.FRONTEND_URL
  });
  
  try {
    console.log("Before database query - Invoice ID:", id, "Company ID:", req.user.company_id);
    
    // Fetch invoice details with client information
    const invoice = await WorkOrderInvoice.findOne({
      where: {
        id: id,
        company_id: req.user.company_id,
        status: 'active'
      },
      include: [
        {
          model: Client,
          as: "Client",
          attributes: [
            "client_id", "display_name", "first_name", "last_name",
            "company_name", "email", "work_phone", "mobile"
          ]
        }
      ]
    });
    
    console.log("Invoice found:", !!invoice);
    if (invoice) {
      console.log("Invoice details:", {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount,
        client_id: invoice.client_id,
        has_client: !!invoice.Client
      });
    }
   

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found",
        success: false
      });
    }

    // Parse SKU details if it's a string
    let skuDetails = invoice.sku_details;
    console.log("SKU details type:", typeof skuDetails);
    console.log("SKU details value:", skuDetails);
     
    if (typeof skuDetails === "string") {
      try {
        skuDetails = JSON.parse(skuDetails);
        console.log("Parsed SKU details:", skuDetails);
      } catch {
        console.log("Failed to parse SKU details, using empty array");
        skuDetails = [];
      }
    }

    // Determine payment amount (use provided amount or invoice total)
    const paymentAmount = amount || invoice.total_amount || 0;
    const amountInPaise = Math.round(parseFloat(paymentAmount) * 100); // Convert to paise
    
    console.log("Payment amount:", paymentAmount, "Amount in paise:", amountInPaise);

    // Get client details
    const clientName = invoice.Client?.display_name ||
      invoice.Client?.company_name ||
      `${invoice.Client?.first_name || ''} ${invoice.Client?.last_name || ''}`.trim() ||
      invoice.client_name ||
      'Valued Customer';
      
    console.log("Client name:", clientName);

    // Determine email and mobile based on input type and database fallback
    let clientEmail = null;
    let clientMobile = null;

    if (contactInfo.type === 'email') {
      clientEmail = contactInfo.value;
      // Try to get mobile from database if available
      clientMobile = invoice.Client?.mobile || invoice.client_phone;
    } else if (contactInfo.type === 'mobile') {
      clientMobile = contactInfo.value;
      // Try to get email from database if available
      clientEmail = invoice.Client?.email || invoice.client_email;
    }
    
    console.log("Contact info - Type:", contactInfo.type, "Email:", clientEmail, "Mobile:", clientMobile);

    // Create Razorpay payment link
    console.log("Creating Razorpay payment link with data:", {
      amount: amountInPaise,
      currency: 'INR',
      description: `Payment for Invoice ${invoice.invoice_number}`,
      customerName: clientName,
      customerEmail: clientEmail,
      customerContact: clientMobile ? `+91${clientMobile}` : undefined
    });
    
    const paymentLinkData = {
      amount: amountInPaise,
      currency: 'INR',
      accept_partial: false,
      description: `Payment for Invoice ${invoice.invoice_number}`,
      customer: {
        name: clientName,
        email: clientEmail,
        contact: clientMobile ? `+91${clientMobile}` : undefined
      },
      notify: {
        sms: !!clientMobile,
        email: !!clientEmail
      },
      reminder_enable: true,
      notes: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        company_id: req.user.company_id
      },
      callback_url: `${req.protocol}://${req.get('host')}/api/work-order-invoice/payment/callback?invoice_id=${invoice.id}`,
      callback_method: 'get'
    };
    
    console.log("About to create Razorpay payment link...");
    
    // Check if Razorpay is properly initialized
    if (!razorpay) {
      throw new Error("Razorpay client not initialized. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.");
    }
    
    console.log("Razorpay client status:", !!razorpay);
    console.log("Razorpay key_id (first 10 chars):", process.env.RAZORPAY_KEY_ID?.substring(0, 10) + '...');
    
    let paymentLink;
    try {
      paymentLink = await razorpay.paymentLink.create(paymentLinkData);
      console.log("Razorpay payment link created successfully:", paymentLink.id);
    } catch (razorpayError) {
      console.error("Razorpay API Error Details:", {
        message: razorpayError.message,
        statusCode: razorpayError.statusCode,
        error: razorpayError.error,
        description: razorpayError.description,
        code: razorpayError.code,
        source: razorpayError.source,
        step: razorpayError.step,
        reason: razorpayError.reason,
        field: razorpayError.field
      });
      
      // Re-throw with more specific message
      if (razorpayError.statusCode === 400) {
        throw new Error(`Razorpay API Error (400): ${razorpayError.error?.description || razorpayError.message || 'Invalid request parameters. Check your Razorpay API credentials and request data.'}`);
      } else if (razorpayError.statusCode === 401) {
        throw new Error(`Razorpay Authentication Error (401): Invalid API credentials. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.`);
      } else {
        throw new Error(`Razorpay API Error (${razorpayError.statusCode || 'Unknown'}): ${razorpayError.message || 'Unknown error occurred'}`);
      }
    }

    let emailSent = false;
    let smsSent = false;
    let emailError = null;
    let smsError = null;

    // Send email if email address is available
    if (clientEmail) {
      console.log("Attempting to send email to:", clientEmail);
      try {
        const emailTemplate = PaymentLinkTemplate({
          clientName,
          clientEmail,
          invoiceNumber: invoice.invoice_number,
          invoiceAmount: paymentAmount,
          skuDetails: skuDetails || [],
          paymentLink: paymentLink.short_url,
          dueDate: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-IN') : null,
          companyName: 'PackWorkX'
        });

        await sendEmail(
          clientEmail,
          `Payment Request - Invoice ${invoice.invoice_number}`,
          emailTemplate
        );

        emailSent = true;
        console.log("Email sent successfully to:", clientEmail);
        logger.info(`Payment link email sent successfully to: ${clientEmail}`);
      } catch (error) {
        emailError = error.message;
        console.error("Email sending failed:", error.message, error.stack);
        logger.error(`Failed to send payment link email to: ${clientEmail}`, error);
      }
    } else {
      console.log("No email address available for sending");
    }

    // Send SMS if mobile number is available
    if (clientMobile) {
      console.log("Attempting to send SMS to:", `+91${clientMobile}`);
      try {
        const smsMessage = `Hi ${clientName}, Payment link for Invoice ${invoice.invoice_number} (₹${parseFloat(paymentAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}): ${paymentLink.short_url}\n\nPackWorkX Team`;
        console.log("SMS message:", smsMessage);

        await twilioClient.messages.create({
          body: smsMessage,
          from: process.env.TWILIO_FROM_MOBILE_NUMBER,
          to: `+91${clientMobile}`
        });

        smsSent = true;
        console.log("SMS sent successfully to:", `+91${clientMobile}`);
        logger.info(`Payment link SMS sent successfully to: +91${clientMobile}`);
      } catch (error) {
        smsError = error.message;
        console.error("SMS sending failed:", error.message, error.stack);
        logger.error(`Failed to send payment link SMS to: +91${clientMobile}`, error);
      }
    } else {
      console.log("No mobile number available for sending SMS");
    }

    // Prepare response
    console.log("Preparing response with results - Email sent:", emailSent, "SMS sent:", smsSent);
    
    const responseData = {
      paymentLink: {
        id: paymentLink.id,
        short_url: paymentLink.short_url,
        amount: paymentAmount,
        currency: 'INR',
        status: paymentLink.status
      },
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount,
        client_name: clientName
      },
      contactInfo: {
        inputType: contactInfo.type,
        inputValue: contactInfo.value,
        emailUsed: clientEmail,
        mobileUsed: clientMobile
      },
      notifications: {
        email: {
          sent: emailSent,
          recipient: clientEmail,
          error: emailError
        },
        sms: {
          sent: smsSent,
          recipient: clientMobile ? `+91${clientMobile}` : null,
          error: smsError
        }
      }
    };

    // Determine overall success
    const overallSuccess = (clientEmail ? emailSent : true) && (clientMobile ? smsSent : true);

    res.status(201).json({
      message: overallSuccess
        ? "Payment link created and sent successfully"
        : "Payment link created with some notification failures",
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error("Full error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    });
    
    logger.error("Error creating/sending payment link:", error);
    
    // Provide specific error messages based on error type
    let errorMessage = "Internal Server Error";
    let statusCode = 500;
    
    if (error.message?.includes('Authentication failed') || error.message?.includes('Invalid API key')) {
      errorMessage = "Payment gateway configuration error. Please check Razorpay credentials.";
      statusCode = 500;
    } else if (error.message?.includes('SMTP') || error.message?.includes('Email')) {
      errorMessage = "Email configuration error. Please check SMTP settings.";
      statusCode = 500;
    } else if (error.message?.includes('Twilio') || error.message?.includes('SMS')) {
      errorMessage = "SMS configuration error. Please check Twilio settings.";
      statusCode = 500;
    } else if (error.name === 'SequelizeConnectionError') {
      errorMessage = "Database connection error.";
      statusCode = 500;
    }
    
    res.status(statusCode).json({
      message: errorMessage,
      success: false,
      error: error.message,
      debug: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        stack: error.stack,
        code: error.code
      } : undefined
    });
  }
});

// GET payment link status
v1Router.get("/payment/link/status/:paymentLinkId", authenticateJWT, async (req, res) => {
  const { paymentLinkId } = req.params;

  try {
    const paymentLink = await razorpay.paymentLink.fetch(paymentLinkId);

    res.status(200).json({
      message: "Payment link status fetched successfully",
      success: true,
      data: {
        id: paymentLink.id,
        status: paymentLink.status,
        amount: paymentLink.amount / 100, // Convert from paise to rupees
        currency: paymentLink.currency,
        short_url: paymentLink.short_url,
        created_at: paymentLink.created_at,
        paid_at: paymentLink.paid_at,
        cancelled_at: paymentLink.cancelled_at
      }
    });
  } catch (error) {
    logger.error("Error fetching payment link status:", error);
    res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message
    });
  }
});

// POST retry payment for an invoice
v1Router.post("/payment/retry/:invoiceId", authenticateJWT, async (req, res) => {
  const { invoiceId } = req.params;
  const { emailOrMobileNumber, amount } = req.body;

  try {
    // Fetch invoice details
    const invoice = await WorkOrderInvoice.findOne({
      where: {
        id: invoiceId,
        company_id: req.user.company_id,
        status: 'active'
      },
      include: [{
        model: Client,
        as: "Client",
        attributes: [
          "client_id", "display_name", "first_name", "last_name",
          "company_name", "email", "work_phone", "mobile"
        ]
      }]
    });

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found",
        success: false
      });
    }

    // Calculate remaining amount
    const remainingAmount = parseFloat(invoice.total_amount) - parseFloat(invoice.received_amount || 0);
    
    if (remainingAmount <= 0) {
      return res.status(400).json({
        message: "This invoice is already fully paid",
        success: false
      });
    }

    // Use the remaining amount or provided amount (whichever is smaller)
    const paymentAmount = amount ? Math.min(parseFloat(amount), remainingAmount) : remainingAmount;
    const amountInPaise = Math.round(paymentAmount * 100);

    // Get client details
    const clientName = invoice.Client?.display_name ||
      invoice.Client?.company_name ||
      `${invoice.Client?.first_name || ''} ${invoice.Client?.last_name || ''}`.trim() ||
      invoice.client_name ||
      'Valued Customer';

    // Determine contact details
    let clientEmail = emailOrMobileNumber && emailOrMobileNumber.includes('@') ? emailOrMobileNumber : invoice.Client?.email;
    let clientMobile = emailOrMobileNumber && !emailOrMobileNumber.includes('@') ? emailOrMobileNumber : invoice.Client?.mobile;

    // Create new payment link
    const paymentLinkData = {
      amount: amountInPaise,
      currency: 'INR',
      accept_partial: false,
      description: `Retry Payment for Invoice ${invoice.invoice_number}`,
      customer: {
        name: clientName,
        email: clientEmail,
        contact: clientMobile ? `+91${clientMobile}` : undefined
      },
      notify: {
        sms: !!clientMobile,
        email: !!clientEmail
      },
      reminder_enable: true,
      notes: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        company_id: req.user.company_id,
        retry_payment: 'true'
      },
      callback_url: `${req.protocol}://${req.get('host')}/api/work-order-invoice/payment/callback?invoice_id=${invoice.id}`,
      callback_method: 'get'
    };

    const paymentLink = await razorpay.paymentLink.create(paymentLinkData);

    logger.info(`Retry payment link created for invoice ${invoice.invoice_number}: ${paymentLink.short_url}`);

    res.status(201).json({
      message: "Retry payment link created successfully",
      success: true,
      data: {
        paymentLink: {
          id: paymentLink.id,
          short_url: paymentLink.short_url,
          amount: paymentAmount,
          currency: 'INR',
          status: paymentLink.status
        },
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          total_amount: invoice.total_amount,
          received_amount: invoice.received_amount || 0,
          remaining_amount: remainingAmount,
          client_name: clientName
        }
      }
    });

  } catch (error) {
    logger.error("Error creating retry payment link:", error);
    res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message
    });
  }
});

// GET payment callback URL handler (for redirects from Razorpay)
v1Router.get("/payment/callback", async (req, res) => {
  try {
    const {
      invoice_id,
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
      razorpay_signature
    } = req.query;

    logger.info('Payment callback received:', {
      invoice_id,
      payment_id: razorpay_payment_id,
      payment_link_id: razorpay_payment_link_id,
      status: razorpay_payment_link_status
    });

    // Check if required parameters are present
    if (!invoice_id) {
      return res.status(400).send('<h1>Error: Invoice ID missing from callback</h1>');
    }

    // Fetch invoice details
    const invoice = await WorkOrderInvoice.findOne({
      where: { id: invoice_id, status: 'active' },
      attributes: ['id', 'invoice_number', 'total_amount', 'company_id', 'received_amount']
    });

    if (!invoice) {
      return res.status(404).send('<h1>Error: Invoice not found</h1>');
    }

    let templateData = {
      invoiceNumber: invoice.invoice_number,
      amount: parseFloat(invoice.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      paymentId: razorpay_payment_id || 'N/A',
      paymentMethod: 'Online Payment',
      transactionDate: new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      attemptDate: new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    // Check payment status and handle accordingly
    if (razorpay_payment_link_status === 'paid' && razorpay_payment_id) {
      // Payment successful
      try {
        // Check if this payment has already been processed
        const existingPayment = await PartialPayment.findOne({
          where: {
            reference_number: razorpay_payment_id,
            work_order_invoice_id: invoice_id
          }
        });

        if (!existingPayment) {
          // Get payment amount - fetch from Razorpay or use invoice amount
          let paymentAmount = invoice.total_amount;
          
          try {
            // Try to fetch payment details from Razorpay
            const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
            paymentAmount = paymentDetails.amount / 100; // Convert from paise
            
            logger.info(`Fetched payment details from Razorpay: ${paymentAmount}`);
          } catch (razorpayError) {
            logger.warn('Could not fetch payment details from Razorpay, using invoice amount:', razorpayError.message);
          }

          // Create payment record
          await PartialPayment.create({
            work_order_invoice_id: invoice_id,
            payment_type: 'online',
            reference_number: razorpay_payment_id,
            amount: paymentAmount,
            remarks: `Payment via Razorpay Payment Link - ${razorpay_payment_link_id}`,
            status: 'completed',
            created_at: new Date(),
            updated_at: new Date()
          });

          // Calculate total received amount
          const totalReceived = parseFloat(invoice.received_amount || 0) + parseFloat(paymentAmount);
          const invoiceTotal = parseFloat(invoice.total_amount);
          
          // Determine payment status
          let paymentStatus = 'partial';
          if (totalReceived >= invoiceTotal) {
            paymentStatus = 'paid';
          }

          // Update invoice status
          await WorkOrderInvoice.update({
            payment_status: paymentStatus,
            received_amount: totalReceived,
            updated_at: new Date()
          }, {
            where: { id: invoice_id }
          });

          logger.info(`Payment processed successfully for invoice ${invoice.invoice_number}: ₹${paymentAmount}`);
        } else {
          logger.info(`Payment ${razorpay_payment_id} already processed for invoice ${invoice.invoice_number}`);
        }

        // Serve success page
        const successHtml = await fs.readFile(
          path.join(__dirname, '../../public/payment-callback/success.html'),
          'utf8'
        );
        
        // Replace template variables
        let finalHtml = successHtml
          .replace(/{{invoiceNumber}}/g, templateData.invoiceNumber)
          .replace(/{{amount}}/g, templateData.amount)
          .replace(/{{paymentId}}/g, templateData.paymentId)
          .replace(/{{paymentMethod}}/g, templateData.paymentMethod)
          .replace(/{{transactionDate}}/g, templateData.transactionDate)
          .replace(/{{frontendUrl}}/g, process.env.FRONTEND_URL || 'https://dev-packwork.pazl.info')
          .replace(/{{invoiceId}}/g, invoice_id);

        res.setHeader('Content-Type', 'text/html');
        return res.send(finalHtml);

      } catch (dbError) {
        logger.error('Database error during payment processing:', dbError);
        // Still show success to user, but log the error
        const successHtml = await fs.readFile(
          path.join(__dirname, '../../public/payment-callback/success.html'),
          'utf8'
        );
        
        let finalHtml = successHtml
          .replace(/{{invoiceNumber}}/g, templateData.invoiceNumber)
          .replace(/{{amount}}/g, templateData.amount)
          .replace(/{{paymentId}}/g, templateData.paymentId)
          .replace(/{{paymentMethod}}/g, templateData.paymentMethod)
          .replace(/{{transactionDate}}/g, templateData.transactionDate)
          .replace(/{{frontendUrl}}/g, process.env.FRONTEND_URL || 'https://dev-packwork.pazl.info')
          .replace(/{{invoiceId}}/g, invoice_id);

        res.setHeader('Content-Type', 'text/html');
        return res.send(finalHtml);
      }
    } else {
      // Payment failed or cancelled
      logger.warn(`Payment failed or cancelled for invoice ${invoice.invoice_number}:`, {
        status: razorpay_payment_link_status,
        payment_id: razorpay_payment_id
      });

      const failureHtml = await fs.readFile(
        path.join(__dirname, '../../public/payment-callback/failure.html'),
        'utf8'
      );
      
      // Replace template variables
      let finalHtml = failureHtml
        .replace(/{{invoiceNumber}}/g, templateData.invoiceNumber)
        .replace(/{{amount}}/g, templateData.amount)
        .replace(/{{attemptDate}}/g, templateData.attemptDate)
        .replace(/{{frontendUrl}}/g, process.env.FRONTEND_URL || 'https://dev-packwork.pazl.info')
        .replace(/{{invoiceId}}/g, invoice_id);

      res.setHeader('Content-Type', 'text/html');
      return res.send(finalHtml);
    }

  } catch (error) {
    logger.error('Error in payment callback:', error);
    res.status(500).send(`
      <h1>Payment Processing Error</h1>
      <p>An error occurred while processing your payment callback.</p>
      <p>Please contact support if you believe your payment was successful.</p>
      <p>Error: ${error.message}</p>
    `);
  }
});

// POST webhook to handle Razorpay payment updates
v1Router.post("/payment/webhook", async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify webhook signature (optional but recommended)
    if (webhookSecret) {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (expectedSignature !== webhookSignature) {
        return res.status(400).json({ message: 'Invalid webhook signature' });
      }
    }

    const { event, payload } = req.body;

    // Handle payment link events
    if (event === 'payment_link.paid') {
      const paymentLink = payload.payment_link.entity;
      const notes = paymentLink.notes;

      if (notes && notes.invoice_id) {
        // Check if this payment has already been processed
        const existingPayment = await PartialPayment.findOne({
          where: {
            reference_number: paymentLink.id,
            work_order_invoice_id: notes.invoice_id
          }
        });

        if (!existingPayment) {
          // Update invoice payment status
          await WorkOrderInvoice.update(
            {
              payment_status: 'paid',
              received_amount: sequelize.literal(`received_amount + ${paymentLink.amount / 100}`),
              updated_at: new Date()
            },
            { where: { id: notes.invoice_id } }
          );

          // Create payment record
          await PartialPayment.create({
            work_order_invoice_id: notes.invoice_id,
            payment_type: 'online',
            reference_number: paymentLink.id,
            amount: paymentLink.amount / 100,
            remarks: `Payment via Razorpay Payment Link - ${paymentLink.id}`,
            status: 'completed',
            created_at: new Date(),
            updated_at: new Date()
          });

          logger.info(`Payment completed via webhook for invoice ID: ${notes.invoice_id}, Amount: ${paymentLink.amount / 100}`);
        } else {
          logger.info(`Payment ${paymentLink.id} already processed via webhook`);
        }
      }
    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    logger.error("Error processing payment webhook:", error);
    res.status(500).json({ message: "Webhook processing failed", error: error.message });
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

// Start the server
const PORT = 3030;
app.listen(process.env.PORT_WORK_INVOICE, '0.0.0.0', () => {
  console.log(`Work-Invoice Service running on port ${process.env.PORT_WORK_INVOICE}`);
});
