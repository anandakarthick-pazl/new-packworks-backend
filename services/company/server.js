import express, { json, Router } from "express";
import cors from "cors";
dotenv.config();
import db from "../../common/models/index.js";
import User from "../../common/models/user.model.js";
import UserAuth from "../../common/models/userAuth.model.js";
import {
  authenticateJWT,
  authenticateStaticToken,
} from "../../common/middleware/auth.js";
import { validateCompany } from "../../common/inputvalidation/validateCompany.js";
import amqp from "amqplib";
import sequelize from "../../common/database/database.js";
import dotenv from "dotenv";
import { logRequestResponse } from "../../common/middleware/errorLogger.js";
import logger from "../../common/helper/logger.js";
import emailService from "../../common/services/email/emailService.js";
import bcrypt from "bcryptjs";

// Add these imports to your existing companies service file
import Razorpay from "razorpay";
import twilio from "twilio";
import { sendEmail } from "../../common/helper/emailService.js";
import { PaymentLinkTemplate } from "../../common/services/email/templates/paymentLink.js";
import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Op } from "sequelize";

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();
const RABBITMQ_URL = process.env.RABBITMQ_URL; // Update if needed
const QUEUE_NAME = process.env.COMPANY_QUEUE_NAME;
const Package = db.Package;
const CompanyPaymentBill = db.CompanyPaymentBill;
const Company = db.Company;

app.use(logRequestResponse);

