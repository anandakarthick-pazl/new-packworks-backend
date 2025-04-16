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



////////////////////////////////////////////////////////////  GRN   ///////////////////////////////////////////////////////////////

// get grn 
v1Router.get("/grn", authenticateJWT, async (req, res) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNumber = Math.max(1, parseInt(page) || 1);
    const limitNumber = Math.max(1, parseInt(limit) || 10);
    const offset = (pageNumber - 1) * limitNumber;
    let whereCondition = { status: "active" };
    if (search.trim() !== "") {
      whereCondition = {
        ...whereCondition,
        invoice_no: { [Op.like]: `%${search}%` },
      };
    }
    const grnData = await GRN.findAll({
      where: whereCondition,
      limit: limitNumber,
      offset: offset,
    });
    return res.status(200).json({
      success: true,
      message: "GRN data fetched successfully",
      data: grnData,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `GRN data fetching error: ${error.message}`,
    });
  }
});

// Create grn 
v1Router.post("/grn",authenticateJWT,async(req,res)=>{
  const transaction = await sequelize.transaction();
  try{
    const { ...rest } = req.body;
    rest.created_by = req.user.id;
    rest.updated_by = req.user.id;
    rest.company_id = req.user.company_id;
    
    // Validate po_id
    const poId = req.body.po_id;
    const validatePo = await PurchaseOrder.findOne({
      where: { po_id: poId, status: "active" }
    });

    const grnData = await GRN.create(rest,{ transaction });
    await transaction.commit();
    return res.status(200).json({
      success : true,
      message : `Grn Created Successfully`,
      data : grnData
    });
  }catch(error){
    await transaction.rollback();
    console.error(error.message);
    return res.status(500).json({
      success : false,
      message : `GRN created Error : ${error.message}`
    });    
  }
});

// edit GRN 
v1Router.get("/grn/:id", authenticateJWT, async (req, res) => {
  try {
    const grnId = req.params.id;
    if (!grnId) {
      return res.status(400).json({
        success: false,
        message: `GRN ID is required.`,
      });
    }
    const grnData = await GRN.findOne({
      where: { grn_id: grnId, status: 'active' },
    });
    if (!grnData) {
      return res.status(404).json({
        success: false,
        message: `GRN not found.`,
      });
    }
    return res.status(200).json({
      success: true,
      message: `GRN fetched successfully.`,
      data: grnData,
    });
  } catch (error) {
    console.error("GRN Fetch Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `GRN fetch error: ${error.message}`,
    });
  }
});

