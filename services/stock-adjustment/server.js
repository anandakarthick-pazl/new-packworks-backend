// Import dependencies and models
import express from "express";
import { json, Router } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";


// Import models
import db from "../../common/models/index.js";
const StockAdjustment = db.StockAdjustment;
const StockAdjustmentItem = db.StockAdjustmentItem;
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
    const { inventory_id, remarks, items } = req.body;

    // Validate input
    if (!inventory_id || !remarks) {
      return res.status(400).json({
        success: false,
        message: "'inventory_id' and 'remarks' are required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "'items' must be a non-empty array",
      });
    }

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

    // Create StockAdjustment entry
    const adjustment = await StockAdjustment.create({
      inventory_id,
      company_id,
      adjustment_date: new Date(),
      
      remarks,
      status: "active",
      created_by: req.user.id,
    }, { transaction });

    for (const item of items) {
      const type = item.type;
      const adjustment_quantity = parseFloat(item.adjustment_quantity || 0);

      if (!["increase", "decrease"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Item type must be 'increase' or 'decrease'",
        });
      }

      // Get existing inventory
      const existingInventory = await Inventory.findOne({
        where: { item_id },
        transaction,
      });

      const previous_quantity = existingInventory
        ? parseFloat(existingInventory.quantity_available)
        : 0;

      let new_quantity;
      let difference;

      if (type === "increase") {
        new_quantity = previous_quantity + adjustment_quantity;
        difference = new_quantity
      } else if (type === "decrease") {
        if (adjustment_quantity > previous_quantity) {
          return res.status(400).json({
            success: false,
            message: "Cannot decrease more than available quantity",
          });
        }
        new_quantity = previous_quantity - adjustment_quantity;
        difference =new_quantity
      }

      // Create StockAdjustmentItem
      await StockAdjustmentItem.create({
        adjustment_id: adjustment.id,
        item_id,
        previous_quantity,
        type,
        adjustment_quantity,
        difference,
        company_id,
        created_by: req.user.id,
      }, { transaction });

      // Update or create Inventory
      if (existingInventory) {
        await existingInventory.update({
          quantity_available: new_quantity,
        }, { transaction });
      } else {
        await Inventory.create({
          item_id,
          quantity_available: new_quantity,
          company_id,
          created_by: req.user.id,
        }, { transaction });
      }
    }

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Stock Adjustment created successfully",
      data: {
        adjustment,
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
    const adjustments = await StockAdjustment.findAll({
      where: { status: "active" },
      include: [
        {
          model: StockAdjustmentItem,
          
        }
      ],
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      message: "Stock adjustments fetched successfully",
      data: adjustments,
    });

  } catch (error) {
    console.error("Error fetching stock adjustments:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
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
    console.log(`Adjustment ID: ${adjustmentId}`);
    const { remarks, items } = req.body;

    // Validate request body
    if (!remarks || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "'remarks' and non-empty 'items' are required",
      });
    }

    // Fetch the stock adjustment with items
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

    // Revert previous inventory updates by updating the `quantity_available`
    for (const item of adjustment.StockAdjustmentItems) {
      console.log(`Processing item: ${item}`);
      const inventory = await Inventory.findOne({
        where: { id: item.inventory_id },
        transaction,
      });

      if (inventory) {
        await inventory.update({
          quantity_available: item.type === "increase"
            ? inventory.quantity_available - item.adjustment_quantity
            : inventory.quantity_available + item.adjustment_quantity,
        }, { transaction });
      }

      // Remove old adjustment items
      await item.destroy({ transaction });
    }

    // Update the adjustment record
    await adjustment.update({ remarks }, { transaction });

    // Process the new items
    for (const item of items) {
      const { inventory_id, type, adjustment_quantity } = item;
      const parsedQty = parseFloat(adjustment_quantity || 0);

      if (!inventory_id || !["increase", "decrease"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Each item must have 'inventory_id', valid 'type', and 'adjustment_quantity'",
        });
      }

      const inventory = await Inventory.findOne({
        where: { id: inventory_id },
        transaction,
      });

      if (!inventory) {
        return res.status(404).json({
          success: false,
          message: `Inventory not found for inventory_id ${inventory_id}`,
        });
      }

      const previous_quantity = parseFloat(inventory.quantity_available || 0);
      let new_quantity;
      let difference;

      if (type === "increase") {
        new_quantity = previous_quantity + parsedQty;
        difference = new_quantity - previous_quantity;
      } else {
        if (parsedQty > previous_quantity) {
          return res.status(400).json({
            success: false,
            message: "Cannot decrease more than available quantity",
          });
        }
        new_quantity = previous_quantity - parsedQty;
        difference = previous_quantity - new_quantity;
      }

      // Create new StockAdjustmentItem for the updated items
      await StockAdjustmentItem.create({
        adjustment_id: adjustment.id,
        inventory_id,
        previous_quantity,
        type,
        adjustment_quantity: parsedQty,
        difference,
        company_id: adjustment.company_id,
        created_by: req.user.id,
      }, { transaction });

      // Update the inventory record
      await inventory.update({
        quantity_available: new_quantity,
      }, { transaction });
    }

    // Commit the transaction
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
  try {
    const adjustment = await StockAdjustment.findByPk(req.params.id);
    if (!adjustment) return res.status(404).json({ success: false, message: "Not found" });

    await adjustment.update({ status: "inactive", updated_by: req.user.id });

    res.status(200).json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3031;
app.listen(process.env.PORT_STOCK_ADJUSTMENT, '0.0.0.0',() => {
  console.log(`Stock Adjustment running on port ${process.env.PORT_STOCK_ADJUSTMENT}`);
});