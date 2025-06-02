import express, { json, Router } from "express";
import cors from "cors";
import { fn, col, Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";

// const ItemMaster = db.ItemMaster;
// const Company = db.Company;
// const Inventory = db.Inventory;
// const User =db.User;
// const InventoryType = db.InventoryType;
// const GRN = db.GRN;
// const GRNItem = db.GRNItem;


const ItemMaster = db.ItemMaster;
const Company = db.Company;
const User =db.User;
const GRN = db.GRN;
const GRNItem = db.GRNItem;
const Inventory = db.Inventory;
const PurchaseOrder = db.PurchaseOrder;
const PurchaseOrderItem = db.PurchaseOrderItem;
const PurchaseOrderReturn = db.PurchaseOrderReturn;
const PurchaseOrderReturnItem = db.PurchaseOrderReturnItem;
const CreditNote = db.CreditNote;
const DebitNote = db.DebitNote;
const stockAdjustment = db.stockAdjustment;
const stockAdjustmentItem = db.stockAdjustmentItem;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();

//////////////////////////////////////////////////////   Inventory   ///////////////////////////////////////////////////////////
//get inventory status
// v1Router.get("/inventory/status/:id", authenticateJWT, async (req, res) => {
//   try {
//     const itemId = req.params.id;

//     const {
//       PurchaseOrder,
//       PurchaseOrderItem,
//       GRN,
//       GRNItem,
//       PurchaseOrderReturn,
//       PurchaseOrderReturnItem,
//       User,
//     } = db;

//     // Store results
//     const results = {};

//     // Purchase Order Items
//     const poItems = await PurchaseOrderItem.findAll({
//       where: { item_id: itemId },
//       include: [
//         {
//           model: PurchaseOrder,
//           as: "purchaseOrder", // Ensure correct association alias
//           attributes: [
//             "id", "purchase_generate_id", "po_date", "supplier_id", "supplier_name", "supplier_contact", "billing_address",
//             "shipping_address", "po_status",
//           ],
//           include: [
//             {
//               model: User,
//               as: "creator",
//               attributes: ["id", "name", "email"]
//             }
//           ]
//         }
//       ]
//     });
//     if (poItems.length > 0) {
//       results.purchaseOrders = poItems;
//     }

//     // GRN Items
//     const grnItems = await GRNItem.findAll({
//       where: { item_id: itemId },
//       include: [
//         {
//           model: GRN,
//           as: "grn", // Ensure correct alias
//           attributes: ["id", "grn_generate_id", "grn_date","invoice_no", "invoice_date", "received_by", "status"],
//           include: [
//             {
//               model: User,
//               as: "creator",
//               attributes: ["id", "name", "email"]
//             }
//           ]
//         }
//       ]
//     });
//     if (grnItems.length > 0) {
//       results.grns = grnItems;
//     }

//     // Purchase Order Return Items
//     const returnItems = await PurchaseOrderReturnItem.findAll({
//       where: { item_id: itemId },
//       include: [
//         {
//           model: PurchaseOrderReturn,
//           as: "purchaseOrderReturn", // Ensure correct alias
//           attributes: ["id", "return_date", "reason"]
//         }
//       ]
//     });
//     if (returnItems.length > 0) {
//       results.purchaseReturns = returnItems;
//     }

//     // If no data found in any table
//     if (Object.keys(results).length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No related data found for the given item ID.",
//       });
//     }

//     // Success response with found data
//     return res.status(200).json({
//       success: true,
//       data: results,
//       message: "Item-related data fetched successfully.",
//     });

//   } catch (error) {
//     console.error("Inventory Item Status Fetch Error:", error.message);
//     return res.status(500).json({
//       success: false,
//       message: `Error fetching item data: ${error.message}`,
//     });
//   }
// });

v1Router.get("/inventory/status/:id", authenticateJWT, async (req, res) => {
  try {
    const itemId = req.params.id;
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required.",
      });
    }
    // Fetch all related data for the given item ID
    const itemExists = await ItemMaster.findOne({
      where: { id: itemId}
    });
   const item_generate_id = itemExists ? itemExists.item_generate_id : null;


    const {
      PurchaseOrder,
      PurchaseOrderItem,
      GRN,
      GRNItem,
      PurchaseOrderReturn,
      PurchaseOrderReturnItem,
      CreditNote,
      DebitNote,
      stockAdjustment,
      stockAdjustmentItem,
      User,
    } = db;

    const results = {
      purchaseOrders: [],
      grns: [],
      purchaseReturns: [],
      creditNotes: [],
      debitNotes: [],
      stockAdjustments: []
    };

    // Purchase Orders
    results.purchaseOrders = await PurchaseOrderItem.findAll({
      where: { item_id: itemId },
      attributes: [ // 👈 Choose specific fields from GRNItem
        "id","description","hsn_code","quantity","unit_price",
        "cgst","sgst","tax_amount","total_amount","status","created_at"
      ],
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: [
            "id", "purchase_generate_id", "po_date", "supplier_id", "supplier_name",
            "supplier_contact", "billing_address","shipping_address", "po_status",
          ],
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "name", "email"]
            }
          ]
        }
      ]
    });

    // GRNs
    results.grns = await GRNItem.findAll({
      where: { item_id: itemId },
      attributes: [ // 👈 Choose specific fields from GRNItem
        "id","description","quantity_ordered","quantity_received","accepted_quantity","rejected_quantity",
        "status","created_at"
      ],
      include: [
        {
          model: GRN,
          as: "grn",
          attributes: ["id", "grn_generate_id", "grn_date", "invoice_no", "invoice_date", "received_by", 
            "delivery_note_no", "created_at", "status"],
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "name", "email"]
            }
          ]
        }
      ]
    });

    // Purchase Order Returns
    results.purchaseReturns = await PurchaseOrderReturnItem.findAll({
      where: { item_id: itemId },
      attributes: [ // 👈 Choose specific fields from GRNItem
        "id","return_qty", "reason", "notes", "created_at", "unit_price","cgst","sgst","amount",
        "tax_amount","total_amount"
      ],
      include: [
        {
          model: PurchaseOrderReturn,
          as: "purchaseOrderReturn",
          attributes: ["id", "purchase_return_generate_id", "return_date", "reason"],
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "name", "email"]
            }
          ]
        }
      ]
    });

    // // Credit Notes
    // results.creditNotes = await CreditNote.findAll({
    //   where: { item_id: itemId }
    // });

    // // Debit Notes
    // results.debitNotes = await DebitNote.findAll({
    //   where: { item_id: itemId }
    // });

    // Stock Adjustments
    results.stockAdjustments = await stockAdjustmentItem.findAll({
      where: { item_id: itemId },
      attributes: [ 
        "id","previous_quantity", "type", "adjustment_quantity", "difference", "reason"
      ],
      include: [
        {
          model: stockAdjustment,
          as: "adjustment",
          attributes: ["id", "stock_adjustment_generate_id","adjustment_date", "remarks", "status", "created_by", "created_at"],
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "name", "email"]
            }
          ]
        }
      ]
    });

    return res.status(200).json({
      success: true,
      message: "Item-related data fetched successfully.",
      data: results,
    });

  } catch (error) {
    console.error("Inventory Item Status Fetch Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `Error fetching item data: ${error.message}`,
    });
  }
});