// update grn 
v1Router.put("/grn/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const grnId = req.params.id;
    const { ...rest } = req.body;
    if (!grnId) {
      return res.status(400).json({
        success: false,
        message: `GRN ID is required.`,
      });
    }
    rest.updated_by = req.user.id;
    rest.updated_at = new Date();
    rest.company_id = req.user.company_id;
    const existingData = await GRN.findOne({ where: { grn_id: grnId } });
    if (!existingData) {
      return res.status(404).json({
        success: false,
        message: `GRN not found.`,
      });
    }
    const poId = req.body.po_id;
    const validatePo = await PurchaseOrder.findOne({
      where: { po_id: poId, status: "active" }
    });
    if (!validatePo) {
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive Purchase Order.`,
      });
    }
    await GRN.update(rest, {
      where: { grn_id: grnId },
      transaction
    });
    const updatedGrnData = await GRN.findOne({ where: { grn_id: grnId },transaction });
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: `GRN updated successfully.`,
      data: updatedGrnData
    });

  } catch (error) {
    await transaction.rollback();
    console.error("GRN Update Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `GRN update error: ${error.message}`
    });
  }
});

// Delete grn 
v1Router.delete("/grn/:id", authenticateJWT, async (req, res) => {
  try {
    const grnId = req.params.id;
    if (!grnId) {
      return res.status(400).json({
        success: false,
        message: `GRN ID is required`
      });
    }
    const existingData = await GRN.findOne({ where: { grn_id: grnId } });
    if (!existingData) {
      return res.status(404).json({
        success: false,
        message: `GRN not found`
      });
    }
    await GRN.update(
      {
        status: "inactive",
        deleted_at: new Date(),
        updated_by: req.user.id,
        updated_at: new Date(),
      },{
        where: { grn_id: grnId }
      }
    );
    return res.status(200).json({
      success: true,
      message: `GRN deleted successfully`,
      data: []
    });
  } catch (error) {
    console.error("GRN Delete Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `GRN delete error: ${error.message}`
    });
  }
});

/////////////////////////////////////////////////////   grn_items     ///////////////////////////////////////////////////////////

// get grn_items 
v1Router.get("/grn-items", authenticateJWT, async (req, res) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNumber = Math.max(1, parseInt(page) || 1);
    const limitNumber = Math.max(1, parseInt(limit) || 10);
    const offset = (pageNumber - 1) * limitNumber;
    let whereCondition = { status: "active" };
    if (search.trim() !== "") {
      whereCondition.grn_item_name = { [Op.like]: `%${search}%` };
    }
    const grnData = await GRNItem.findAndCountAll({
      where: whereCondition,
      limit: limitNumber,
      offset,
    });
    return res.status(200).json({
      success: true,
      message: `GRN items fetched successfully`,
      data: grnData.rows,
      total: grnData.count,
      page: pageNumber,
      limit: limitNumber,
    });

  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `GRN item fetch error: ${error.message}`
    });
  }
});


//create grn_items
v1Router.post("/grn-items", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { ...rest } = req.body;
    rest.created_by = req.user.id;
    rest.updated_by = req.user.id;
    rest.company_id = req.user.company_id;
    const poItemId=req.body.po_item_id;
    const poItemData = await PurchaseOrderItem.findOne({
          where: { po_item_id: poItemId },
        });
        if (!poItemData) {
          return res.status(404).json({
            success: false,
            message: "PO Item not found",
          });
        }
    const grnId=req.body.grn_id;
    const grnData = await GRN.findOne({
          where: { grn_id: grnId },
        });
        if (!grnData) {
          return res.status(404).json({
            success: false,
            message: "GRN not found",
          });
        }
    const itemId=req.body.item_id;
    const itemData = await ItemMaster.findOne({
          where: { item_id: itemId },
        });
        if (!itemData) {
          return res.status(404).json({
            success: false,
            message: "Item not found",
          });
        }
    const grnItemData = await GRNItem.create(rest, { transaction });
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: "GRN item created successfully",
      data: grnItemData
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `GRN item creation error: ${error.message}`
    });
  }
});

// edit grn 
v1Router.get("/grn-item/:id", authenticateJWT, async (req, res) => {
  try {
    const grnItemId = parseInt(req.params.id);
    if (isNaN(grnItemId)) {
      return res.status(400).json({
        success: false,
        message: "Valid GRN item ID is required",
      });
    }
    const grnItemData = await GRNItem.findOne({
      where: { grn_item_id: grnItemId },
    });
    if (!grnItemData) {
      return res.status(404).json({
        success: false,
        message: "GRN item not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "GRN item fetched successfully",
      data: grnItemData,
    });
  } catch (error) {
    console.error("Error fetching GRN item:", error.message);
    return res.status(500).json({
      success: false,
      message: `GRN item fetching error: ${error.message}`,
    });
  }
});

// update grn 
v1Router.put("/grn-item/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const grnItemId = parseInt(req.params.id);
    const { grn_id, item_id, po_item_id, ...rest } = req.body;
    if (isNaN(grnItemId)) {
      return res.status(400).json({
        success: false,
        message: "Valid GRN item ID is required",
      });
    }
    rest.updated_at = new Date();
    rest.updated_by = req.user.id;
    const poItemData = await PurchaseOrderItem.findOne({
      where: { po_item_id },
    });
    if (!poItemData) {
      return res.status(404).json({
        success: false,
        message: "PO Item not found",
      });
    }
    const grnData = await GRN.findOne({
      where: { grn_id },
    });
    if (!grnData) {
      return res.status(404).json({
        success: false,
        message: "GRN not found",
      });
    }
    const itemData = await ItemMaster.findOne({
      where: { item_id },
    });
    if (!itemData) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }
    const existingData = await GRNItem.findOne({
      where: { grn_item_id: grnItemId },
    });
    if (!existingData) {
      return res.status(404).json({
        success: false,
        message: "GRN Item not found",
      });
    }
    await GRNItem.update(
      { grn_id, item_id, po_item_id, ...rest },
      { where: { grn_item_id: grnItemId }, transaction }
    );
    const updatedGrnItemData = await GRNItem.findByPk(grnItemId, { transaction });
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: "GRN item updated successfully",
      data: updatedGrnItemData,
    });
  } catch (error) {
    await transaction.rollback(); 
    console.error("GRN item update error:", error.message);
    return res.status(500).json({
      success: false,
      message: `GRN item update error: ${error.message}`,
    });
  }
});

//delete grn item
v1Router.delete("/grn-item/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const grnItemId = req.params.id;

    if (!grnItemId) {
      return res.status(400).json({
        success: false,
        message: "GRN item ID is required",
      });
    }

    const existingData = await GRNItem.findOne({ where: { grn_item_id: grnItemId } });

    if (!existingData) {
      return res.status(404).json({
        success: false,
        message: "GRN item not found",
      });
    }

    await GRNItem.update(
      {
        status: "inactive",
        deleted_at: new Date(),
        updated_by: req.user.id,
        updated_at: new Date()
      },
      {
        where: { grn_item_id: grnItemId },
        transaction,
      }
    );

    const updatedGrnData = await GRNItem.findByPk(grnItemId, { transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "GRN item deleted (soft) successfully",
      data: updatedGrnData,
    });

  } catch (error) {
    await transaction.rollback();
    console.error("GRN item delete error:", error.message);
    return res.status(500).json({
      success: false,
      message: `GRN item delete error: ${error.message}`,
    });
  }
});


app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3024;
app.listen(PORT, () => {
  console.log(`Purchase running on port ${PORT}`);
});