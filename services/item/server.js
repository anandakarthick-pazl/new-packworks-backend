import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";

const ItemMaster = db.ItemMaster;
const Company = db.Company;
const User =db.User;
// const GRN = db.GRN;
// const GRNItem = db.GRNItem;
const Inventory = db.Inventory;
// const PurchaseOrder = db.PurchaseOrder;
// const PurchaseOrderItem = db.PurchaseOrderItem;
// const PurchaseOrderReturn = db.PurchaseOrderReturn;
// const PurchaseOrderReturnItem = db.PurchaseOrderReturnItem;
// const CreditNote = db.CreditNote;
// const DebitNote = db.DebitNote;
// const stockAdjustment = db.stockAdjustment;
// const stockAdjustmentItem = db.stockAdjustmentItem;
const Sub_categories = db.Sub_categories;
const Categories = db.Categories;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();






//get items  //item_code based search
v1Router.get("/items",authenticateJWT,async (req,res)=>{
  try{
    const { search="",page="1",limit="10" }=req.query; 
    const pageNumber = Math.max(1,parseInt(page)||1);
    const limitNumber = Math.max(10,parseInt(limit)||10);
    const offset =(pageNumber-1)*limitNumber;
    let whereCondition = {};
    if(search.trim() !== ""){
      whereCondition ={
        ...whereCondition,item_code:{[Op.like]:`%${search}%`},
      }
    } 
    const item = await ItemMaster.findAll({
      where :whereCondition,
      limit:limitNumber,
      offset
    });
   const totalItems = await ItemMaster.count({where:whereCondition});
   return res.status(200).json({
    success : true,
    message : "Items fetched Successfully",
    data : item,
    totalItems : totalItems
   });
  }catch(error){
    console.error(error.message);
    return res.status(500).json({
      success:false,
      message:"Items not fount"
    })
  }
});

//create items
v1Router.post("/items", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction(); 
  try {
    const item_generate_id = await generateId(req.user.company_id, ItemMaster, "item");
    const { itemData, ...rest } = req.body; 
    rest.item_generate_id = item_generate_id;
    rest.created_by = req.user.id;
    rest.updated_by = req.user.id;
    rest.company_id = req.user.company_id;
    const item = await ItemMaster.create(rest, { transaction });
    // await transaction.commit();

    // Create Inventory record
    const inventory = await Inventory.create({
      item_id: item.id,
      category: item.category || "default", 
      sub_category: item.sub_category || "default",
      company_id: req.user.company_id,
      quantity_available: 0, 
      created_by: req.user.id,
    }, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Item Created Successfully",
      data: item.toJSON() 
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `Item creation failed: ${error.message}`
    });
  }
});


//edit-item
v1Router.get("/items/:id", authenticateJWT, async (req, res) => {
  try {
    const item_id = req.params.id;
    const itemData = await ItemMaster.findOne({ where: { id: item_id } });
    return res.status(200).json({
      success: true,
      message: "Item data fetched successfully",
      data: itemData,
    });
  } catch (error) {s
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: "Error fetching item details",
    });
  }
});

// update items 
v1Router.put("/items/:id", authenticateJWT, async (req, res) => {
  console.log(req.body);
  const transaction = await sequelize.transaction();
  try {
    const itemId = parseInt(req.params.id);
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID",
      });
    }
    const { ...rest } = req.body;
    rest.updated_by = req.user.id;
    rest.updated_at = new Date();
    rest.company_id = req.user.company_id;
    const itemExists = await ItemMaster.findByPk(itemId);
    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }
    await ItemMaster.update(rest, {
      where: { id: itemId }, 
      transaction,
    });
    const updatedItem = await ItemMaster.findByPk(itemId, { transaction });
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: "Item updated successfully",
      data: updatedItem,
    });
  } catch (error) {
    await transaction.rollback(); 
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `Item update error: ${error.message}`,
    });
  }
});


v1Router.delete("/items/delete/:id",authenticateJWT,async(req,res)=>{
  try{
    const itemId=req.params.id;
    if(!itemId){
      return res.status(400).json({
        success:false,
        message:"item id is required"
      })
    }
    const items= await ItemMaster.findOne({where:{ id:itemId }});
    if(!items){
      return res.status(404).json({
        success:false,
        message : "item id is mismatch"
      })
    }
    const deletedItem =await ItemMaster.update({
        status : "inactive",
        updated_by : req.user.id,
        deleted_at : new Date()
    },
    {where:{id:itemId}}
    );

    return res.status(200).json({
      success : true,
      message : "item deleted successfully",
      data : []
    });

    }catch(error){
      console.error(error.message);
      return res.status(500).json({
        success:false,
        message:`Item deleted error : ${error.message}`
      });
      
    }
  });


  v1Router.get("/items/sub-category/id", authenticateJWT, async (req, res) => {
  try {
    const categoryId = req.query.category_id;

    if (!categoryId) {
      return res.status(400).json({ error: "category_id is required" });
    }

    const subCategories = await Sub_categories.findAll({
      where: {
        category_id: categoryId,
        // is_visible: 1, // optional condition
      },
      // order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: subCategories,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.use("/api", v1Router);
// await db.sequelize.sync();
const PORT = process.env.PORT_ITEM;
app.listen(process.env.PORT_ITEM,'0.0.0.0', () => {
  console.log(`Item Master Service running on port ${process.env.PORT_ITEM}`);
});