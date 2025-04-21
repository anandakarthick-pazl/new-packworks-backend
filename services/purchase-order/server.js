import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
const Company = db.Company;
const User =db.User;
const PurchaseOrder = db.PurchaseOrder;
const PurchaseOrderItem = db.PurchaseOrderItem;
const ItemMaster = db.ItemMaster;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();

//Create Po
v1Router.post("/purchase-order", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { items, ...poData } = req.body;
    poData.created_by = req.user.id;
    poData.updated_by = req.user.id;
    poData.company_id = req.user.company_id;

    const newPO = await PurchaseOrder.create(poData, { transaction });
    for (const item of items) {
      const isValid = await ItemMaster.findOne({
        where: { item_id: item.item_id, status: "active" },
        transaction,
      });

      if (!isValid) throw new Error(`Item ID ${item.item_id} is invalid or inactive`);

      await PurchaseOrderItem.create({
        ...item,
        po_id: newPO.po_id,
        company_id: poData.company_id,
        created_by: poData.created_by,
        updated_by: poData.updated_by
      }, { transaction });
    }

    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: "Purchase Order with items created successfully",
      data: newPO
    });

  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: `Creation Failed: ${error.message}`
    });
  }
});

//get all Po
v1Router.get("/purchase-order", authenticateJWT, async (req, res) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, parseInt(limit));
    const offset = (pageNumber - 1) * limitNumber;

    let where = { status: "active", decision: "approve" };
    if (search.trim()) {
      where.supplier_name = { [Op.like]: `%${search}%` };
    }

    const data = await PurchaseOrder.findAll({
      where,
      limit: limitNumber,
      offset,
      include: [{ model: PurchaseOrderItem }]  // Optional: include items
    });

    const totalCount = await PurchaseOrder.count({ where });

    return res.status(200).json({
      success: true,
      message: "Purchase orders fetched",
      data,
      totalCount,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Fetching failed: ${error.message}`,
    });
  }
});

//get one po
v1Router.get("/purchase-order/:id", authenticateJWT,async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({
      where: { po_id: req.params.id, status: "active" },
      include: [{ model: PurchaseOrderItem }],
    });

    if (!po) return res.status(404).json({ success: false, message: "Not found" });

    return res.status(200).json({
      success: true,
      message: "Purchase Order fetched",
      data: po,
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

//update po
v1Router.put("/purchase-order/:id", authenticateJWT, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const { items, ...poData } = req.body;
      const poId = req.params.id;
  
      const po = await PurchaseOrder.findOne({
        where: { po_id: poId },
        transaction
      });
  
      if (!po) {
        return res.status(404).json({
          success: false,
          message: "Purchase Order not found"
        });
      }
  
      // Update purchase order
      poData.updated_by = req.user.id;
      await po.update(poData, { transaction });
  
      console.log("po Id ", poId)
      // Delete old purchase order items
     const deletePOId= await PurchaseOrderItem.destroy({
        where: { po_id: poId },
        transaction
      });
      console.log(" Delete po Id ", deletePOId)
  
      // Recreate new purchase order items
      for (const item of items) {
        await PurchaseOrderItem.create({
          ...item,
          po_id: poId,
          company_id: req.user.company_id,
          created_by: req.user.id,
          updated_by: req.user.id
        }, { transaction });
      }
  
      await transaction.commit();
  
      return res.status(200).json({
        success: true,
        message: "Purchase Order and Items updated successfully",
        data: po
      });
  
    } catch (error) {
      await transaction.rollback();
      console.error("Update Error:", error.message);
      return res.status(500).json({
        success: false,
        message: `Update failed: ${error.message}`
      });
    }
  });
  

// delete po
v1Router.delete("/purchase-order/:id", authenticateJWT, async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ where: { po_id: req.params.id } });
    if (!po) return res.status(404).json({ success: false, message: "Not found" });

    await po.update({ status: "inactive", updated_by: req.user.id });

    return res.status(200).json({
      success: true,
      message: "Purchase Order deleted (soft delete)",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});


//connection port
app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3023;
app.listen(PORT, () => {
  console.log(`Purchase running on port ${PORT}`);
});
