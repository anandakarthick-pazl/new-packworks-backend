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
import { create } from "domain";
import SalesOrder from "../../common/models/salesOrder/salesOrder.model.js";

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
const WorkOrderInvoice = db.WorkOrderInvoice;
const Inventory = db.Inventory;
const Sku = db.Sku;


// Sales Return Creation Endpoint
v1Router.post("/sales-return", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  const companyId = req.user.company_id;
  const userId = req.user.id;
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
    const return_id = await generateId(companyId, db.SalesReturn, 'sales_returns');
    console.log(return_id)
    console.log("User Id " + " " + userId)
    // const return_number = `RET-${Date.now()}`;

    // 1. Create Sales Return Header
    const salesReturnHeader = await db.SalesReturn.create({
      return_generate_id: return_id,
      sales_id: sales_order_id,
      client_id,
      return_date: return_date || new Date(),
      reason: return_reason,
      notes,
      // created_by: req.user.user_id,
      created_at: new Date(),
      total_qty,
      cgst_amount,
      sgst_amount,
      igst_amount,
      amount,
      tax_amount,
      total_amount,
      company_id: companyId,
      created_by: userId,
      created_at: new Date()

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
      created_by: userId,
      created_at: new Date()
    }));

    await db.SalesReturnItem.bulkCreate(returnItemsData, { transaction });

    // 3. Handle Auto Credit Note Creation
    let creditNote = null;
    if (auto_Credit_Note === "yes") {
      // const credit_note_number = `CN-${Date.now()}`;

      creditNote = await db.CreditNote.create({
        credit_generate_id: await generateId(companyId, db.CreditNote, 'credit_note'),
        client_id,
        client_name,
        work_order_invoice_id: sales_order_id,
        work_order_invoice_number: sale_order_number,
        credit_reference_id: salesReturnHeader.id,
        subject: `Credit Note for Sales Return ${return_id}`,
        invoice_total_amout: total_amount,
        credit_total_amount: total_amount,
        status: "active",
        created_by: userId,
        company_id: companyId,
        created_at: new Date()
      }, { transaction });
    }

    // 4. Handle Wallet Update (if return_type is "wallet")
    let walletUpdate = null;
    if (return_type === "wallet") {
      console.log("Return Type is Wallet", total_amount, client_id);

      // Update client's credit balance
      const result = await db.Client.increment(
        { credit_balance: total_amount },
        {
          where: { client_id: client_id }, // ✅ Use the correct column
          transaction
        }
      );
      console.log("Increment result:", result);

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

    // 5. Create Inventory Records
    const inventoryData = [];
    for (const item of returnItemsData) {
      try {
        const inventory_generate_id = await generateId(req.user.company_id, Inventory, "inventory");
        const rate = item.unit_price || 0;
        const quantity_available = item.return_qty;
        const tax_amount = item.tax_amount || 0;
        const total_amount = quantity_available * rate;
        const total_amount_inventory = total_amount + tax_amount;

        // Parse sku_details if it's a string
        const skuDetails = typeof item.sku_details === 'string'
          ? JSON.parse(item.sku_details)
          : item.sku_details;

        // Fetch work order invoice
        const workOrderInvoice = await WorkOrderInvoice.findOne({
          where: { sale_id: sales_order_id, company_id: companyId },
          attributes: ["work_id", "invoice_number"],
        });

        // Fetch SKU data
        let skuData = null;
        if (skuDetails?.sku_id) {
          skuData = await Sku.findOne({
            where: { id: skuDetails.sku_id, company_id: companyId },
            attributes: ["sku_ui_id"],
          });
        }

        // 🔒 CHECK: Avoid duplicate insert
        const existingInventory = await Inventory.findOne({
          where: {
            company_id: companyId,
            sales_return_id: salesReturnHeader.id,
            sku_id: skuDetails?.sku_id || 0,
          },
          transaction
        });

        if (existingInventory) {
          console.log("⚠️ Inventory already exists for this return & SKU. Skipping...");
          continue; // Skip this item to prevent duplicate
        }

        console.log("Creating inventory for salesReturnHeader.id:", salesReturnHeader.id);
        console.log("Inventory Generate ID:", inventory_generate_id);

        const inventory = await Inventory.create({
          inventory_generate_id,
          company_id: companyId,
          item_id: 0,
          sku_id: skuDetails?.sku_id || 0,
          sku_generate_id: skuData?.sku_ui_id || null,
          work_order_id: workOrderInvoice?.work_id || null,
          quantity_available,
          rate,
          total_amount: total_amount_inventory,
          status: "active",
          category: 2,
          created_by: userId,
          created_at: new Date(),
          sales_return_id: salesReturnHeader.id,
        }, { transaction });

        console.log("Inventory created:", inventoryData.id, "for salesReturnHeader.id:", salesReturnHeader.id);
    inventoryData.push(inventory);
      } catch (err) {
        console.error("Error creating inventory for item:", item, err);
        throw err; // This will cause the transaction to rollback and error to propagate
      }
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
        wallet_update: walletUpdate,
        inventoryData:inventoryData
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

    // 1. Find Sales Return Header
    const salesReturn = await db.SalesReturn.findOne({
      where: { id: return_id } // Make sure this is the correct column name
    });

    if (!salesReturn) {
      return res.status(404).json({
        success: false,
        message: "Sales return not found"
      });
    }

    // 2. Find Return Items
    const returnItems = await db.SalesReturnItem.findAll({
      where: { sales_return_id: salesReturn.id }
    });
    const workOrderInvoice = await WorkOrderInvoice.findOne({
      where: {
        id: salesReturn.sales_id,
        company_id: req.user.company_id,
        status: "active",


      },
      attributes: ["id", "invoice_number", "total_amount", "created_at", "sku_details"], // adjust as needed
    });
    // 3. Find Client Info
    const client = await db.Client.findOne({
      where: { client_id: salesReturn.client_id },
      attributes: ["client_id", "display_name", "email", "credit_balance"]
    });

    // 4. Find Credit Note (optional)
    const creditNote = await db.CreditNote.findOne({
      where: { credit_reference_id: salesReturn.id }
    });

    // 5. Combine all data
    const responseData = {
      ...salesReturn.toJSON(),
      return_items: returnItems,
      client: client || null,
      credit_note: creditNote || null,
      invoiceDetails: workOrderInvoice ? workOrderInvoice.toJSON() : null
    };

    res.json({
      success: true,
      data: responseData
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
v1Router.get("/sales-return", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      client_id,
      return_type,
      status,
      start_date,
      end_date,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (client_id) where.client_id = client_id;
    if (return_type) where.return_type = return_type;
    if (status) where.status = status;

    if (start_date && end_date) {
      where.return_date = {
        [Op.between]: [new Date(start_date), new Date(end_date)],
      };
    }

    // Fetch sales returns (without associations)
    const { rows: salesReturns, count } = await db.SalesReturn.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    // Get unique client IDs
    const clientIds = [...new Set(salesReturns.map((ret) => ret.client_id))];

    // Fetch clients manually
    const clients = await db.Client.findAll({
      where: { client_id: clientIds },
      attributes: ["client_id", "display_name", "email"],
    });

    const clientMap = {};
    clients.forEach((client) => {
      clientMap[client.client_id] = client;
    });

    // Fetch work order invoices and attach data
    const results = await Promise.all(
      salesReturns.map(async (ret) => {
        const json = ret.toJSON();

        // Attach client info
        json.client = clientMap[ret.client_id] || null;

        // Attach work order invoice info
        const workOrderInvoice = await WorkOrderInvoice.findOne({
          where: {
            id: ret.sales_id,
            company_id: req.user.company_id,
            status: "active",
          },
          attributes: ["id", "invoice_number", "total_amount", "created_at", "sku_details"], // adjust as needed
        });

        json.work_order_invoice = workOrderInvoice || null;

        return json;
      })
    );

    res.json({
      success: true,
      data: {
        sales_returns: results,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / limit),
          total_records: count,
          per_page: parseInt(limit),
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching sales returns:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch sales returns",
      error: error.message,
    });
  }
});



// await db.sequelize.sync();
const PORT = 3005;
app.listen(process.env.PORT_SALESORDERRETURN, '0.0.0.0', () => {
  console.log(`Sales Order Return Service running on port ${process.env.PORT_SALESORDERRETURN}`);
});