// For ES6 modules, we need to recreate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
// Utility function to detect if input is email or mobile number
const detectContactType = (input) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const mobileRegex = /^[+]?[0-9]{10,15}$/;
  const cleanInput = input.replace(/[\s()-]/g, "");

  if (emailRegex.test(input)) {
    return { type: "email", value: input.trim() };
  } else if (mobileRegex.test(cleanInput)) {
    let mobileNumber = cleanInput;
    if (mobileNumber.startsWith("+91")) {
      mobileNumber = mobileNumber.substring(3);
    } else if (mobileNumber.startsWith("91") && mobileNumber.length === 12) {
      mobileNumber = mobileNumber.substring(2);
    }
    return { type: "mobile", value: mobileNumber };
  } else {
    return { type: "invalid", value: null };
  }
};
// Generate unique invoice ID for company billing
const generateCompanyInvoiceId = async () => {
  const prefix = "COMP-INV";
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}-${timestamp}-${random}`;
};
// POST create company payment bill
v1Router.post("/billing/create", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      company_id,
      company_name,
      package_name,
      amount,
      payment_date,
      next_payment_date,
      contact_email,
      contact_phone,
      created_by,
    } = req.body;

    if (!company_id || !amount) {
      return res.status(400).json({
        message: "Company ID and amount are required",
        success: false,
      });
    }

    // Generate unique invoice ID
    const invoice_id = await generateCompanyInvoiceId();

    // Create company payment bill
    const newBill = await CompanyPaymentBill.create(
      {
        invoice_id: invoice_id,
        company: company_name,
        package: package_name,
        payment_date: payment_date || new Date(),
        next_payment_date: next_payment_date,
        amount: amount,
        payment_gateway: "razorpay",
        payment_status: "pending",
        status: "active",
        created_by: created_by || req.user?.id,
        updated_by: created_by || req.user?.id,
        created_at: new Date(),
        updated_at: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      message: "Company payment bill created successfully",
      success: true,
      data: {
        ...newBill.get({ plain: true }),
        contact_email,
        contact_phone,
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error creating company payment bill:", error);
    res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message,
    });
  }
});
// GET all company payment bills with pagination and filtering
v1Router.get("/billing/get", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      company_id,
      payment_status,
      status = "active",
      search = "",
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {};

    // Status filtering
    if (status !== "all") {
      whereClause.status = status;
    }

    if (company_id) {
      whereClause.company_id = company_id;
    }

    if (payment_status) {
      whereClause.payment_status = payment_status;
    }

    // Add search functionality
    if (search && search.trim() !== "") {
      const searchTerm = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { invoice_id: { [Op.like]: searchTerm } },
        { company: { [Op.like]: searchTerm } },
        { package: { [Op.like]: searchTerm } },
        { transaction_id: { [Op.like]: searchTerm } },
      ];
    }

    const { count, rows } = await CompanyPaymentBill.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset: offset,
      order: [["updated_at", "DESC"]],
      attributes: [
        "id",
        "invoice_id",
        "company",
        "package",
        "payment_date",
        "next_payment_date",
        "transaction_id",
        "amount",
        "payment_gateway",
        "payment_status",
        "status",
        "created_at",
        "updated_at",
      ],
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "email", "name"],
        },
      ],
    });

    const totalPages = Math.ceil(count / limitNum);

    // Format response with transaction_id clearly visible
    const formattedBills = rows.map((bill) => ({
      id: bill.id,
      invoice_id: bill.invoice_id,
      company: bill.company,
      package: bill.package,
      amount: parseFloat(bill.amount || 0),
      payment_status: bill.payment_status,
      transaction_id: bill.transaction_id, // ← Will be populated after payment
      payment_gateway: bill.payment_gateway,
      payment_date: bill.payment_date,
      next_payment_date: bill.next_payment_date,
      status: bill.status,
      created_at: bill.created_at,
      updated_at: bill.updated_at,
      creator: bill.creator,
      // Helper fields
      has_transaction: !!bill.transaction_id,
      is_paid: bill.payment_status === "paid",
      formatted_amount: `₹${parseFloat(bill.amount || 0).toLocaleString(
        "en-IN",
        { minimumFractionDigits: 2 }
      )}`,
    }));

    res.json({
      bills: formattedBills,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      success: true,
    });
  } catch (error) {
    logger.error("Error fetching company payment bills:", error);
    res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message,
    });
  }
});
// GET specific company payment bill by ID
v1Router.get("/billing/get/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const bill = await CompanyPaymentBill.findOne({
      where: { id: id },
      attributes: [
        "id",
        "invoice_id",
        "company",
        "package",
        "payment_date",
        "next_payment_date",
        "transaction_id",
        "amount",
        "payment_gateway",
        "payment_status",
        "status",
        "created_at",
        "updated_at",
      ],
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "email", "name"],
        },
        {
          model: User,
          as: "updater",
          attributes: ["id", "email", "name"],
        },
      ],
    });

    if (!bill) {
      return res.status(404).json({
        message: "Company payment bill not found",
        success: false,
      });
    }

    // Format response with transaction_id clearly visible
    const formattedBill = {
      id: bill.id,
      invoice_id: bill.invoice_id,
      company: bill.company,
      package: bill.package,
      amount: parseFloat(bill.amount || 0),
      payment_status: bill.payment_status,
      transaction_id: bill.transaction_id, // ← Will be populated after payment
      payment_gateway: bill.payment_gateway,
      payment_date: bill.payment_date,
      next_payment_date: bill.next_payment_date,
      status: bill.status,
      created_at: bill.created_at,
      updated_at: bill.updated_at,
      creator: bill.creator,
      updater: bill.updater,
      // Helper fields
      has_transaction: !!bill.transaction_id,
      is_paid: bill.payment_status === "paid",
      is_overdue: bill.next_payment_date
        ? new Date(bill.next_payment_date) < new Date() &&
          bill.payment_status !== "paid"
        : false,
      formatted_amount: `₹${parseFloat(bill.amount || 0).toLocaleString(
        "en-IN",
        { minimumFractionDigits: 2 }
      )}`,
    };

    res.json({
      data: formattedBill,
      success: true,
    });
  } catch (error) {
    logger.error("Error fetching company payment bill:", error);
    res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message,
    });
  }
});
// POST send payment link for company billing
v1Router.post(
  "/billing/send/payment/link",
  authenticateJWT,
  async (req, res) => {
    const { bill_id, emailOrMobileNumber, amount } = req.body;

    if (!bill_id) {
      return res.status(400).json({
        message: "Bill ID is required",
        success: false,
      });
    }

    if (!emailOrMobileNumber) {
      return res.status(400).json({
        message: "Email or mobile number is required",
        success: false,
      });
    }

    const contactInfo = detectContactType(emailOrMobileNumber);

    if (contactInfo.type === "invalid") {
      return res.status(400).json({
        message: "Invalid email or mobile number format",
        success: false,
      });
    }

    try {
      // Fetch bill details
      const bill = await CompanyPaymentBill.findOne({
        where: { id: bill_id, status: "active" },
      });

      if (!bill) {
        return res.status(404).json({
          message: "Company payment bill not found",
          success: false,
        });
      }

      if (bill.payment_status === "paid") {
        return res.status(400).json({
          message: "This bill has already been paid",
          success: false,
        });
      }

      // Determine payment amount
      const paymentAmount = amount || bill.amount || 0;
      const amountInPaise = Math.round(parseFloat(paymentAmount) * 100);

      const companyName = bill.company || "Valued Customer";

      // Determine contact details
      let clientEmail = null;
      let clientMobile = null;

      if (contactInfo.type === "email") {
        clientEmail = contactInfo.value;
      } else if (contactInfo.type === "mobile") {
        clientMobile = contactInfo.value;
      }

      // Create Razorpay payment link
      const paymentLinkData = {
        amount: amountInPaise,
        currency: "INR",
        accept_partial: false,
        description: `Payment for ${bill.package} Package - Invoice ${bill.invoice_id}`,
        customer: {
          name: companyName,
          email: clientEmail,
          contact: clientMobile ? `+91${clientMobile}` : undefined,
        },
        notify: {
          sms: !!clientMobile,
          email: !!clientEmail,
        },
        reminder_enable: true,
        notes: {
          bill_id: bill.id,
          invoice_id: bill.invoice_id,
          company_name: bill.company,
          package_name: bill.package,
        },
        callback_url: `${req.protocol}://${req.get(
          "host"
        )}/api/billing/payment/callback?bill_id=${bill.id}`,
        callback_method: "get",
      };

      const paymentLink = await razorpay.paymentLink.create(paymentLinkData);

      let emailSent = false;
      let smsSent = false;
      let emailError = null;
      let smsError = null;

      // Send email if email address is available
      if (clientEmail) {
        try {
          const emailTemplate = PaymentLinkTemplate({
            clientName: companyName,
            clientEmail: clientEmail,
            invoiceNumber: bill.invoice_id,
            invoiceAmount: paymentAmount,
            skuDetails: [
              {
                item_name: `${bill.package} Package`,
                quantity: 1,
                unit_price: paymentAmount,
                total_amount: paymentAmount,
              },
            ],
            paymentLink: paymentLink.short_url,
            dueDate: bill.next_payment_date
              ? new Date(bill.next_payment_date).toLocaleDateString("en-IN")
              : null,
            companyName: "PackWorkX",
          });

          await sendEmail(
            clientEmail,
            `Payment Request - ${bill.package} Package Invoice ${bill.invoice_id}`,
            emailTemplate
          );

          emailSent = true;
          logger.info(
            `Payment link email sent successfully to: ${clientEmail}`
          );
        } catch (error) {
          emailError = error.message;
          logger.error(
            `Failed to send payment link email to: ${clientEmail}`,
            error
          );
        }
      }

      // Send SMS if mobile number is available
      if (clientMobile) {
        try {
          const smsMessage = `Hi ${companyName}, Payment link for ${
            bill.package
          } Package Invoice ${bill.invoice_id} (₹${parseFloat(
            paymentAmount
          ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}): ${
            paymentLink.short_url
          }\n\nPackWorkX Team`;

          await twilioClient.messages.create({
            body: smsMessage,
            from: process.env.TWILIO_FROM_MOBILE_NUMBER,
            to: `+91${clientMobile}`,
          });

          smsSent = true;
          logger.info(
            `Payment link SMS sent successfully to: +91${clientMobile}`
          );
        } catch (error) {
          smsError = error.message;
          logger.error(
            `Failed to send payment link SMS to: +91${clientMobile}`,
            error
          );
        }
      }

      const responseData = {
        paymentLink: {
          id: paymentLink.id,
          short_url: paymentLink.short_url,
          amount: paymentAmount,
          currency: "INR",
          status: paymentLink.status,
        },
        bill: {
          id: bill.id,
          invoice_id: bill.invoice_id,
          company: bill.company,
          package: bill.package,
          amount: bill.amount,
        },
        contactInfo: {
          inputType: contactInfo.type,
          inputValue: contactInfo.value,
          emailUsed: clientEmail,
          mobileUsed: clientMobile,
        },
        notifications: {
          email: {
            sent: emailSent,
            recipient: clientEmail,
            error: emailError,
          },
          sms: {
            sent: smsSent,
            recipient: clientMobile ? `+91${clientMobile}` : null,
            error: smsError,
          },
        },
      };

      const overallSuccess =
        (clientEmail ? emailSent : true) && (clientMobile ? smsSent : true);

      res.status(201).json({
        message: overallSuccess
          ? "Payment link created and sent successfully"
          : "Payment link created with some notification failures",
        success: true,
        data: responseData,
      });
    } catch (error) {
      logger.error("Error creating/sending company payment link:", error);

      let errorMessage = "Internal Server Error";
      let statusCode = 500;

      if (
        error.message?.includes("Authentication failed") ||
        error.message?.includes("Invalid API key")
      ) {
        errorMessage =
          "Payment gateway configuration error. Please check Razorpay credentials.";
      } else if (
        error.message?.includes("SMTP") ||
        error.message?.includes("Email")
      ) {
        errorMessage = "Email configuration error. Please check SMTP settings.";
      } else if (
        error.message?.includes("Twilio") ||
        error.message?.includes("SMS")
      ) {
        errorMessage = "SMS configuration error. Please check Twilio settings.";
      }

      res.status(statusCode).json({
        message: errorMessage,
        success: false,
        error: error.message,
      });
    }
  }
);
// GET payment callback URL handler
v1Router.get("/billing/payment/callback", async (req, res) => {
  try {
    const {
      bill_id,
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
      razorpay_signature,
    } = req.query;

    logger.info("Company payment callback received:", {
      bill_id,
      payment_id: razorpay_payment_id,
      payment_link_id: razorpay_payment_link_id,
      status: razorpay_payment_link_status,
    });

    if (!bill_id) {
      return res
        .status(400)
        .send("<h1>Error: Bill ID missing from callback</h1>");
    }

    // Fetch bill details
    const bill = await CompanyPaymentBill.findOne({
      where: { id: bill_id, status: "active" },
      attributes: ["id", "invoice_id", "amount", "company", "package"],
    });

    if (!bill) {
      return res
        .status(404)
        .send("<h1>Error: Company payment bill not found</h1>");
    }

    let templateData = {
      invoiceNumber: bill.invoice_id,
      amount: parseFloat(bill.amount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
      }),
      company: bill.company,
      package: bill.package,
      paymentId: razorpay_payment_id || "N/A",
      paymentMethod: "Online Payment",
      transactionDate: new Date().toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    // Check payment status and handle accordingly
    if (razorpay_payment_link_status === "paid" && razorpay_payment_id) {
      // Payment successful
      try {
        // Check if this payment has already been processed
        const existingPayment = await CompanyPaymentBill.findOne({
          where: {
            transaction_id: razorpay_payment_id,
            id: bill_id,
          },
        });

        if (!existingPayment) {
          // Get payment amount from Razorpay or use bill amount
          let paymentAmount = bill.amount;

          try {
            const paymentDetails = await razorpay.payments.fetch(
              razorpay_payment_id
            );
            paymentAmount = paymentDetails.amount / 100;
            logger.info(
              `Fetched payment details from Razorpay: ${paymentAmount}`
            );
          } catch (razorpayError) {
            logger.warn(
              "Could not fetch payment details from Razorpay, using bill amount:",
              razorpayError.message
            );
          }

          // Update bill with payment details
          await CompanyPaymentBill.update(
            {
              transaction_id: razorpay_payment_id,
              payment_status: "paid",
              payment_date: new Date(),
              updated_at: new Date(),
            },
            {
              where: { id: bill_id },
            }
          );

          logger.info(
            `Company payment completed for bill ${bill.invoice_id}: ₹${paymentAmount}`
          );
        } else {
          logger.info(
            `Payment ${razorpay_payment_id} already processed for bill ${bill.invoice_id}`
          );
        }

        // Serve success page
        const successHtml = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Payment Successful - PackWorkX</title>
              <style>
                  body { font-family: Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
                  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                  .header { background: #28a745; color: white; padding: 30px; text-align: center; }
                  .content { padding: 30px; }
                  .success-icon { font-size: 48px; margin-bottom: 20px; }
                  .details { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
                  .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 5px 0; border-bottom: 1px solid #eee; }
                  .btn { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="header">
                      <div class="success-icon">✅</div>
                      <h1>Payment Successful!</h1>
                      <p>Thank you for your payment</p>
                  </div>
                  <div class="content">
                      <p>Your payment has been processed successfully. Here are the details:</p>
                      <div class="details">
                          <div class="detail-row">
                              <strong>Invoice Number:</strong>
                              <span>${templateData.invoiceNumber}</span>
                          </div>
                          <div class="detail-row">
                              <strong>Company:</strong>
                              <span>${templateData.company}</span>
                          </div>
                          <div class="detail-row">
                              <strong>Package:</strong>
                              <span>${templateData.package}</span>
                          </div>
                          <div class="detail-row">
                              <strong>Amount Paid:</strong>
                              <span>₹${templateData.amount}</span>
                          </div>
                          <div class="detail-row">
                              <strong>Payment ID:</strong>
                              <span>${templateData.paymentId}</span>
                          </div>
                          <div class="detail-row">
                              <strong>Transaction Date:</strong>
                              <span>${templateData.transactionDate}</span>
                          </div>
                      </div>
                      <p>Your package subscription has been activated. You will receive a confirmation email shortly.</p>
                      <a href="${
                        process.env.FRONTEND_URL ||
                        "https://dev-packwork.pazl.info"
                      }" class="btn">Continue to Dashboard</a>
                  </div>
              </div>
          </body>
          </html>
        `;

        res.setHeader("Content-Type", "text/html");
        return res.send(successHtml);
      } catch (dbError) {
        logger.error("Database error during payment processing:", dbError);
        // Still show success but log error
        const successHtml = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Payment Successful - PackWorkX</title>
              <style>
                  body { font-family: Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
                  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                  .header { background: #28a745; color: white; padding: 30px; text-align: center; }
                  .content { padding: 30px; }
                  .success-icon { font-size: 48px; margin-bottom: 20px; }
                  .btn { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="header">
                      <div class="success-icon">✅</div>
                      <h1>Payment Successful!</h1>
                      <p>Thank you for your payment</p>
                  </div>
                  <div class="content">
                      <p>Your payment of ₹${templateData.amount} for invoice ${
          templateData.invoiceNumber
        } has been processed successfully.</p>
                      <p>You will receive a confirmation email shortly.</p>
                      <a href="${
                        process.env.FRONTEND_URL ||
                        "https://dev-packwork.pazl.info"
                      }" class="btn">Continue to Dashboard</a>
                  </div>
              </div>
          </body>
          </html>
        `;

        res.setHeader("Content-Type", "text/html");
        return res.send(successHtml);
      }
    } else {
      // Payment failed or cancelled
      logger.warn(
        `Company payment failed or cancelled for bill ${bill.invoice_id}:`,
        {
          status: razorpay_payment_link_status,
          payment_id: razorpay_payment_id,
        }
      );

      const failureHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Failed - PackWorkX</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .header { background: #dc3545; color: white; padding: 30px; text-align: center; }
                .content { padding: 30px; text-align: center; }
                .error-icon { font-size: 48px; margin-bottom: 20px; }
                .btn { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px; }
                .btn-retry { background: #28a745; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="error-icon">❌</div>
                    <h1>Payment Failed</h1>
                    <p>We couldn't process your payment</p>
                </div>
                <div class="content">
                    <p>Your payment for invoice <strong>${
                      templateData.invoiceNumber
                    }</strong> could not be completed.</p>
                    <p>Amount: ₹${templateData.amount}</p>
                    <p>Please try again or contact support if the issue persists.</p>
                    <a href="${
                      process.env.FRONTEND_URL ||
                      "https://dev-packwork.pazl.info"
                    }/billing/${bill_id}" class="btn btn-retry">Try Again</a>
                    <a href="${
                      process.env.FRONTEND_URL ||
                      "https://dev-packwork.pazl.info"
                    }" class="btn">Go to Dashboard</a>
                </div>
            </div>
        </body>
        </html>
      `;

      res.setHeader("Content-Type", "text/html");
      return res.send(failureHtml);
    }
  } catch (error) {
    logger.error("Error in company payment callback:", error);
    res.status(500).send(`
      <h1>Payment Processing Error</h1>
      <p>An error occurred while processing your payment callback.</p>
      <p>Please contact support if you believe your payment was successful.</p>
      <p>Error: ${error.message}</p>
    `);
  }
});
// POST webhook to handle Razorpay payment updates for company billing
v1Router.post("/billing/payment/webhook", async (req, res) => {
  try {
    const webhookSignature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify webhook signature (optional but recommended)
    if (webhookSecret) {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (expectedSignature !== webhookSignature) {
        return res.status(400).json({ message: "Invalid webhook signature" });
      }
    }

    const { event, payload } = req.body;

    // Handle payment link events
    if (event === "payment_link.paid") {
      const paymentLink = payload.payment_link.entity;
      const notes = paymentLink.notes;

      if (notes && notes.bill_id) {
        // Check if this payment has already been processed
        const existingBill = await CompanyPaymentBill.findOne({
          where: {
            transaction_id: paymentLink.id,
            id: notes.bill_id,
          },
        });

        if (!existingBill) {
          // Update bill payment status
          await CompanyPaymentBill.update(
            {
              transaction_id: paymentLink.id,
              payment_status: "paid",
              payment_date: new Date(),
              updated_at: new Date(),
            },
            {
              where: { id: notes.bill_id },
            }
          );

          logger.info(
            `Company payment completed via webhook for bill ID: ${
              notes.bill_id
            }, Amount: ${paymentLink.amount / 100}`
          );
        } else {
          logger.info(
            `Payment ${paymentLink.id} already processed via webhook for company billing`
          );
        }
      }
    }

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    logger.error("Error processing company payment webhook:", error);
    res
      .status(500)
      .json({ message: "Webhook processing failed", error: error.message });
  }
});
// GET payment link status
v1Router.get(
  "/billing/payment/link/status/:paymentLinkId",
  authenticateJWT,
  async (req, res) => {
    const { paymentLinkId } = req.params;

    try {
      const paymentLink = await razorpay.paymentLink.fetch(paymentLinkId);

      res.status(200).json({
        message: "Payment link status fetched successfully",
        success: true,
        data: {
          id: paymentLink.id,
          status: paymentLink.status,
          amount: paymentLink.amount / 100,
          currency: paymentLink.currency,
          short_url: paymentLink.short_url,
          created_at: paymentLink.created_at,
          paid_at: paymentLink.paid_at,
          cancelled_at: paymentLink.cancelled_at,
        },
      });
    } catch (error) {
      logger.error("Error fetching payment link status:", error);
      res.status(500).json({
        message: "Internal Server Error",
        success: false,
        error: error.message,
      });
    }
  }
);

