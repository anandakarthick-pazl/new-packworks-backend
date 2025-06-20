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
import axios from 'axios';
import FormData from "form-data";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

// Use Version 1 Router
const v1Router = Router();
app.use("/api", v1Router);

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
  });
});

// Sales Return Creation Endpoint
v1Router.post("/sales-return", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  const companyId = req.user.company_id;
  const userId = req.user.user_id;
  try {
    const {
      // Header level data
      sales_order_id,
      sale_order_number,
      client_id,
      client_name,
      return_date,
      return_reason,
      total_qty,
      cgst_amount,
      sgst_amount,
      igst_amount,
      amount,
      tax_amount,
      total_amount,

      // Items level data
      return_items, // Array of items to return
      // Parameters
      auto_Credit_Note, // "yes" or "no"
      return_type, // "wallet" or "refund"
      notes
    } = req.body;

    // Validate required fields
    if (!sales_order_id || !client_id || !return_items || return_items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: sales_order_id, client_id, or return_items"
      });
    }

    // Generate unique return ID
    const return_id = generateId(companyId, db.SalesReturn, 'sales_returns');
    // const return_number = `RET-${Date.now()}`;

    // 1. Create Sales Return Header
    const salesReturnHeader = await db.SalesReturn.create({
      return_generate_id: return_id,
      sales_order_id,
      client_id,
      return_date: return_date || new Date(),
      reason: return_reason,
      notes,
      created_by: req.user.user_id,
      created_at: new Date(),
      total_qty,
      cgst_amount,
      sgst_amount,
      igst_amount,
      amount,
      tax_amount,
      total_amount,
      company_id: companyId,

    }, { transaction });

    // 2. Create Sales Return Items
    const returnItemsData = return_items.map(item => ({
      sales_return_id: salesReturnHeader.id,
      sales_item_id: item.sales_item_id,
      item_id: item.product_id,
      return_qty: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      cgst: item.cgst || 0,
      cgst_amount: item.cgst_amount || 0,
      sgst: item.sgst || 0,
      sgst_amount: item.sgst_amount || 0,
      igst: item.igst || 0,
      igst_amount: item.igst_amount || 0,
      amount: item.amount || 0,
      tax_amount: item.tax_amount || 0,
      total_amount: item.total_amount || 0,
      notes: item.notes || null,
      reason: item.reason || return_reason,
      company_id: companyId,
      created_by: req.user.user_id,
      created_at: new Date()
    }));

    await db.SalesReturnItem.bulkCreate(returnItemsData, { transaction });

    // 3. Handle Auto Credit Note Creation
    let creditNote = null;
    if (auto_Credit_Note === "yes") {
      // const credit_note_number = `CN-${Date.now()}`;

      creditNote = await db.CreditNote.create({
        credit_generate_id: generateId(companyId, db.CreditNote, 'credit_note'),
        client_id,
        client_name,
        work_order_invoice_id: sales_order_id,
        work_order_invoice_number: sale_order_number,
        credit_reference_id: salesReturnHeader.id,
        subject: `Credit Note for Sales Return ${return_id}`,
        invoice_total_amout: invoice_total_amout,
        credit_total_amount: total_amount,
        status: "active",
        created_by: req.user.user_id,
        created_at: new Date()
      }, { transaction });
    }

    // 4. Handle Wallet Update (if return_type is "wallet")
    let walletUpdate = null;
    if (return_type === "wallet") {
      // Update client's credit balance
      await db.Client.increment(
        { credit_balance: total_amount },
        {
          where: { id: client_id },
          transaction
        }
      );

      // Create wallet history entry
      walletUpdate = await db.WalletHistory.create({
        client_id,
        type: "credit",
        company_id: companyId,
        created_by: userId,
        amount: total_amount,
        refference_number: `Sales return credited to wallet for return ID ${return_id}`,
        created_at: new Date()
      }, { transaction });


    }

    // Commit transaction
    await transaction.commit();

    // Prepare response
    const response = {
      success: true,
      message: "Sales return created successfully",
      data: {
        return_header: salesReturnHeader,
        return_items: returnItemsData,
        credit_note: creditNote,
        wallet_update: walletUpdate
      }
    };

    logger.info(`Sales return created: ${return_id}`, {
      user_id: req.user.user_id,
      return_id,
      client_id,
      total_amount,
      return_type,
      auto_credit_note: auto_Credit_Note
    });

    res.status(201).json(response);

  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();

    logger.error("Error creating sales return:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create sales return",
      error: error.message
    });
  }
});

// Get Sales Return Details
v1Router.get("/sales-return/:return_id", authenticateJWT, async (req, res) => {
  try {
    const { return_id } = req.params;

    const salesReturn = await db.SalesReturn.findOne({
      where: { return_id },
      include: [
        {
          model: db.SalesReturnItem,
          as: "return_items"
        },
        {
          model: db.Client,
          as: "client",
          attributes: ["client_id", "name", "email", "credit_balance"]
        },
        {
          model: db.CreditNote,
          as: "credit_note",
          required: false
        }
      ]
    });

    if (!salesReturn) {
      return res.status(404).json({
        success: false,
        message: "Sales return not found"
      });
    }

    res.json({
      success: true,
      data: salesReturn
    });

  } catch (error) {
    logger.error("Error fetching sales return:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch sales return",
      error: error.message
    });
  }
});

// List Sales Returns
v1Router.get("/sales-returns", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      client_id,
      return_type,
      status,
      start_date,
      end_date
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    if (client_id) where.client_id = client_id;
    if (return_type) where.return_type = return_type;
    if (status) where.status = status;

    if (start_date && end_date) {
      where.return_date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    }

    const { rows: salesReturns, count } = await db.SalesReturn.findAndCountAll({
      where,
      include: [
        {
          model: db.Client,
          as: "client",
          attributes: ["client_id", "name", "email"]
        }
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        sales_returns: salesReturns,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / limit),
          total_records: count,
          per_page: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error("Error fetching sales returns:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch sales returns",
      error: error.message
    });
  }
});

// await db.sequelize.sync();
const PORT = 3005;
app.listen(process.env.PORT_SALESORDERRETURN, '0.0.0.0', () => {
  console.log(`Sales Order Return Service running on port ${process.env.PORT_SALESORDERRETURN}`);
});
