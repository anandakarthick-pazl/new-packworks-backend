import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import moment from "moment-timezone";

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
    whereCondition.status="active"
    const items = await ItemMaster.findAll({
      where :whereCondition,
      limit:limitNumber,
      offset,
      include: [
        {
          model: Categories,
          as: "category_info",
          attributes: ["id", "category_name"]
        },
        {
          model: Sub_categories,
          as: "sub_category_info",
          attributes: ["id", "sub_category_name"]
        }
      ],
      order: [["id", "DESC"]]
    });

    // Parse custom_fields & default_custom_fields for each item
    const parsedItems = items.map(item => {
      const raw = item.toJSON();
      return {
        ...raw,
        custom_fields: raw.custom_fields ? JSON.parse(raw.custom_fields) : {},
        default_custom_fields: raw.default_custom_fields ? JSON.parse(raw.default_custom_fields) : {},
      };
    });


   const totalItems = await ItemMaster.count({where:whereCondition});
   return res.status(200).json({
    success : true,
    message : "Product fetched Successfully",
    data : parsedItems,
    totalItems : totalItems
   });
  }catch(error){
    console.error(error.message);
    return res.status(500).json({
      success:false,
      message:"Product not fount"
    })
  }
});

//create items
v1Router.post("/items", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction(); 
  try {
        const indiaTime = moment().tz("Asia/Kolkata").toDate();

    const item_generate_id = await generateId(req.user.company_id, ItemMaster, "item");
    const { itemData, ...rest } = req.body; 
    rest.item_generate_id = item_generate_id;
    rest.created_by = req.user.id;
    rest.updated_by = req.user.id;
    rest.company_id = req.user.company_id;
    rest.created_at = indiaTime;

    // console.log("custom_fields:", typeof rest.custom_fields);    
    // console.log("default_custom_fields:", typeof rest.default_custom_fields);    

 // ✅ Convert stringified JSON to objects
    if (rest.custom_fields && typeof rest.custom_fields === "string") {
      rest.custom_fields = JSON.parse(rest.custom_fields);
    }

    if (rest.default_custom_fields && typeof rest.default_custom_fields === "string") {
      rest.default_custom_fields = JSON.parse(rest.default_custom_fields);
    }


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
      message: "Product Created Successfully",
      data: item.toJSON() 
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `Product creation failed: ${error.message}`
    });
  }
});


//edit-item
v1Router.get("/items/:id", authenticateJWT, async (req, res) => {
  try {
    const item_id = req.params.id;
    const itemData = await ItemMaster.findOne({
       where: { id: item_id },
      include: [
        {
          model: Categories,
          as: "category_info",
          attributes: ["id", "category_name"]
        },
        {
          model: Sub_categories,
          as: "sub_category_info",
          attributes: ["id", "sub_category_name"]
        }
      ]
     });

    const parsedItem = {
      ...itemData.toJSON(),
      custom_fields: itemData.custom_fields ? JSON.parse(itemData.custom_fields) : {},
      default_custom_fields: itemData.default_custom_fields ? JSON.parse(itemData.default_custom_fields) : {},
    };


    return res.status(200).json({
      success: true,
      message: "Product data fetched successfully",
      data: parsedItem,
    });
  } catch (error) {
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
    
    const { custom_fields, default_custom_fields, ...rest } = req.body;
    rest.updated_by = req.user.id;
    rest.updated_at = new Date();
    rest.company_id = req.user.company_id;
    
    const itemExists = await ItemMaster.findByPk(itemId);

    // Debug: Log what we're receiving
    console.log('Received custom_fields:', typeof custom_fields, custom_fields);
    console.log('Received default_custom_fields:', typeof default_custom_fields, default_custom_fields);

    // Handle JSON fields with explicit type checking
    if (custom_fields !== undefined) {
      rest.custom_fields = custom_fields;
    }
    
    if (default_custom_fields !== undefined) {
      rest.default_custom_fields = default_custom_fields;
    }

    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }
    
    // Debug: Log what we're about to save
    console.log('About to save custom_fields:', typeof rest.custom_fields, rest.custom_fields);
    console.log('About to save default_custom_fields:', typeof rest.default_custom_fields, rest.default_custom_fields);
    
    await ItemMaster.update(rest, {
      where: { id: itemId }, 
      transaction,
    });
    
    // Fetch with different methods to see what works
    const updatedItem1 = await ItemMaster.findByPk(itemId, { transaction });
    const updatedItem2 = await ItemMaster.findByPk(itemId, { transaction, raw: true });
    
    // Debug: Log what we get back from DB
    console.log('From findByPk (instance):', typeof updatedItem1.custom_fields, updatedItem1.custom_fields);
    console.log('From findByPk (raw):', typeof updatedItem2.custom_fields, updatedItem2.custom_fields);
    
    await transaction.commit();
    
    // Try different approaches to get proper JSON
    let responseData;
    
    // Approach 1: Use raw query
    const [rawResult] = await sequelize.query(
      `SELECT * FROM ${ItemMaster.tableName} WHERE id = ?`,
      {
        replacements: [itemId],
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    console.log('From raw query:', typeof rawResult.custom_fields, rawResult.custom_fields);
    
    // Use the raw result and parse if needed
    responseData = { ...rawResult };
    
    // Force parse if still string
    if (responseData.custom_fields && typeof responseData.custom_fields === 'string') {
      try {
        responseData.custom_fields = JSON.parse(responseData.custom_fields);
      } catch (e) {
        console.log('Parse error for custom_fields:', e.message);
      }
    }
    
    if (responseData.default_custom_fields && typeof responseData.default_custom_fields === 'string') {
      try {
        responseData.default_custom_fields = JSON.parse(responseData.default_custom_fields);
      } catch (e) {
        console.log('Parse error for default_custom_fields:', e.message);
      }
    }
    
    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: responseData,
    });
  } catch (error) {
    await transaction.rollback(); 
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `Product update error: ${error.message}`,
    });
  }
});