// POST retry payment for a company bill
v1Router.post(
  "/billing/payment/retry/:billId",
  authenticateJWT,
  async (req, res) => {
    const { billId } = req.params;
    const { emailOrMobileNumber, amount } = req.body;

    try {
      // Fetch bill details
      const bill = await CompanyPaymentBill.findOne({
        where: {
          id: billId,
          status: "active",
        },
      });

      if (!bill) {
        return res.status(404).json({
          message: "Company payment bill not found",
          success: false,
        });
      }

      if (bill.payment_status === "paid") {
        return res.status(400).json({
          message: "This bill has already been paid",
          success: false,
        });
      }

      // Use the provided amount or bill amount
      const paymentAmount = amount || bill.amount;
      const amountInPaise = Math.round(parseFloat(paymentAmount) * 100);

      const companyName = bill.company || "Valued Customer";

      // Determine contact details
      let clientEmail =
        emailOrMobileNumber && emailOrMobileNumber.includes("@")
          ? emailOrMobileNumber
          : null;
      let clientMobile =
        emailOrMobileNumber && !emailOrMobileNumber.includes("@")
          ? emailOrMobileNumber
          : null;

      // Create new payment link
      const paymentLinkData = {
        amount: amountInPaise,
        currency: "INR",
        accept_partial: false,
        description: `Retry Payment for ${bill.package} Package - Invoice ${bill.invoice_id}`,
        customer: {
          name: companyName,
          email: clientEmail,
          contact: clientMobile ? `+91${clientMobile}` : undefined,
        },
        notify: {
          sms: !!clientMobile,
          email: !!clientEmail,
        },
        reminder_enable: true,
        notes: {
          bill_id: bill.id,
          invoice_id: bill.invoice_id,
          company_name: bill.company,
          package_name: bill.package,
          retry_payment: "true",
        },
        callback_url: `${req.protocol}://${req.get(
          "host"
        )}/api/billing/payment/callback?bill_id=${bill.id}`,
        callback_method: "get",
      };

      const paymentLink = await razorpay.paymentLink.create(paymentLinkData);

      logger.info(
        `Retry payment link created for company bill ${bill.invoice_id}: ${paymentLink.short_url}`
      );

      res.status(201).json({
        message: "Retry payment link created successfully",
        success: true,
        data: {
          paymentLink: {
            id: paymentLink.id,
            short_url: paymentLink.short_url,
            amount: paymentAmount,
            currency: "INR",
            status: paymentLink.status,
          },
          bill: {
            id: bill.id,
            invoice_id: bill.invoice_id,
            company: bill.company,
            package: bill.package,
            amount: bill.amount,
          },
        },
      });
    } catch (error) {
      logger.error(
        "Error creating retry payment link for company billing:",
        error
      );
      res.status(500).json({
        message: "Internal Server Error",
        success: false,
        error: error.message,
      });
    }
  }
);
// GET payment status for a company bill
v1Router.get(
  "/billing/payment/status/:billId",
  authenticateJWT,
  async (req, res) => {
    const { billId } = req.params;

    try {
      // Fetch bill details
      const bill = await CompanyPaymentBill.findOne({
        where: { id: billId, status: "active" },
        attributes: [
          "id",
          "invoice_id",
          "company",
          "package",
          "amount",
          "payment_status",
          "payment_date",
          "next_payment_date",
          "transaction_id",
          "payment_gateway",
          "created_at",
          "updated_at",
        ],
        include: [
          {
            model: User,
            as: "creator",
            attributes: ["id", "email", "name"],
          },
        ],
      });

      if (!bill) {
        return res.status(404).json({
          message: "Company payment bill not found",
          success: false,
        });
      }

      // Payment status summary
      const paymentSummary = {
        bill_amount: parseFloat(bill.amount || 0),
        payment_status: bill.payment_status,
        is_paid: bill.payment_status === "paid",
        is_pending: bill.payment_status === "pending",
        is_failed: bill.payment_status === "failed",
        payment_date: bill.payment_date,
        next_payment_date: bill.next_payment_date,
        transaction_id: bill.transaction_id,
        payment_gateway: bill.payment_gateway,
        is_overdue: bill.next_payment_date
          ? new Date(bill.next_payment_date) < new Date() &&
            bill.payment_status !== "paid"
          : false,
      };

      res.status(200).json({
        message: "Payment status retrieved successfully",
        success: true,
        data: {
          bill: {
            id: bill.id,
            invoice_id: bill.invoice_id,
            company: bill.company,
            package: bill.package,
            amount: bill.amount,
            payment_status: bill.payment_status,
            payment_date: bill.payment_date,
            next_payment_date: bill.next_payment_date,
            transaction_id: bill.transaction_id,
            payment_gateway: bill.payment_gateway,
            created_at: bill.created_at,
            updated_at: bill.updated_at,
            creator: bill.creator,
          },
          payment_summary: paymentSummary,
        },
      });
    } catch (error) {
      logger.error("Error fetching company payment status:", error);
      res.status(500).json({
        message: "Internal Server Error",
        success: false,
        error: error.message,
      });
    }
  }
);
// GET all company bill invoice IDs
v1Router.get(
  "/billing/get/invoice/generate-id",
  authenticateJWT,
  async (req, res) => {
    try {
      const bills = await CompanyPaymentBill.findAll({
        attributes: [
          "id",
          "invoice_id",
          "company",
          "package",
          "amount",
          "payment_status",
        ],
        where: {
          status: "active",
        },
        order: [["created_at", "DESC"]],
        raw: true,
      });

      return res.status(200).json({
        success: true,
        data: bills,
      });
    } catch (error) {
      logger.error("Error fetching company payment bills:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch company payment bills",
        error: error.message,
      });
    }
  }
);


