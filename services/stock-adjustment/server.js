// Import dependencies and models
import express from "express";
import { json, Router } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { NOW, Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";



// Import models
import db from "../../common/models/index.js";
const StockAdjustment = db.stockAdjustment;
const StockAdjustmentItem = db.stockAdjustmentItem;
const Inventory = db.Inventory;
const ItemMaster = db.ItemMaster;
const User = db.User;
const Company = db.Company;

// Express setup
dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();


// Create Stock Adjustment
v1Router.post("/stock-adjustments", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { inventory_id, remarks, reason, items } = req.body;

    // Basic validations
    if (!inventory_id || !remarks || !reason) {
      return res.status(400).json({
        success: false,
        message: "'inventory_id', 'remarks', and 'reason' are required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "'items' must be a non-empty array",
      });
    }

    // Generate stock_adjustment_generate_id
    const stock_adjustment_generate_id = await generateId(
      req.user.company_id,
      StockAdjustment,
      "stock_adjustments"
    );

    // Fetch inventory record
    const inventoryRecord = await Inventory.findOne({
      where: { id: inventory_id },
      transaction,
    });

    if (!inventoryRecord) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    const item_id = inventoryRecord.item_id;
    const company_id = inventoryRecord.company_id;

    if (!item_id) {
      return res.status(400).json({
        success: false,
        message: "Item ID not found in the inventory record",
      });
    }

    // Create main StockAdjustment record
    const adjustment = await StockAdjustment.create(
      {
        stock_adjustment_generate_id,
        inventory_id,
        company_id,
        adjustment_date: new Date(),
        reason,
        remarks,
        status: "active",
        created_by: req.user.id,
        updated_by: req.user.id,
      },
      { transaction }
    );

    // Process each adjustment item
    for (const item of items) {
      const { type, adjustment_quantity } = item;
      const quantity = parseFloat(adjustment_quantity || 0);

      if (!["increase", "decrease"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Item type must be 'increase' or 'decrease'",
        });
      }

      const existingInventory = await Inventory.findOne({
        where: { item_id },
        transaction,
      });

      const previous_quantity = existingInventory
        ? parseFloat(existingInventory.quantity_available)
        : 0;

      let new_quantity =
        type === "increase"
          ? previous_quantity + quantity
          : previous_quantity - quantity;

      if (type === "decrease" && quantity > previous_quantity) {
        return res.status(400).json({
          success: false,
          message: "Cannot decrease more than available quantity",
        });
      }

      await StockAdjustmentItem.create(
        {
          adjustment_id: adjustment.id,
          item_id,
          previous_quantity,
          type,
          adjustment_quantity: quantity,
          difference: new_quantity,
          company_id,
          created_by: req.user.id,
          updated_by: req.user.id,
        },
        { transaction }
      );

      if (existingInventory) {
        await existingInventory.update(
          { quantity_available: new_quantity },
          { transaction }
        );
      } else {
        await Inventory.create(
          {
            item_id,
            quantity_available: new_quantity,
            company_id,
            created_by: req.user.id,
            updated_by: req.user.id,
          },
          { transaction }
        );
      }
    }

    // Commit transaction
    await transaction.commit();

    // Prepare response (exclude unnecessary fields)
    const {
      deleted_at,
      updated_by,
      updated_at,
      ...adjustmentData
    } = adjustment.get({ plain: true });

    const adjustmentItems = await StockAdjustmentItem.findAll({
      where: { adjustment_id: adjustment.id },
      attributes: {
        exclude: ["deleted_at", "updated_by", "updated_at"],
      },
    });

    return res.status(201).json({
      success: true,
      message: "Stock Adjustment created successfully",
      data: {
        adjustment: adjustmentData,
        items: adjustmentItems,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Stock adjustment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred",
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
        { reason: { [Op.like]: `%${search}%` } },
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
        }
      ],
    });

    if (!adjustment) {
      return res.status(404).json({
        success: false,
        message: "Stock adjustment not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stock adjustment fetched successfully",
      data: adjustment,
    });

  } catch (error) {
    console.error("Error fetching stock adjustment by ID:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
});


// PUT: Update adjustment
v1Router.put("/stock-adjustments/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const adjustmentId = req.params.id;
    const { remarks, reason, items } = req.body;

    if (!remarks || !reason) {
      return res.status(400).json({
        success: false,
        message: "'remarks' and 'reason' are required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "'items' must be a non-empty array",
      });
    }

    const adjustment = await StockAdjustment.findOne({
      where: { id: adjustmentId, status: "active" },
      include: [{ model: StockAdjustmentItem }],
      transaction,
    });

    if (!adjustment) {
      return res.status(404).json({
        success: false,
        message: "Stock adjustment not found",
      });
    }

    const inventoryRecord = await Inventory.findOne({
      where: { id: adjustment.inventory_id },
      transaction,
    });

    if (!inventoryRecord) {
      return res.status(404).json({
        success: false,
        message: "Associated inventory not found",
      });
    }

    const item_id = inventoryRecord.item_id;

    // Revert previous adjustments
    for (const item of adjustment.StockAdjustmentItems) {
      const { type, adjustment_quantity } = item;
      const inventory = await Inventory.findOne({
        where: { item_id: item.item_id },
        transaction,
      });

      if (!inventory) continue;

      const currentQty = parseFloat(inventory.quantity_available);
      const qty = parseFloat(adjustment_quantity);

      const revertedQty = type === "increase" ? currentQty - qty : currentQty + qty;

      await inventory.update({ quantity_available: revertedQty }, { transaction });
    }

    // Update stock adjustment
    await adjustment.update({
      remarks,
      reason,
      updated_by: req.user.id,
      updated_at: new Date(), 
    }, { transaction });

    for (const item of items) {
      const { id, type, adjustment_quantity } = item;
      const quantity = parseFloat(adjustment_quantity || 0);

      if (!["increase", "decrease"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Item type must be 'increase' or 'decrease'",
        });
      }

      const adjustmentItem = await StockAdjustmentItem.findOne({
        where: { id, adjustment_id: adjustmentId },
        transaction,
      });

      if (!adjustmentItem) {
        return res.status(404).json({
          success: false,
          message: `StockAdjustmentItem with ID ${id} not found`,
        });
      }

      const inventory = await Inventory.findOne({
        where: { item_id: adjustmentItem.item_id },
        transaction,
      });

      if (!inventory) {
        return res.status(404).json({
          success: false,
          message: "Associated inventory not found",
        });
      }

      const previous_quantity = parseFloat(inventory.quantity_available);
      let new_quantity;

      if (type === "increase") {
        new_quantity = previous_quantity + quantity;
      } else {
        if (quantity > previous_quantity) {
          return res.status(400).json({
            success: false,
            message: "Cannot decrease more than available quantity",
          });
        }
        new_quantity = previous_quantity - quantity;
      }

      await inventory.update({ quantity_available: new_quantity }, { transaction });

      await adjustmentItem.update({
        previous_quantity,
        adjustment_quantity: quantity,
        difference: new_quantity,
        type,
        updated_by: req.user.id,
        updated_at: new Date(), // 
      }, { transaction });
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Stock adjustment updated successfully",
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Error updating stock adjustment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred",
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