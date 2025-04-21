import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
const Company = db.Company;
const User =db.User;
const GRN = db.GRN;
const GRNItem = db.GRNItem;
const PurchaseOrder = db.PurchaseOrder;
const ItemMaster = db.ItemMaster;
const PurchaseOrderItem = db.PurchaseOrderItem;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();



// create grn and grn items
v1Router.post("/grn", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { items, ...grnData } = req.body;

    grnData.created_by = req.user.id;
    grnData.updated_by = req.user.id;
    grnData.company_id = req.user.company_id;

    const poId = grnData.po_id;
    const validatePo = await PurchaseOrder.findOne({
      where: { po_id: poId, status: "active" },
      transaction
    });

    if (!validatePo) {
      throw new Error("Invalid or inactive Purchase Order.");
    }

    const newGRN = await GRN.create(grnData, { transaction });

    for (const item of items) {
      item.created_by = req.user.id;
      item.updated_by = req.user.id;
      item.company_id = req.user.company_id;
      item.grn_id = newGRN.grn_id;

      const poItem = await PurchaseOrderItem.findOne({
        where: { po_item_id: item.po_item_id },
        transaction
      });
      if (!poItem) throw new Error(`PO Item ${item.po_item_id} not found`);

      const itemMaster = await ItemMaster.findOne({
        where: { item_id: item.item_id },
        transaction
      });
      if (!itemMaster) throw new Error(`Item ${item.item_id} not found`);

      await GRNItem.create(item, { transaction });
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "GRN and items created successfully",
      data: newGRN
    });

  } catch (error) {
    await transaction.rollback();
    console.error("GRN creation error:", error.message);
    return res.status(500).json({
      success: false,
      message: `GRN creation failed: ${error.message}`
    });
  }
});


// get grn 
v1Router.get("/grn", authenticateJWT, async (req, res) => {
    try {
      const { search = "", page = "1", limit = "10" } = req.query;
      const pageNumber = Math.max(1, parseInt(page));
      const limitNumber = Math.max(1, parseInt(limit));
      const offset = (pageNumber - 1) * limitNumber;
  
      const whereCondition = {
        status: "active",
      };
  
      if (search.trim() !== "") {
        whereCondition.grn_number = { [Op.like]: `%${search}%` };
      }
  
      const grns = await GRN.findAll({
        where: whereCondition,
        limit: limitNumber,
        offset,
        include: [{ model: GRNItem }]
      });
  
      const totalCount = await GRN.count({ where: whereCondition });
  
      return res.status(200).json({
        success: true,
        message: "GRNs fetched successfully",
        data: grns,
        totalCount
      });
  
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });


//  get one grn 
v1Router.get("/grn/:id", authenticateJWT, async (req, res) => {
    try {
      const grnId = req.params.id;
  
      // Fetch GRN
      const grn = await GRN.findOne({
        where: { grn_id: grnId },
        include: [
          {
            model: GRNItem,
            as: "GRNItems" // Ensure alias matches your association
          }
        ]
      });
  
      if (!grn) {
        return res.status(404).json({
          success: false,
          message: "GRN not found"
        });
      }
  
      return res.status(200).json({
        success: true,
        message: "GRN fetched successfully",
        data: grn
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
  
      const grn = await GRN.findOne({ where: { grn_id: grnId }, transaction });
  
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
  
      const grn = await GRN.findOne({ where: { grn_id: grnId }, transaction });
  
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
  
  



app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3024;
app.listen(PORT, () => {
  console.log(`Purchase running on port ${PORT}`);
});