// company apis


// v1Router.post("/",validateCompany, async (req, res) => {
//     const transaction = await sequelize.transaction(); // Start a transaction

//     try {
//         const { companyAccountDetails, package_name, ...companyData } = req.body;

//         console.log("🔵 companyAccountDetails:", companyAccountDetails);
//         console.log("🔵 companyData:", companyData);
//         console.log("🔵 package_name:", package_name);
//         console.log("companyData:", companyData.package_type);

//         // 🔹 Step 1: Find package ID by package name
//         let packageId = null;
//         if (package_name) {
//             const packageResult = await sequelize.query(
//                 `SELECT id FROM packages WHERE name = ?`,
//                 {
//                     replacements: [package_name],
//                     type: sequelize.QueryTypes.SELECT,
//                     transaction
//                 }
//             );

//             if (packageResult.length === 0) {
//                 await transaction.rollback();
//                 return res.status(400).json({
//                     status: false,
//                     message: `Package with name '${package_name}' not found`,
//                     data: []
//                 });
//             }

//             packageId = packageResult[0].id;
//             console.log("✅ Found Package ID:", packageId);
//         }

//         // 🔹 Step 2: Call Stored Procedure (Insert Company & Users)
//         await sequelize.query(
//             `CALL ProcedureInsertCompanyAndUsers(?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @newCompanyId);`,
//             {
//                 replacements: [
//                     companyData.name,
//                     companyData.email,
//                     companyData.currency,
//                     companyData.timezone,
//                     companyData.language,
//                     companyData.address,
//                     companyData.phone,
//                     companyData.website,
//                     companyData.logo,
//                     companyAccountDetails[0].accountName, // Assuming at least one account
//                     companyAccountDetails[0].accountEmail,
//                     await bcrypt.hash(companyData.password || '123456', 10), // defaultPassword
//                     packageId,
//                     companyData.package_start_date,
//                     companyData.package_end_date,
//                     companyData.package_type