v1Router.get("/inventory", authenticateJWT, async (req, res) => {
  try {   
    const {
      search = "",
      page = "1",
      limit = "10",
      categoryId,
      subCategoryId
    } = req.query;

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    const offset = (pageNumber - 1) * limitNumber;

    let whereCondition = {
      company_id: req.user.company_id
    };

    // Optional search filters (e.g., inventory ID or generate ID)
    if (search.trim() !== "") {
      whereCondition = {
        ...whereCondition,
        [Op.or]: [
          { id: { [Op.like]: `%${search}%` } },
          { inventory_generate_id: { [Op.like]: `%${search}%` } },
        ]
      };
    }

    // Optional filters for category or subcategory (if applicable to Inventory or via include)
    if (categoryId) {
      whereCondition.category = categoryId;
    }

    if (subCategoryId) {
      whereCondition.sub_category = subCategoryId;
    }

    // Grouped inventory data
    const inventoryData = await Inventory.findAll({
      attributes: [
        'item_id',
        'description',
        'quantity_available',
        'location',
        'status',
        'created_at',
        'updated_at',
        'category',
        'sub_category',
        'po_id',
        'grn_id',
        'grn_item_id',
        'po_return_id',
        'credit_note_id',
        'debit_note_id',
        'adjustment_id',
        'work_order_id',
        [fn('SUM', col('quantity_available')), 'total_quantity']
      ],
      where: whereCondition,
      group: ['item_id'],
      limit: limitNumber,
      offset: offset,
    });

    // Get total count of unique item_ids (for pagination)
    const totalCountResult = await Inventory.findAll({
      attributes: ['item_id'],
      where: whereCondition,
      group: ['item_id']
    });


    

    const totalCount = totalCountResult.length;
    const totalPages = Math.ceil(totalCount / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Grouped Inventory data fetched successfully",
      data: inventoryData,
       pagination: {
        currentPage: pageNumber,
        perPage: limitNumber,
        totalCount,
        totalPages
      },
      totalCount: totalCount
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `Inventory fetch error: ${error.message}`,
    });
  }
});

// Get Inventory based on search, pagination, categoryId, and subCategoryId
// v1Router.get("/inventory", authenticateJWT, async (req, res) => {
//   try {
//     const {
//       search = "",
//       page = "1",
//       limit = "10",
//       categoryId,
//       subCategoryId
//     } = req.query;

