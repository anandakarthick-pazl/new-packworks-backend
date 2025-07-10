import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import { fileURLToPath } from "url";


const Company = db.Company;
const User =db.User;
const GRN = db.GRN;
const GRNItem = db.GRNItem;
const PurchaseOrder = db.PurchaseOrder;
const ItemMaster = db.ItemMaster;
const PurchaseOrderItem = db.PurchaseOrderItem;
const Inventory = db.Inventory;
const Categories = db.Categories;
const Sub_categories = db.Sub_categories;
const PurchaseOrderBilling = db.PurchaseOrderBilling;


dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// FIX 1: Ensure the public directory structure is correct
const publicDir = path.join(__dirname, "../../public");
const qrCodeDir = path.join(publicDir, "inventory_qrcodes");

// Ensure directories exist
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(qrCodeDir)) {
  fs.mkdirSync(qrCodeDir, { recursive: true });
}

// Serve the entire public directory, not just qrcodes
app.use("/public", express.static(publicDir));
// Also serve qrcodes directly for backward compatibility
app.use("/qrcodes", express.static(qrCodeDir));

async function generateQRCode(inventoryData, token) {
  try {
    const { inventory_generate_id } = inventoryData;

    if (!inventory_generate_id) {
      throw new Error("Missing inventory_generate_id in inventoryData");
    }


    const textContent = `Inventory: ${inventoryData.inventory_generate_id}`.trim();
    const sanitizedId = inventory_generate_id.replace(/[^a-zA-Z0-9]/g, "_");
    const timestamp = Date.now();
    const qrFileName = `inventory_${sanitizedId}_${timestamp}.png`;
    const qrFilePath = path.join(qrCodeDir, qrFileName);


    await QRCode.toFile(qrFilePath, textContent, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 300,
    });

    if (!fs.existsSync(qrFilePath)) {
      throw new Error("QR code file was not created successfully");
    }

    // Prepare form data for upload
    const form = new FormData();
    form.append("file", fs.createReadStream(qrFilePath));

      // const qrCodeUrl =`http://localhost:4024/public/qrcodes/${qrFileName}`;
      // return qrCodeUrl;


    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${process.env.BASE_URL}/file/upload`,
      headers: {
        Authorization: `Bearer ${token}`, 
        ...form.getHeaders(),
      },
      data: form,
    };

    const uploadResponse = await axios.request(config);
    console.log("Upload response:", uploadResponse);
    if (uploadResponse.status !== 200 || !uploadResponse.data?.data?.file_url) {
      throw new Error("Failed to upload QR code image.");
    }
    const uploadedImageUrl = uploadResponse.data?.data?.file_url || "";
    fs.unlinkSync(qrFilePath);
    return uploadedImageUrl;
  } catch (error) {
    console.error("GRN creation error:", error);    
  }
}


// post grn
v1Router.post("/grn", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const grn_generate_id = await generateId(req.user.company_id, GRN, "grn");
    const inventory_generate_id = await generateId(req.user.company_id, Inventory, "inventory");
    const { items, ...grnData } = req.body;

    grnData.created_by = req.user.id;
    grnData.updated_by = req.user.id;
    grnData.grn_generate_id = grn_generate_id;
    grnData.company_id = req.user.company_id;

    const validatePo = await PurchaseOrder.findOne({
      where: { id: grnData.po_id, status: "active" },
      transaction
    });

    if (!validatePo) throw new Error("Invalid or inactive Purchase Order.");

    let newGRN = null;

    for (const item of items) {
      const {
        po_item_id, item_id, item_code, grn_item_name, description,
        quantity_ordered, quantity_received, accepted_quantity,
        rejected_quantity, notes, unit_price,
        cgst, cgst_amount, sgst, sgst_amount,
        amount, tax_amount, total_amount,
        work_order_no, batch_no, location
      } = item;

      const poItem = await PurchaseOrderItem.findOne({
        where: { id: po_item_id },
        attributes: ['quantity'],
        transaction
      });

      if (!poItem) throw new Error(`PO Item ${po_item_id} not found`);

      // Calculate cumulative accepted quantity across all GRNs
      const existingGrns = await GRNItem.findAll({
        where: { po_item_id },
        attributes: ['accepted_quantity'],
        transaction
      });

      const previouslyAcceptedQty = existingGrns.reduce((sum, item) => sum + parseFloat(item.accepted_quantity || 0), 0);
      const totalAcceptedQty = previouslyAcceptedQty + parseFloat(accepted_quantity || 0);

      const grnStatus = (totalAcceptedQty >= parseFloat(poItem.quantity))
        ? "fully_received"
        : "partially_received";

      if (!newGRN) {
        grnData.grn_status = grnStatus;
        newGRN = await GRN.create(grnData, { transaction });
      }

      const itemMaster = await ItemMaster.findOne({ where: { id: item_id }, transaction });
      if (!itemMaster) throw new Error(`Item ${item_id} not found`);

      const category = itemMaster.category;
      const sub_category = itemMaster.sub_category;

      const newGRNItem = await GRNItem.create({
        grn_id: newGRN.id,
        po_item_id,
        item_id,
        item_code,
        grn_item_name,
        description,
        quantity_ordered,
        quantity_received,
        accepted_quantity,
        rejected_quantity,
        unit_price,
        notes,
        work_order_no,
        batch_no,
        location,
        cgst, cgst_amount, sgst, sgst_amount,
        amount, tax_amount, total_amount,
        created_by: req.user.id,
        updated_by: req.user.id,
        company_id: req.user.company_id,
        grn_item_status: grnStatus
      }, { transaction });


      // Determine stock status
        const acceptedQty = parseFloat(accepted_quantity);
        const minStock = parseFloat(itemMaster.min_stock_level || 0);

        let stock_status = 'in_stock';
        if (acceptedQty === 0) {
          stock_status = 'out_of_stock';
        } else if (acceptedQty <= minStock) {
          stock_status = 'low_stock';
        }

      const newInventory = await Inventory.create({
        inventory_generate_id: inventory_generate_id,
        company_id: req.user.company_id,
        item_id,
        item_code,
        grn_id: newGRN.id,
        grn_item_id: newGRNItem.id,
        po_id: grnData.po_id,
        category,
        sub_category,
        po_item_id,
        work_order_no,
        description,
        quantity_available: parseFloat(accepted_quantity),
        rate: newGRNItem.unit_price,
        total_amount: parseFloat(accepted_quantity) * newGRNItem.unit_price,
        batch_no,
        location,
        status: 'active',
        stock_status,
        created_by: req.user.id,
        updated_by: req.user.id
      }, { transaction });

      const authHeader = req.headers.authorization;
      const token = authHeader.split(" ")[1];
      const qrCodeUrl = await generateQRCode(newInventory, token);
  
      // Update work order with QR code URL
    if (qrCodeUrl) {
      await newInventory.update({ qr_code_url: qrCodeUrl }, { transaction });
    } else {
      throw new Error("QR code URL generation failed");
    }



    }
    const allPoItems = await PurchaseOrderItem.findAll({ where: { po_id: grnData.po_id }, transaction });
    const allGrns = await GRN.findAll({ where: { po_id: grnData.po_id }, transaction });
    const allGrnIds = allGrns.map(grn => grn.id);
    const allGrnItems = await GRNItem.findAll({ where: { grn_id: allGrnIds }, transaction });

    const allReceived = allPoItems.every(poItem =>
      allGrnItems
        .filter(grnItem => grnItem.po_item_id === poItem.id)
        .reduce((total, grnItem) => total + parseFloat(grnItem.accepted_quantity || 0), 0) >= parseFloat(poItem.quantity || 0)
    );

    await PurchaseOrder.update(
      { po_status: allReceived ? "received" : "partialy-recieved" },
      { where: { id: grnData.po_id }, transaction }
    );

    await transaction.commit();
    return res.status(200).json({ success: true, message: "GRN and inventory updated successfully", data: newGRN });

  } catch (error) {
    await transaction.rollback();
    console.error("GRN creation error:", error);
    return res.status(500).json({ success: false, message: `GRN creation failed: ${error.message}` });
  }
});

















v1Router.get("/grn", authenticateJWT, async (req, res) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, parseInt(limit));
    const offset = (pageNumber - 1) * limitNumber;

    const whereCondition = {};
whereCondition.status="active"
    // Enhanced search functionality across all relevant fields
    if (search.trim() !== "") {
      whereCondition[Op.or] = [
        { delivery_note_no: { [Op.like]: `%${search}%` } },
        { invoice_no: { [Op.like]: `%${search}%` } },
        { received_by: { [Op.like]: `%${search}%` } }
      ];
      
      // If search could be a number (for po_id)
      if (!isNaN(search)) {
        whereCondition[Op.or].push({ po_id: parseInt(search) });
      }
    }

    const grns = await GRN.findAll({
      where: whereCondition,
      limit: limitNumber,
      offset,
      include: [
        { model: GRNItem },
        {
        model: PurchaseOrder,
        as: 'purchase_order',
        attributes: ['id', 'purchase_generate_id'], // fetch only what's needed
        required: false
        }
      ],
      order: [['updated_at', 'DESC']] 
    });
    

    const totalCount = await GRN.count({ where: whereCondition });

    return res.status(200).json({
      success: true,
      message: "GRNs fetched successfully",
      data: grns,
      totalCount,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalCount / limitNumber),
        pageSize: limitNumber,
        totalRecords: totalCount
      }
    });

  } catch (error) {
    console.error("Error fetching GRNs:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

//  get one grn 
v1Router.get("/grn/:id", authenticateJWT, async (req, res) => {
    try {
      const grnId = req.params.id;
  
      // Fetch GRN
      const grn = await GRN.findOne({
        where: { id: grnId },
        include: [
          {
            model: GRNItem,
            as: "GRNItems", // Ensure alias matches your association
            include: [
            {
              model: ItemMaster,
              as: "item_info", // Alias from GRNItem → ItemMaster association
              attributes: ["id", "item_generate_id","item_name"]
            },
          ]
          },
          {
          model: PurchaseOrder,
          as: "purchase_order",
          include: [
            {
              model: PurchaseOrderItem,
              as: "PurchaseOrderItems"
            }
          ]
        }
        ]
      });
  
      if (!grn) {
        return res.status(404).json({
          success: false,
          message: "GRN not found"
        });
      }

      const po = grn.purchase_order; // this is the PurchaseOrder instance
      const poId = po?.id;

      if (!poId) {
        return res.status(404).json({ success: false, message: "Purchase Order not found in GRN" });
      }

      const bills = await PurchaseOrderBilling.findAll({
        where: { purchase_order_id: poId },
        attributes: ["id", "bill_generate_id"]
      });
  
      return res.status(200).json({
        success: true,
        message: "GRN fetched successfully",
        data: grn,
        bills:bills
      });
    } catch (error) {
      console.error("Fetch GRN error:", error.message);
      return res.status(500).json({
        success: false,
        message: `Error fetching GRN: ${error.message}`
      });
    }
  });
  
  


//   update grn 
v1Router.put("/grn/:id", authenticateJWT, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const { items, ...grnData } = req.body;
      const grnId = req.params.id;
  
      const grn = await GRN.findOne({ where: { id: grnId }, transaction });
  
      if (!grn) {
        return res.status(404).json({ success: false, message: "GRN not found" });
      }
  
      grnData.updated_by = req.user.id;
      await grn.update(grnData, { transaction });
  
      // Delete old items
      await GRNItem.destroy({ where: { grn_id: grnId }, transaction });
  
      for (const item of items) {
        item.grn_id = grnId;
        item.created_by = req.user.id;
        item.updated_by = req.user.id;
        item.company_id = req.user.company_id;
  
        await GRNItem.create(item, { transaction });
      }



       const poId = grn.po_id;

      const allPoItems = await PurchaseOrderItem.findAll({
        where: { po_id: poId },
        transaction,
      });
      
      const allGrns = await GRN.findAll({
        where: { po_id: poId },
        transaction,
      });
      const allGrnIds = allGrns.map(grn => grn.id);

      const allGrnItems = await GRNItem.findAll({
        where: { grn_id: allGrnIds },
        transaction,
      });



    const allReceived = allPoItems.every(poItem =>
      allGrnItems
        .filter(grnItem => grnItem.po_item_id === poItem.id)
        .reduce((total, grnItem) => total + parseFloat(grnItem.quantity_received || 0), 0) >= parseFloat(poItem.quantity || 0)
    );

          console.log("allReceived", allReceived);

      await PurchaseOrder.update(
        { po_status: allReceived ? "received" : "partialy-recieved" },
        { where: { id: poId }, transaction }
      );

      const currentGrnItems = await GRNItem.findAll({ where: { grn_id: grnId }, transaction });
      for (const grnItem of currentGrnItems) {
        const totalAccepted = allGrnItems
          .filter(g => g.po_item_id === grnItem.po_item_id)
          .reduce((sum, g) => sum + parseFloat(g.accepted_quantity || 0), 0);

        const poItem = allPoItems.find(p => p.id === grnItem.po_item_id);
        const expectedQty = parseFloat(poItem?.quantity || 0);

        const status = totalAccepted >= expectedQty ? "fully_received" : "partially_received";

        await grnItem.update({ grn_item_status: status }, { transaction });
      }

      console.log("allReceived", allReceived);
  
      await transaction.commit();
  
      return res.status(200).json({
        success: true,
        message: "GRN updated successfully",
        data: grn,
      });
  
    } catch (error) {
      await transaction.rollback();
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  
//   delete grn 
v1Router.delete("/grn/:id", authenticateJWT, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const grnId = req.params.id;
  
      const grn = await GRN.findOne({ where: { id: grnId }, transaction });
  
      if (!grn) {
        return res.status(404).json({ success: false, message: "GRN not found" });
      }
  
      // Optionally delete GRN items
    //   await GRNItem.destroy({ where: { grn_id: grnId }, transaction });
  
      // Soft delete or hard delete depending on your model setup
      await grn.update({ status: "inactive", updated_by: req.user.id },{ transaction });

  
      await transaction.commit();
  
      return res.status(200).json({
        success: true,
        message: "GRN deleted successfully"
      });
  
    } catch (error) {
      await transaction.rollback();
      return res.status(500).json({ success: false, message: error.message });
    }
  });



  v1Router.get("/grn/bill/:id", authenticateJWT, async (req, res) => {
  try {
    const grnId = req.params.id;
    

    // Find the corresponding purchase order
    const po = await PurchaseOrder.findOne({
      where: { id: grnId },
      attributes: ["id"]
    });

    if (!po) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found"
      });
    }    

    const bills = await PurchaseOrderBilling.findAll({
      where: { purchase_order_id: po.id },
      attributes: ["id", "bill_generate_id"]
    });

    return res.status(200).json({
      success: true,
      data: bills
    });

  } catch (error) {
    console.error("Error fetching GRN bill:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase order billing"
    });
  }
});

  
  



app.use("/api", v1Router);
// await db.sequelize.sync();
const PORT = process.env.PORT_GRN;
app.listen(process.env.PORT_GRN,'0.0.0.0', () => {
  console.log(`Purchase running on port ${process.env.PORT_GRN}`);
});