//                 ],
//                 type: sequelize.QueryTypes.RAW,
//                 transaction
//             }
//         );

//         // 🔹 Step 3: Retrieve the new company ID from output parameter
//         const companyIdResult = await sequelize.query(`SELECT @newCompanyId AS companyId;`, {
//             type: sequelize.QueryTypes.SELECT,
//             transaction
//         });

//         const newCompanyId = companyIdResult[0].companyId;
//         console.log("✅ New Company ID:", newCompanyId);

//         await transaction.commit(); // Commit transaction

//         // 🔹 Step 4: Send Welcome Emails (async, non-blocking)
//         emailService.sendCompanyRegistrationEmails(
//             {
//                 name: companyData.name,
//                 email: companyData.email,
//                 phone: companyData.phone,
//                 website: companyData.website,
//                 address: companyData.address
//             },
//             {
//                 name: companyAccountDetails[0].accountName,
//                 email: companyAccountDetails[0].accountEmail,
//                 username: companyAccountDetails[0].accountEmail, // Username is the email
//                 password: companyData.password || "123456" // Default password
//             }
//         ).then(() => {
//             logger.info(`📧 Registration emails sent successfully for company: ${companyData.name}`);
//         }).catch((emailError) => {
//             logger.error(`📧 Failed to send registration emails for company: ${companyData.name}`, {
//                 error: emailError.message,
//                 companyId: newCompanyId
//             });
//             // Don't fail the registration if email fails
//         });