//     const pageNumber = parseInt(page) || 1;
//     const limitNumber = parseInt(limit) || 10;
//     const offset = (pageNumber - 1) * limitNumber;

//     let whereCondition = {};

//     // Filter by search (e.g., id or name)
//     if (search.trim() !== "") {
//       whereCondition = {
//         ...whereCondition,
//         [Op.or]: [
//           { id: { [Op.like]: `%${search}%` } },
//           { inventory_generate_id: { [Op.like]: `%${search}%` } },
//           // { name: { [Op.like]: `%${search}%` } }, // assuming inventory has name
//         ]
//       };
//     }

//     // Filter by categoryId
//     if (categoryId) {
//       whereCondition.category = categoryId;
//     }

//     // Filter by subCategoryId
//     if (subCategoryId) {
//       whereCondition.sub_category = subCategoryId;
//     }

//     console.log("Where Condition:", whereCondition);
    

//     const inventoryData = await Inventory.findAll({
//       where: whereCondition,
//       limit: limitNumber,
//       offset: offset,
//     });

//     const totalCount = await Inventory.count({ where: whereCondition });

//     return res.status(200).json({
//       success: true,
//       message: "Inventory data fetched successfully",
//       data: inventoryData,
//       totalCount: totalCount,
//     });
//   } catch (error) {
//     console.error(error.message);
//     return res.status(500).json({
//       success: false,
//       message: `inventory fetched error: ${error.message}`,
//     });
//   }
// });




// v1Router.get("/inventory", authenticateJWT, async (req, res) => {
//   try {
//     const { search = "", page = "1", limit = "10" } = req.query;

//     const pageNumber = parseInt(page) || 1;
//     const limitNumber = parseInt(limit) || 10;
//     const offset = (pageNumber - 1) * limitNumber;

//     let whereCondition = {};

//     if (search.trim() !== "") {
//       whereCondition = {
//         ...whereCondition,
//         id: { [Op.like]: `%${search}%` },
//       };
//     }

//     const inventoryData = await Inventory.findAll({
//       where: whereCondition,
//       limit: limitNumber,
//       offset: offset,
//     });

//     const totalCount = await Inventory.count({ where: whereCondition });

//     return res.status(200).json({
//       success: true,
//       message: "Inventory data fetched successfully",
//       data: inventoryData,
//       totalCount: totalCount,
//     });
//   } catch (error) {
//     console.error(error.message);
//     return res.status(500).json({
//       success: false,
//       message: `inventory fetched error: ${error.message}`,
//     });
//   }
// });



// Create Inventory 




// v1Router.post("/inventory",authenticateJWT,async(req,res)=>{
//   const transaction = await sequelize.transaction();
//   try{
//     const inventory_generate_id = await generateId(req.user.company_id, Inventory, "inventory");
//     const { ...rest } = req.body;
//     rest.inventory_generate_id = inventory_generate_id;
//     rest.created_by = req.user.id;
//     rest.updated_by = req.user.id;
//     rest.company_id = req.user.company_id;

//     // Validate Item
//     const itemId = req.body.item_id;
//     const validateItem = await ItemMaster.findOne({
//       where: { id: itemId, status: "active" }
//     });
//     if (!validateItem) {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid or inactive Item.`,
//       });
//     }

//       let category = validateItem.category;
//       let sub_category = validateItem.sub_category;

//     rest.category = category;
//     rest.sub_category = sub_category;

//     // Validate GRN
//     const grnId = req.body.grn_id;
//     const validateGrn = await GRN.findOne({
//       where: { id: grnId, status: "active" }
//     });
//     if (!validateGrn) {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid or inactive GRN.`,
//       });
//     }

//     // Validate GRN Item
//     const grnItemId = req.body.grn_item_id;
//     const validateGrnItem = await GRNItem.findOne({
//       where: { id: grnItemId, status: "active" }
//     });
//     if (!validateGrnItem) {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid or inactive GrnItem.`,
//       });
//     }
    
//     const inventoryData = await Inventory.create(rest,{ transaction });
//     await transaction.commit();
//     return res.status(200).json({
//       success : true,
//       message : `Inventory Created Successfully`,
//       data : inventoryData
//     });
//   }catch(error){
//     await transaction.rollback();
//     console.error(error.message);
//     return res.status(500).json({
//       success : false,
//       message : `inventory created Error : ${error.message}`
//     });    
//   }
// });



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
      where: { id: inventoryId },
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
      where: { id: itemId, status: "active" }
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
      where: { id: grnId, status: "active" }
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
      where: { id: grnItemId, status: "active" }
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
// await db.sequelize.sync();
const PORT = 3025;
app.listen(process.env.PORT_INVENTORY,'0.0.0.0', () => {
  console.log(`Item Master Service running on port ${process.env.PORT_INVENTORY}`);
});