v1Router.delete("/items/delete/:id",authenticateJWT,async(req,res)=>{
  try{
    const itemId=req.params.id;
    if(!itemId){
      return res.status(400).json({
        success:false,
        message:"Product id is required"
      })
    }
    const items= await ItemMaster.findOne({where:{ id:itemId }});
    if(!items){
      return res.status(404).json({
        success:false,
        message : "Product id is mismatch"
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
      message : "Product deleted successfully",
      data : []
    });

    }catch(error){
      console.error(error.message);
      return res.status(500).json({
        success:false,
        message:`Product deleted error : ${error.message}`
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
        status:"active"
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

//bf
v1Router.get("/items/reels/bf", authenticateJWT, async (req, res) => {
  try {
    const items = await ItemMaster.findAll({
      attributes: ["default_custom_fields"],
      where: { company_id: req.user.company_id }
    });
    const bfValues = items.map(item => {
      try {
        const parsed = JSON.parse(item.default_custom_fields || "{}");
        return parsed.bf ?? null;
      } catch {
        return null;
      }
    }).filter(bf => bf !== null);
    const uniqueBfValues = [...new Set(
        bfValues.map(bf => parseInt(bf, 10)).filter(bf => !isNaN(bf))
      )];
    res.json({
      success: true,
      message: "BF values fetched successfully",
      data:uniqueBfValues,
      count: uniqueBfValues.length
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});



//gsm
v1Router.get("/items/reels/gsm", authenticateJWT, async (req, res) => {
  try {
    const items = await ItemMaster.findAll({
      attributes: ["default_custom_fields"],
      where: { company_id: req.user.company_id }
    });
    const gsmValues = items.map(item => {
      try {
        const parsed = JSON.parse(item.default_custom_fields || "{}");
        return parsed.gsm ?? null;
      } catch {
        return null;
      }
    }).filter(gsm => gsm !== null);
    const uniqueGsmValues = [...new Set(
        gsmValues.map(gsm => parseInt(gsm, 10)).filter(gsm => !isNaN(gsm))
      )];
    res.json({
      success: true,
      message: "GSM values fetched successfully",
      data:uniqueGsmValues,
      count: uniqueGsmValues.length
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

//Deckle size
v1Router.get("/items/reels/deckle", authenticateJWT, async (req, res) => {
  try {
    const items = await ItemMaster.findAll({
      attributes: ["default_custom_fields"],
      where: { company_id: req.user.company_id }
    });
    const deckleValues = items.map(item => {
      try {
        const parsed = JSON.parse(item.default_custom_fields || "{}");
        return parsed.size ?? null;
      } catch {
        return null;
      }
    }).filter(size => size !== null);
    const uniqueDeckleValues = [...new Set(
        deckleValues.map(size => parseInt(size, 10)).filter(size => !isNaN(size))
      )];
    res.json({
      success: true,
      message: "Deckle values fetched successfully",
      data:uniqueDeckleValues,
      count: uniqueDeckleValues.length
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

//color
v1Router.get("/items/reels/color", authenticateJWT, async (req, res) => {
  try {
    const items = await ItemMaster.findAll({
      attributes: ["default_custom_fields"],
      where: { company_id: req.user.company_id }
    });
    const colorValues = items.map(item => {
      try {
        const parsed = JSON.parse(item.default_custom_fields || "{}");
        return parsed.color ?? null;
      } catch {
        return null;
      }
    }).filter(color => color !== null && color !== "");

    const uniqueColorValues = [...new Set(colorValues)];

    res.json({
      success: true,
      message: "Color values fetched successfully",
      data: uniqueColorValues,
      count: uniqueColorValues.length
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});






app.use("/api", v1Router);
// await db.sequelize.sync();
const PORT = process.env.PORT_ITEM;
app.listen(process.env.PORT_ITEM,'0.0.0.0', () => {
  console.log(`Item Master Service running on port ${process.env.PORT_ITEM}`);
});