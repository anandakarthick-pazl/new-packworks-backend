import express from "express";
import { json, Router } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { NOW, Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import db from "../../common/models/index.js";
import PurchaseOrderItem from "../../common/models/po/purchase_order_item.model.js";
 
const StockAdjustment = db.stockAdjustment;
const StockAdjustmentItem = db.stockAdjustmentItem;
const Inventory = db.Inventory;
const ItemMaster = db.ItemMaster;
const User = db.User;
const Company = db.Company;
const PurchaseOrder = db.PurchaseOrder;
const GRN = db.GRN;
const GRNItem = db.GRNItem;
 
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();
dotenv.config();
 
// get all items based on inventory
v1Router.get("/stock-adjustments/items", authenticateJWT, async (req, res) => {
    try {
        const inventory_data = await Inventory.findAll({
            attributes: ['item_id'],
        });
        const itemIds = [...new Set(inventory_data.map(inv => inv.item_id))];
        const items = await ItemMaster.findAll({
            where: { id: itemIds },
            attributes: ['id', 'item_generate_id', 'item_name']
        });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});
 
// get item_id based on po_id
v1Router.get("/stock-adjustments/items/:item_id", authenticateJWT, async (req, res) => {
  try {
    const item_id = req.params.item_id;
     const inventoryData = await Inventory.findAll({
      where: { item_id },
      attributes: ['id', 'inventory_generate_id','quantity_available']
    });
 
     if (!inventoryData || inventoryData.length === 0) {
      return res.status(404).json({ success: false, message: "No inventory found for this item." });
    }

    return res.status(200).json({
      success: true,
      message: "Inventory fetched successfully",
      data: inventoryData
    });
 
  } catch (error) {
    console.error("Error fetching item-related data:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch item-related info"
    });
  }
});
 

// create stock adjustments
v1Router.post("/stock-adjustments", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {   
    const { reference_number, mode_of_adjustment, date, description, remarks, items } = req.body;
    const company_id = req.user.company_id;

    const stockAdjustmentId = await generateId(req.user.company_id, StockAdjustment, "stock_adjustment");
 
    const adjustment = await StockAdjustment.create(
      {
        stock_adjustment_generate_id: stockAdjustmentId,
        company_id,
        adjustment_date: date,
        remarks,
        reference_number,
        mode_of_adjustment,
        description,
        created_by: req.user.id,
        updated_by: req.user.id,
      },
      { transaction }
    );
 
    const adjustmentItemsCreated = [];
 
    for (const item of items) {
      const { item_id, type, adjustment_quantity, reason,inventory_id } = item;
      const quantity = parseFloat(adjustment_quantity || 0);
      const existingInventory = await Inventory.findOne({
        where: { id:inventory_id },
        transaction
      });
 
       if (!existingInventory) {
        throw new Error(`Inventory not found for inventory_id: ${inventory_id}`);
      }
     
      existingInventory.adjustment_id = adjustment.id;
      await existingInventory.save({ transaction });
 
 
      const previous_quantity = parseFloat(existingInventory.quantity_available || 0);
      const new_quantity =
        type === "increase"
          ? previous_quantity + quantity
          : previous_quantity - quantity;
 
      if (type === "decrease" && quantity > previous_quantity) {
        throw new Error(`Cannot decrease more than available quantity for item_id: ${item_id}`);
      }

       // 🔍 Fetch min_stock_level from ItemMaster
      const itemMaster = await ItemMaster.findOne({
        where: { id: item_id },
        transaction,
        attributes: ['min_stock_level']
      });

      if (!itemMaster) {
        throw new Error(`ItemMaster not found for item_id: ${item_id}`);
      }

      const minStock = parseFloat(itemMaster.min_stock_level || 0);
      let stock_status = 'in_stock';
      if (new_quantity === 0) {
        stock_status = 'out_of_stock';
      } else if (new_quantity <= minStock) {
        stock_status = 'low_stock';
      }

      // ✅ Create Stock Adjustment Item
      
      const adjustment_item = await StockAdjustmentItem.create(
        {
          adjustment_id: adjustment.id,
          item_id,
          inventory_id: existingInventory.id,
          previous_quantity,
          reason,
          type,
          adjustment_quantity: quantity,
          difference: new_quantity,
          company_id,
          created_by: req.user.id,
          updated_by: req.user.id,
        },
        { transaction }
      );
 
      adjustmentItemsCreated.push(adjustment_item);
 
      await existingInventory.update(
        { 
          quantity_available: new_quantity,
          stock_status
         },
        { transaction }
      );
    }
 
    await transaction.commit();
    return res.status(201).json({
      success: true,
      message: "Stock adjustment created successfully",
      adjustment_id: adjustment.id,
      data: {
        adjustment,
        adjustment_items: adjustmentItemsCreated
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Stock adjustment error:", error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});
 


//asc and desc based stock adjustment
// v1Router.post("/stock-adjustments", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();
//   try {
//     console.log("Creating stock adjustment with items:", req.body);
   
//     const { remarks, items } = req.body;
//     const stockAdjustmentId = await generateId(req.user.company_id, StockAdjustment, "stock_adjustment");
//     const company_id = req.user.company_id;
 
//     const adjustment = await StockAdjustment.create(
//       {
//         stock_adjustment_generate_id: stockAdjustmentId,
//         company_id,
//         adjustment_date: new Date(),
//         remarks,
//         created_by: req.user.id,
//         updated_by: req.user.id,
//       },
//       { transaction }
//     );
 
//     const adjustmentItemsCreated = [];
 
//     for (const item of items) {
//       const { item_id, type, adjustment_quantity, reason, po_id, grn_id } = item;
//       const quantity = parseFloat(adjustment_quantity || 0);
      
//       let existingInventory;
      
//       if (type === "increase") {
//         // For increase: get the most recent inventory record (LIFO)
//         existingInventory = await Inventory.findOne({
//           where: {
//             item_id,
//             company_id,
//             quantity_available: {
//               [Op.gt]: 0 // Only records with available quantity > 0
//             }
//           },
//           order: [['created_at', 'DESC']], // Most recent first
//           transaction
//         });
//       } else {
//         // For decrease: get the oldest inventory record with available quantity (FIFO)
//         existingInventory = await Inventory.findOne({
//           where: {
//             item_id,
//             company_id,
//             quantity_available: {
//               [Op.gt]: 0 // Only records with available quantity > 0
//             }
//           },
//           order: [['created_at', 'ASC']], // Oldest first
//           transaction
//         });
//       }

//       // Alternative approach: If you want to prioritize specific grn_id/po_id when provided
//       if (!existingInventory && (grn_id || po_id)) {
//         const whereClause = {
//           item_id,
//           company_id,
//           quantity_available: {
//             [Op.gt]: 0
//           }
//         };
        
//         if (grn_id) whereClause.grn_id = grn_id;
//         if (po_id) whereClause.po_id = po_id;
        
//         existingInventory = await Inventory.findOne({
//           where: whereClause,
//           order: [['created_at', type === "increase" ? 'DESC' : 'ASC']],
//           transaction
//         });
//       }

//       if (!existingInventory) {
//         throw new Error(`No available inventory found for item_id: ${item_id}`);
//       }
 
//       console.log("adjustment id before saving the inventory ", adjustment.id);
     
//       existingInventory.adjustment_id = adjustment.id;
//       await existingInventory.save({ transaction });
 
//       console.log("Existing Inventory:", existingInventory.adjustment_id);
 
//       const previous_quantity = parseFloat(existingInventory.quantity_available || 0);
//       const new_quantity = type === "increase" 
//         ? previous_quantity + quantity
//         : previous_quantity - quantity;
 
//       if (type === "decrease" && quantity > previous_quantity) {
//         throw new Error(`Cannot decrease more than available quantity for item_id: ${item_id}. Available: ${previous_quantity}, Requested: ${quantity}`);
//       }
      
//       console.log("ExistingInv:", existingInventory.adjustment_id);

//       const adjustment_item = await StockAdjustmentItem.create(
//         {
//           adjustment_id: adjustment.id,
//           item_id,
//           inventory_id: existingInventory.id,
//           grn_id: existingInventory.grn_id, // Use the actual grn_id from selected inventory
//           po_id: existingInventory.po_id,   // Use the actual po_id from selected inventory
//           previous_quantity,
//           reason,
//           type,
//           adjustment_quantity: quantity,
//           difference: new_quantity,
//           company_id,
//           created_by: req.user.id,
//           updated_by: req.user.id,
//         },
//         { transaction }
//       );
 
//       adjustmentItemsCreated.push(adjustment_item);
 
//       await existingInventory.update(
//         { quantity_available: new_quantity },
//         { transaction }
//       );
//     }
 
//     await transaction.commit();
//     return res.status(201).json({
//       success: true,
//       message: "Stock adjustment created successfully",
//       adjustment_id: adjustment.id,
//       data: {
//         adjustment,
//         adjustment_items: adjustmentItemsCreated
//       }
//     });
//   } catch (error) {
//     await transaction.rollback();
//     console.error("Stock adjustment error:", error);
//     return res.status(400).json({
//       success: false,
//       message: error.message,
//     });
//   }
// });




v1Router.get("/stock-adjustments", authenticateJWT, async (req, res) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, parseInt(limit));
    const offset = (pageNumber - 1) * limitNumber;
 
    const whereCondition = {
      status: "active",
    };
 
    if (search.trim() !== "") {
      whereCondition[Op.or] = [
        { stock_adjustment_generate_id: { [Op.like]: `%${search}%` } },
      ];
 
      if (!isNaN(search)) {
        whereCondition[Op.or].push({ id: parseInt(search) });
        whereCondition[Op.or].push({ inventory_id: parseInt(search) });
      }
    }
 
    const adjustments = await StockAdjustment.findAll({
      where: whereCondition,
      limit: limitNumber,
      offset,
      include: [
        {
          model: StockAdjustmentItem
        }
      ],
      order: [["created_at", "DESC"]]
    });
 
    const totalCount = await StockAdjustment.count({ where: whereCondition });
 
    return res.status(200).json({
      success: true,
      message: "Stock Adjustments fetched successfully",
      data: adjustments,
      totalCount,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalCount / limitNumber),
        pageSize: limitNumber,
        totalRecords: totalCount
      }
    });
 
  } catch (error) {
    console.error("Error fetching stock adjustments:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});
 
 
// GET single stock adjustment by ID
v1Router.get("/stock-adjustments/:id", authenticateJWT, async (req, res) => {
  try {
    const adjustmentId = req.params.id;
 
    const adjustment = await StockAdjustment.findOne({
      where: { id: adjustmentId, status: "active" },
      include: [
        {
          model: StockAdjustmentItem,
          as: 'StockAdjustmentItems',
        },
      ],
    });
 
    if (!adjustment) {
      return res.status(404).json({
        success: false,
        message: "Stock adjustment not found",
      });
    }
 
    const adjustmentData = adjustment.toJSON();
 
    const itemIds = adjustmentData.StockAdjustmentItems.map(item => item.item_id);
 
    const itemDetails = await ItemMaster.findAll({
      where: { id: itemIds },
      attributes: ['id', 'item_name'],
    });
 
    const itemMap = {};
    itemDetails.forEach(item => {
      itemMap[item.id] = item.item_name;
    });
 
    adjustmentData.StockAdjustmentItems = adjustmentData.StockAdjustmentItems.map(item => ({
      ...item,
      item_name: itemMap[item.item_id] || null,
    }));
 
    const [createdUser, updatedUser] = await Promise.all([
      User.findOne({ where: { id: adjustmentData.created_by }, attributes: ['id', 'name', 'email'] }),
      User.findOne({ where: { id: adjustmentData.updated_by }, attributes: ['id', 'name', 'email'] }),
    ]);
 
    adjustmentData.created_by_user = createdUser;
    adjustmentData.updated_by_user = updatedUser;
 
    return res.status(200).json({
      success: true,
      message: "Stock adjustment fetched successfully",
      data: adjustmentData,
    });
 
  } catch (error) {
    console.error("Error fetching stock adjustment by ID:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
});
 
 
 
 
 
 
v1Router.put("/stock-adjustments/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const adjustmentId = req.params.id;
    // const { remarks, items } = req.body;
    const { reference_number, mode_of_adjustment, date, description, remarks, items } = req.body;

    const company_id = req.user.company_id;
 
    const adjustment = await StockAdjustment.findOne({
      where: {
        id: adjustmentId,
        company_id
      },
      transaction
    });
 
    if (!adjustment) {
      return res.status(404).json({ success: false, message: "Stock adjustment not found" });
    }
    await StockAdjustmentItem.destroy({
      where: { adjustment_id: adjustment.id },
      transaction
    });
 
    const adjustmentItemsCreated = [];
 
    for (const item of items) {
      const { item_id, type, adjustment_quantity, reason,inventory_id } = item;
      const quantity = parseFloat(adjustment_quantity || 0);
 
     
 
      const existingInventory = await Inventory.findOne({
        where: {
          id:inventory_id
        },
        transaction
      });
 
      if (!existingInventory) {
        throw new Error(`Inventory not found for item_id: ${item_id}`);
      }

      const previous_quantity = parseFloat(existingInventory.quantity_available || 0);
      const new_quantity = type === "increase"
        ? previous_quantity + quantity
        : previous_quantity - quantity;
 
      if (type === "decrease" && quantity > previous_quantity) {
        throw new Error(`Cannot decrease more than available quantity for item_id: ${item_id}`);
      }
 
      const adjustment_item = await StockAdjustmentItem.create(
        {
          adjustment_id: adjustment.id,
          item_id,
          inventory_id: existingInventory.id,
          previous_quantity,
          reason,
          type,
          adjustment_quantity: quantity,
          difference: new_quantity,
          company_id,
          created_by: req.user.id,
          updated_by: req.user.id,
        },
        { transaction }
      );
 
      adjustmentItemsCreated.push(adjustment_item);
 
      await existingInventory.update(
        { quantity_available: new_quantity },
        {adjustment_id : adjustment.id},
        { transaction }
      );
    }
 
    // ✅ Update the stock adjustment itself
    await adjustment.update(
      {
        remarks,
        updated_by: req.user.id,
        adjustment_date: date,
        updated_at: new Date(),
        reference_number,
        mode_of_adjustment,
        description,
      },
      { transaction }
    );






 
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: "Stock adjustment updated successfully",
      data: {
        adjustment,
        adjustment_items: adjustmentItemsCreated
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Stock adjustment update error:", error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});
 
 
// DELETE adjustment (soft delete)
v1Router.delete("/stock-adjustments/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
 
  try {
    const { id } = req.params;
    const userId = req.user.id;
 
    const adjustment = await StockAdjustment.findByPk(id, { transaction });
 
    if (!adjustment) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Stock adjustment not found" });
    }
 
    // Fetch associated adjustment items
    const adjustmentItems = await StockAdjustmentItem.findAll({
      where: { adjustment_id: id },
      transaction
    });
 
    // Soft-delete each adjustment item
    for (const item of adjustmentItems) {
      await item.update({
        status: "inactive",
        updated_by: userId,
        updated_at: new Date(),
        deleted_at: new Date(),
      }, { transaction });
    }
 
    // Soft-delete parent adjustment
    await adjustment.update({
      status: "inactive",
      updated_by: userId,
      updated_at: new Date(),
      deleted_at: new Date(),
    }, { transaction });
 
    await transaction.commit();
 
    return res.status(200).json({
      success: true,
      message: "Stock adjustment and items deleted successfully",
    });
 
  } catch (err) {
    await transaction.rollback();
    console.error("Error deleting stock adjustment:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "An unexpected error occurred",
    });
  }
});
 
 
 
 
 
 
app.use("/api", v1Router);
const PORT = process.env.PORT_STOCK_ADJUSTMENT;
app.listen(PORT, () => {
  console.log(`Stock Adjustment running on port ${PORT}`);
});