//         // 🔹 Step 5: Publish `companyId` to RabbitMQ Queue for Background Processing
//         const connection = await amqp.connect(RABBITMQ_URL);
//         const channel = await connection.createChannel();
//         await channel.assertQueue(QUEUE_NAME, { durable: true });

//         const message = JSON.stringify({ companyId: newCompanyId });
//         channel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true });

//         console.log(`📩 Sent Company ID ${newCompanyId} to RabbitMQ`);
//         await channel.close();
//         await connection.close();

//         // Return success response immediately (emails are sent asynchronously)
//         return res.status(200).json({
//             status: true,
//             message: "Company created successfully. Welcome emails are being sent.",
//             companyId: newCompanyId,
//             data: {
//                 companyName: companyData.name,
//                 adminEmail: companyAccountDetails[0].accountEmail,
//                 emailStatus: "sending" // Indicates emails are being processed
//             }
//         });

//     } catch (error) {
//         await transaction.rollback(); // Rollback transaction if error occurs
//         const stackLines = error.stack.split('\n');
//         const callerLine = stackLines[1]; // The line where the error occurred
//         const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
//         let fileName = '';
//         let lineNumber = '';

//         if (match) {
//             fileName = match[1];
//             lineNumber = match[2];
//         }

//         logger.error('Company creation failed:', {
//             error: error.message,
//             file: fileName,
//             line: lineNumber,
//             // companyData: companyData.name || 'Unknown'
//         });

//         return res.status(500).json({
//             status: false,
//             message: error.message,
//             file: fileName,
//             line: lineNumber,
//             data: [],
//         });
//     }
// });


