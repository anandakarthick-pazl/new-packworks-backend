import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import "../../common/models/association.js";

// Add these imports to your existing companies service file
import Razorpay from 'razorpay';
import twilio from 'twilio';
import { sendEmail } from '../../common/helper/emailService.js';
import { PaymentLinkTemplate } from '../../common/services/email/templates/paymentLink.js';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CompanyPaymentBill from '../../common/models/companyPaymentBill.model.js';

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();


import { QueryTypes } from "sequelize";


// 🔹 Get All billing (GET) with Addresses - Only active billing
v1Router.get("/billing",authenticateJWT, async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search,
      
    } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    console.log("pages", page);
    console.log("object", limit);
  

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { transaction_id: { [Op.like]: `%${search}%` } },
        { package_type: { [Op.like]: `%${search}%` } },
        { gateway_name: { [Op.like]: `%${search}%` } },
        { pay_date: { [Op.like]: `%${search}%` } },
        { next_pay_date: { [Op.like]: `%${search}%` } },
        { amount: { [Op.like]: `%${search}%` } },
        { company_id: { [Op.like]: `%${search}%` } },
      ];
    }

    
  
    const query = `
    SELECT 
      gi.id,
      ci.company_name,
      gi.package_type,
      gi.pay_date,
      gi.next_pay_date,
      gi.transaction_id,
      gi.amount,
      gi.gateway_name,
      gc.currency_symbol
    FROM global_invoices AS gi
    LEFT JOIN companies AS ci ON gi.company_id = ci.id
    LEFT JOIN global_currencies AS gc ON gi.currency_id = gc.id
    ORDER BY gi.id ASC
    LIMIT :limit OFFSET :offset;
  `;
  
  const billing = await sequelize.query(query, {
    type: QueryTypes.SELECT,
    replacements: {
      limit: limit, 
      offset: (page - 1) * limit
    },
  });
  
  var count = billing.length;
  console.log("Billing Data:", billing);

  
  var data =  billing.map((bill) => ({
    id: bill.id,
    company: bill.company_name,
    package: bill.package_type,
    payment_date: bill.pay_date
      ? new Date(bill.pay_date).toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "-",
    next_payment_date: bill.next_pay_date
      ? new Date(bill.next_pay_date).toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "-",
    transaction_id: bill.transaction_id,
    amount: bill.amount ? `${bill.currency_symbol} ${bill.amount}` : "-", // Currency symbol and amount together
    payment_gateway: bill.gateway_name,
  }));
  
  // return res.status(200).json(response);
  res.status(201).json({
    status: true,
    message: "Billing fetched successfully",
    data: data,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    totalRecords: count
  });
    
  } catch (error) {
    logger.error("Billing Fetch Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
});    

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  process.exit(0);
});

// Use Version 1 Router
app.use("/api", v1Router);
const PORT = 3017;
app.listen(process.env.PORT_BILLING,'0.0.0.0', () => {
  console.log(`billing Service running on port ${process.env.PORT_BILLING}`);
});
