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
 
    // ✅ Step 1: Get the item info
    const item = await ItemMaster.findOne({
      where: { id: item_id },
      attributes: ['id', 'item_generate_id', 'item_name']
    });
 
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }
 
    // ✅ Step 2: Get matching Purchase Orders
    const poItems = await PurchaseOrderItem.findAll({
      where: { item_id },
      attributes: ['id','po_id','item_id'],
      include: [
      {
        model: PurchaseOrder,
        attributes: ['id','purchase_generate_id']
      }
    ]
    });
    if(!poItems){
      return res.status(404).json({ success: false, message: "Purchase Order not found" });
    }
 
    // ✅ Final response
    return res.status(200).json({
      success: true,
      message: "Item, Purchase Orders, and GRNs fetched successfully",
      data: {
        // item: {
        //   id: item.id,
        //   item_generate_id: item.item_generate_id,
        //   item_name: item.item_name,
        // },
        purchase_orders_items: poItems,
        // grns: grnItems
      }
    });
 
  } catch (error) {
    console.error("Error fetching item-related data:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch item-related info"
    });
  }
});
 
 
// po_id based on grn_id
v1Router.get("/stock-adjustments/grn/:po_id", authenticateJWT, async (req, res) => {
  try {
    const po_id = req.params.po_id;
    const grnItems = await GRN.findAll({
      where: { po_id },
      attributes: ['id', 'po_id','grn_generate_id'],
    });
    if(!grnItems){
      return res.status(404).json({ success: false, message: "GRN not found" });
    }
    return res.status(200).json({
      success: true,
      message: "GRN fetched successfully",
      data: {
        grns: grnItems
      }
    });
  } catch (error) {
    console.error("Error fetching GRN items:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch GRN items"
    });
  }
});
 
 
 
v1Router.post("/stock-adjustments", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    console.log("Creating stock adjustment with items:", req.body);
   
    const { remarks, items } = req.body;
    const stockAdjustmentId = await generateId(req.user.company_id, StockAdjustment, "stock_adjustment");
    const company_id = req.user.company_id;
 
    const adjustment = await StockAdjustment.create(
      {
        stock_adjustment_generate_id: stockAdjustmentId,
        company_id,
        adjustment_date: new Date(),
        remarks,
        created_by: req.user.id,
        updated_by: req.user.id,
      },
      { transaction }
    );
 
    const adjustmentItemsCreated = [];
 
    for (const item of items) {
      const { item_id, type, adjustment_quantity, reason,po_id,grn_id } = item;
      const quantity = parseFloat(adjustment_quantity || 0);
      const existingInventory = await Inventory.findOne({
        where: {
          item_id,
          grn_id,
          po_id,
          company_id
        },
        transaction
      });
 
      console.log("adjustment id before saving the inventory ", adjustment.id);
     
      existingInventory.adjustment_id = adjustment.id;
      await existingInventory.save({ transaction });
 
      console.log("Existing Inventory:", existingInventory.adjustment_id);
 
 
      if (!existingInventory) {
        throw new Error(`Inventory not found for item_id: ${item_id}, grn_item_id: ${po_id}, po_item_id: ${grn_id}`);
      }
 
      const previous_quantity = parseFloat(existingInventory.quantity_available || 0);
      const new_quantity =
        type === "increase"
          ? previous_quantity + quantity
          : previous_quantity - quantity;
 
      if (type === "decrease" && quantity > previous_quantity) {
        throw new Error(`Cannot decrease more than available quantity for item_id: ${item_id}`);
      }
       console.log("ExistingInv:", existingInventory.adjustment_id);

      const adjustment_item = await StockAdjustmentItem.create(
        {
          adjustment_id: adjustment.id,
          item_id,
          inventory_id: existingInventory.id,
          grn_id,
          po_id,
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
 
// GET all adjustments
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
        { remarks: { [Op.like]: `%${search}%` } },
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
    const { remarks, items } = req.body;
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
      const { item_id, type, adjustment_quantity, reason,po_id,grn_id } = item;
      const quantity = parseFloat(adjustment_quantity || 0);
 
     
 
      const existingInventory = await Inventory.findOne({
        where: {
          item_id,
          grn_id,
          po_id,
          company_id
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
          grn_id,
          po_id,
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
        { transaction }
      );
    }
 
    // ✅ Update the stock adjustment itself
    await adjustment.update(
      {
        remarks,
        updated_by: req.user.id,
        adjustment_date: new Date(),
        updated_at: new Date(),
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
await db.sequelize.sync();
const PORT = process.env.PORT_STOCK_ADJUSTMENT;
app.listen(PORT, () => {
  console.log(`Stock Adjustment running on port ${PORT}`);
});
 
 
 
// v1Router.get("/stock-adjustments/lookup", authenticateJWT, async (req, res) => {
//   try {
//     // Step 1: Get all unique item_ids from inventory
//     const inventoryData = await Inventory.findAll({
//       attributes: ['item_id'],
//     });
//     const itemIds = [...new Set(inventoryData.map(inv => inv.item_id))];
 
//     // Step 2: Get item details
//     const items = await ItemMaster.findAll({
//       where: { id: itemIds },
//       attributes: ['id', 'item_generate_id', 'item_name'],
//       include: [
//         {
//           model: PurchaseOrderItem,
//           attributes: ['id', 'po_id', 'item_id'],
//           include: [
//             {
//               model: PurchaseOrder,
//               attributes: ['id', 'purchase_generate_id'],
//               include: [
//                 {
//                   model: GRN,
//                   attributes: ['id', 'grn_generate_id']
//                 }
//               ]
//             }
//           ]
//         }
//       ]
//     });
 
//     const formattedItems = items.map(item => ({
//       id: item.id,
//       item_generate_id: item.item_generate_id,
//       item_name: item.item_name,
//       purchase_orders: item.PurchaseOrderItems.map(poi => ({
//         po_item_id: poi.id,
//         po_id: poi.po_id,
//         purchase_generate_id: poi.PurchaseOrder?.purchase_generate_id || null,
//         grns: poi.PurchaseOrder?.GRNs?.map(grn => ({
//           grn_id: grn.id,
//           grn_generate_id: grn.grn_generate_id
//         })) || []
//       }))
//     }));
 
//     return res.status(200).json({
//       success: true,
//       message: "Items, Purchase Orders, and GRNs fetched successfully",
//       data: formattedItems
//     });
 
//   } catch (error) {
//     console.error("Error fetching lookup data:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch stock adjustment lookup data"
//     });
//   }
// });