v1Router.post("/", validateCompany, async (req, res) => {
  const transaction = await sequelize.transaction(); // Start a transaction

  try {
    const { companyAccountDetails, package_name, ...companyData } = req.body;

    console.log("🔵 companyAccountDetails:", companyAccountDetails);
    console.log("🔵 companyData:", companyData);
    console.log("🔵 package_name:", package_name);
    console.log("typo", companyData.package_type);

    // 🔹 NEW: Step 1 - Set package_start_date to current date if not provided
    const currentDate = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD
    if (!companyData.package_start_date) {
      companyData.package_start_date = currentDate;
    }
    console.log(
      "✅ Package Start Date set to:",
      companyData.package_start_date
    );

    // 🔹 NEW: Step 1.1 - Set version to "trial" if not provided
    if (!companyData.version) {
      companyData.version = "trial";
    }
    console.log("✅ Version set to:", companyData.version);

    // 🔹 NEW: Step 1.2 - Calculate package_end_date if not provided
    if (!companyData.package_end_date) {
      try {
        // Check package_settings table for no_of_days
        const packageSettingsResult = await sequelize.query(
          `SELECT status, no_of_days FROM package_settings LIMIT 1`,
          {
            type: sequelize.QueryTypes.SELECT,
            transaction,
          }
        );

        let numberOfDays;

        if (packageSettingsResult.length > 0) {
          const packageSettings = packageSettingsResult[0];
          console.log("📋 Package Settings found:", packageSettings);

          if (packageSettings.status === "active") {
            // Use no_of_days from package_settings table
            numberOfDays = packageSettings.no_of_days || 30; // fallback to 30 if null
            console.log(
              "✅ Using no_of_days from package_settings (active):",
              numberOfDays
            );
          } else {
            // Use NO_OF_DAYS_FOR_TRIAL from .env file
            numberOfDays = parseInt(process.env.NO_OF_DAYS_FOR_TRIAL) || 7; // fallback to 7 if not set
            console.log(
              "✅ Using NO_OF_DAYS_FOR_TRIAL from .env (inactive):",
              numberOfDays
            );
          }
        } else {
          // No package_settings record found, use .env fallback
          numberOfDays = parseInt(process.env.NO_OF_DAYS_FOR_TRIAL) || 7;
          console.log(
            "⚠️ No package_settings found, using .env fallback:",
            numberOfDays
          );
        }

        // Calculate end date
        const startDate = new Date(companyData.package_start_date);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + numberOfDays);

        companyData.package_end_date = endDate.toISOString().split("T")[0]; // Format: YYYY-MM-DD
        console.log(
          "✅ Package End Date calculated:",
          companyData.package_end_date
        );
      } catch (dateError) {
        console.error("❌ Error calculating package_end_date:", dateError);
        // Fallback: use 7 days from start date
        const startDate = new Date(companyData.package_start_date);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);
        companyData.package_end_date = endDate.toISOString().split("T")[0];
        console.log(
          "⚠️ Fallback Package End Date:",
          companyData.package_end_date
        );
      }
    }

    // 🔹 Step 2: Find package ID by package name
    let packageId = null;
    if (package_name) {
      const packageResult = await sequelize.query(
        `SELECT id FROM packages WHERE name = ?`,
        {
          replacements: [package_name],
          type: sequelize.QueryTypes.SELECT,
          transaction,
        }
      );

      if (packageResult.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          status: false,
          message: `Package with name '${package_name}' not found`,
          data: [],
        });
      }

      packageId = packageResult[0].id;
      console.log("✅ Found Package ID:", packageId);
    }

    console.log("🚨 SQL Procedure Replacements:");
    const replacements = [
      companyData.name,
      companyData.email,
      companyData.currency,
      companyData.timezone,
    //   companyData.language,
      companyData.address,
      companyData.phone,
      companyData.website,
      companyData.logo,
      companyAccountDetails[0]?.accountName,
      companyAccountDetails[0]?.accountEmail,
      await bcrypt.hash(companyData.password || "123456", 10),
      packageId,
      companyData.package_start_date,
      companyData.package_end_date,
      companyData.package_type,
      companyData.version,
    ];
    console.table(replacements);

    // 🔹 Step 3: Call Stored Procedure (Insert Company & Users)
    // NOTE: You may need to update your stored procedure to accept the version parameter
    await sequelize.query(
      `CALL ProcedureInsertCompanyAndUsers(?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @newCompanyId);`,
      {
        replacements: [
          companyData.name,
          companyData.email,
          companyData.currency,
          companyData.timezone,
        //   companyData.language,
          companyData.address,
          companyData.phone,
          companyData.website,
          companyData.logo,
          companyAccountDetails[0].accountName, // Assuming at least one account
          companyAccountDetails[0].accountEmail,
          await bcrypt.hash(companyData.password || "123456", 10), // defaultPassword
          packageId,
          companyData.package_start_date, // Now guaranteed to be set
          companyData.package_end_date, // Now guaranteed to be calculated
          companyData.package_type,
          companyData.version, // NEW: Add version parameter
        ],
        type: sequelize.QueryTypes.RAW,
        transaction,
      }
    );

    // 🔹 Step 4: Retrieve the new company ID from output parameter
    const companyIdResult = await sequelize.query(
      `SELECT @newCompanyId AS companyId;`,
      {
        type: sequelize.QueryTypes.SELECT,
        transaction,
      }
    );

    const newCompanyId = companyIdResult[0].companyId;
    console.log("✅ New Company ID:", newCompanyId);

    await transaction.commit(); // Commit transaction

    // 🔹 Step 5: Send Welcome Emails (async, non-blocking)
    emailService
      .sendCompanyRegistrationEmails(
        {
          name: companyData.name,
          email: companyData.email,
          phone: companyData.phone,
          website: companyData.website,
          address: companyData.address,
        },
        {
          name: companyAccountDetails[0].accountName,
          email: companyAccountDetails[0].accountEmail,
          username: companyAccountDetails[0].accountEmail, // Username is the email
          password: companyData.password || "123456", // Default password
        }
      )
      .then(() => {
        logger.info(
          `📧 Registration emails sent successfully for company: ${companyData.name}`
        );
      })
      .catch((emailError) => {
        logger.error(
          `📧 Failed to send registration emails for company: ${companyData.name}`,
          {
            error: emailError.message,
            companyId: newCompanyId,
          }
        );
        // Don't fail the registration if email fails
      });

    // 🔹 Step 6: Publish `companyId` to RabbitMQ Queue for Background Processing
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    const message = JSON.stringify({ companyId: newCompanyId });
    channel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true });

    console.log(`📩 Sent Company ID ${newCompanyId} to RabbitMQ`);
    await channel.close();
    await connection.close();

    // Return success response immediately (emails are sent asynchronously)
    return res.status(200).json({
      status: true,
      message: "Company created successfully. Welcome emails are being sent.",
      companyId: newCompanyId,
      data: {
        companyName: companyData.name,
        adminEmail: companyAccountDetails[0].accountEmail,
        packageStartDate: companyData.package_start_date, // NEW: Include in response
        packageEndDate: companyData.package_end_date, // NEW: Include in response
        version: companyData.version, // NEW: Include in response
        emailStatus: "sending", // Indicates emails are being processed
      },
    });
  } catch (error) {
    await transaction.rollback(); // Rollback transaction if error occurs
    const stackLines = error.stack.split("\n");
    const callerLine = stackLines[1]; // The line where the error occurred
    const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
    let fileName = "";
    let lineNumber = "";

    if (match) {
      fileName = match[1];
      lineNumber = match[2];
    }

    logger.error("Company creation failed:", {
      error: error.message,
      file: fileName,
      line: lineNumber,
      // companyData: companyData.name || 'Unknown'
    });

    return res.status(500).json({
      status: false,
      message: error.message,
      file: fileName,
      line: lineNumber,
      data: [],
    });
  }
});

