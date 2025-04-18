import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";

const ItemMaster = db.ItemMaster;
const Company = db.Company;
const Inventory = db.Inventory;
const User =db.User;
const InventoryType = db.InventoryType;
const GRN = db.GRN;
const GRNItem = db.GRNItem;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();

//////////////////////////////////////////////////////   Inventory   ///////////////////////////////////////////////////////////

v1Router.get("/inventory",authenticateJWT,async(req,res)=>{
  try{
    const {search="",page="1",limit="10"}=req.query;
    const pageNumber = Math.max(1,parseInt(page)||1);
    const limitNumber = Math.max(10,parseInt(limit)||10);
    const offset = (pageNumber-1)*limitNumber;
    const whereCondition = {status:"active"};
    if (search.trim() !== "") {
          whereCondition = {
            ...whereCondition,
            id : { [Op.like]: `%${search}%` },
          };
        }
        const inventoryData = await Inventory.findAll({
          where: whereCondition,
          limit: limitNumber,
          offset: offset,
        });
        return res.status(200).json({
          success: true,
          message: "Inventory data fetched successfully",
          data: inventoryData,
        });
  }catch(error){
    console.error(error.message);
    return res.status(500).json({
      success:false,
      message:`inventory fetched error : ${error.message}`
    });
  }
});


// Create Inventory 
v1Router.post("/inventory",authenticateJWT,async(req,res)=>{
  const transaction = await sequelize.transaction();
  try{
    const { ...rest } = req.body;
    rest.created_by = req.user.id;
    rest.updated_by = req.user.id;
    rest.company_id = req.user.company_id;

    // Validate Item
    const itemId = req.body.item_id;
    const validateItem = await ItemMaster.findOne({
      where: { item_id: itemId, status: "active" }
    });
    if (!validateItem) {
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive Item.`,
      });
    }

    // Validate GRN
    const grnId = req.body.grn_id;
    const validateGrn = await GRN.findOne({
      where: { grn_id: grnId, status: "active" }
    });
    if (!validateGrn) {
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive GRN.`,
      });
    }

    // Validate GRN Item
    const grnItemId = req.body.grn_item_id;
    const validateGrnItem = await GRNItem.findOne({
      where: { grn_item_id: grnItemId, status: "active" }
    });
    if (!validateGrnItem) {
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive GrnItem.`,
      });
    }
    
    const inventoryData = await Inventory.create(rest,{ transaction });
    await transaction.commit();
    return res.status(200).json({
      success : true,
      message : `Inventory Created Successfully`,
      data : inventoryData
    });
  }catch(error){
    await transaction.rollback();
    console.error(error.message);
    return res.status(500).json({
      success : false,
      message : `inventory created Error : ${error.message}`
    });    
  }
});



// Edit Inventory (Fetch by ID)
v1Router.get("/inventory/id/:id", authenticateJWT, async (req, res) => {
  try {
    const inventoryId = req.params.id;
    if (!inventoryId) {
      return res.status(400).json({
        success: false,
        message: "Inventory ID is required.",
      });
    }
    const inventoryData = await Inventory.findOne({
      where: { id: inventoryId, status: 'active' },
    });
    if (!inventoryData) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found.",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Inventory fetched successfully.",
      data: inventoryData,
    });
  } catch (error) {
    console.error("Inventory Fetch Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `Inventory fetch error: ${error.message}`,
    });
  }
});


// update inventory 
v1Router.put("/inventory/id/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const inventoryId = req.params.id;
    const { ...rest } = req.body;
    if (!inventoryId) {
      return res.status(400).json({
        success: false,
        message: `inventory ID is required.`,
      });
    }
    rest.updated_by = req.user.id;
    rest.updated_at = new Date();
    rest.company_id = req.user.company_id;
    const existingData = await Inventory.findOne({ where: { id: inventoryId } });
    if (!existingData) {
      return res.status(404).json({
        success: false,
        message: `inventory not found.`,
      });
    }
    
    // Validate Item
    const itemId = req.body.item_id;
    const validateItem = await ItemMaster.findOne({
      where: { item_id: itemId, status: "active" }
    });
    if (!validateItem) {
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive Item.`,
      });
    }

    // Validate GRN
    const grnId = req.body.grn_id;
    const validateGrn = await GRN.findOne({
      where: { grn_id: grnId, status: "active" }
    });
    if (!validateGrn) {
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive GRN.`,
      });
    }

    // Validate GRN Item
    const grnItemId = req.body.grn_item_id;
    const validateGrnItem = await GRNItem.findOne({
      where: { grn_item_id: grnItemId, status: "active" }
    });
    if (!validateGrnItem) {
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive GrnItem.`,
      });
    }


   
    await Inventory.update(rest, {
      where: { id: inventoryId },
      transaction
    });
    const updatedinventoryData = await Inventory.findOne({ where: { id: inventoryId },transaction });
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: `inventory updated successfully.`,
      data: updatedinventoryData
    });

  } catch (error) {
    await transaction.rollback();
    console.error("inventory Update Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `inventory update error: ${error.message}`
    });
  }
});


// Delete Inventory 
v1Router.delete("/inventory/id/:id", authenticateJWT, async (req, res) => {
  try {
    const inventoryId = req.params.id;
    if (!inventoryId) {
      return res.status(400).json({
        success: false,
        message: `inventory ID is required`
      });
    }
    const existingData = await Inventory.findOne({ where: { id: inventoryId } });
    if (!existingData) {
      return res.status(404).json({
        success: false,
        message: `inventory not found`
      });
    }
    await Inventory.update(
      {
        status: "inactive",
        deleted_at: new Date(),
        updated_by: req.user.id,
        updated_at: new Date(),
      },{
        where: { id: inventoryId }
      }
    );
    return res.status(200).json({
      success: true,
      message: `inventory deleted successfully`,
      data: []
    });
  } catch (error) {
    console.error("inventory Delete Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `inventory delete error: ${error.message}`
    });
  }
});


//////////////////////////////////////////////////////    InventoryType    /////////////////////////////////////////////////////

// Get InventoryType
v1Router.get('/inventory/type',authenticateJWT,async(req,res)=>{
  try{
    const inventoryTypeData = await InventoryType.findAll({where:{status:"active"}});
    return res.status(200).json({
      success : true,
      message : `Inventory Type Fetched Successfully`,
      data : inventoryTypeData
    });
  }catch(error){
    console.error(error.message);
    return res.status(500).json({
      success:false,
      message:`Inventory type fetched error ${error.message}`
    });
  }
});

// Create InventoryType
v1Router.post('/inventory/type',authenticateJWT,async(req,res)=>{
  const transaction =await sequelize.transaction();
  try{
    const { ...rest } = req.body;
    rest.updated_by = req.user.id;
    rest.created_by = req.user.id;

    const inventoryTypeData = await InventoryType.create(rest,{transaction});
    await transaction.commit();

    return res.status(200).json({
      success : true,
      message : `Inventory Type Created Successfully`,
      data : inventoryTypeData
    })




  }catch(error){
    console.error(error.message);
    return res.status(500).json({
      success : false,
      message : `inventory type created error : ${error.message}`
    })
  }

});



app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3025;
app.listen(PORT, () => {
  console.log(`Item Master Service running on port ${PORT}`);
});