v1Router.get("/", async (req, res) => {
  try {
    // Extract query parameters
    const { page = 1, limit = 10, search } = req.query;
    
    // Parse pagination parameters
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pageLimit = parseInt(limit);
    
    // Build where clause for search
    const whereClause = {};
    if (search) {
      whereClause.company_name = {
        [Op.like]: `%${search}%` 
      };
    }

    // Fetch companies with pagination and search
    const { count, rows: companies } = await Company.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Package,
          as: "package",
          attributes: ["id", "name"], // fetch id and name of package
        },
      ],
      limit: pageLimit,
      offset: offset,
      order: [['created_at', 'DESC']], // Optional: order by creation date
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / pageLimit);
    const currentPage = parseInt(page);
    const hasNextPage = currentPage < totalPages;
    const hasPreviousPage = currentPage > 1;

    return res.status(200).json({
      status: true,
      message: "companies fetched successfully",
      data: companies,
      pagination: {
        currentPage,
        totalPages,
        totalItems: count,
        itemsPerPage: pageLimit,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    const stackLines = error.stack.split("\n");
    const callerLine = stackLines[1];
    const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
    let fileName = "";
    let lineNumber = "";

    if (match) {
      fileName = match[1];
      lineNumber = match[2];
    }

    return res.status(500).json({
      status: false,
      message: error.message,
      file: fileName,
      line: lineNumber,
      data: [],
    });
  }
});
v1Router.get("/:id", async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id, {
      include: [
        {
          model: Package,
          as: "package",
          attributes: ["id", "name"], // fetch id and name of package
        },
      ],
    });

    if (!company) {
      return res.status(404).json({
        status: false,
        message: "Company not found",
        data: null,
      });
    }

    return res.status(200).json({
      status: true,
      message: "company fetched successfully",
      data: company,
    });
  } catch (error) {
    const stackLines = error.stack.split("\n");
    const callerLine = stackLines[1];
    const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
    let fileName = "";
    let lineNumber = "";

    if (match) {
      fileName = match[1];
      lineNumber = match[2];
    }

    return res.status(500).json({
      status: false,
      message: error.message,
      file: fileName,
      line: lineNumber,
      data: [],
    });
  }
});
// 🔹 Update a Company (PUT)
v1Router.put("/:id", async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) {
      return res.status(400).json({
        status: false,
        message: "Company not found",
        data: companies,
      });
    } else {
      await company.update(req.body);
      return res.status(200).json({
        status: true,
        message: "company updated successfully",
        data: company,
      });
    }
  } catch (error) {
    const stackLines = error.stack.split("\n");
    const callerLine = stackLines[1]; // The line where the error occurred
    const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
    let fileName = "";
    let lineNumber = "";

    if (match) {
      fileName = match[1];
      lineNumber = match[2];
    }

    return res.status(500).json({
      status: false,
      message: error.message,
      file: fileName,
      line: lineNumber,
      data: [],
    });
  }
});
// 🔹 Delete a Company (DELETE)
v1Router.delete("/:id", async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    await company.destroy();
    res.json({ version: "v1", message: "Company deleted successfully" });
  } catch (error) {
    const stackLines = error.stack.split("\n");
    const callerLine = stackLines[1]; // The line where the error occurred
    const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
    let fileName = "";
    let lineNumber = "";

    if (match) {
      fileName = match[1];
      lineNumber = match[2];
    }

    return res.status(500).json({
      status: false,
      message: error.message,
      file: fileName,
      line: lineNumber,
      data: [],
    });
  }
});

// ✅ Static Token for Internal APIs (e.g., Health Check)
v1Router.get("/health", authenticateStaticToken, (req, res) => {
  res.json({ status: "Service is running", timestamp: new Date() });
});

// Use Version 1 Router
app.use("/api/companies", v1Router);
// await db.sequelize.sync();
app.listen(process.env.PORT_COMPANY, "0.0.0.0", async () => {
  console.log(`Company Service running on port ${process.env.PORT_COMPANY}`);
});
