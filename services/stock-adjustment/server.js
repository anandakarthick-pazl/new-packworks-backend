import express from "express";
import { json, Router } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { NOW, Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import db from "../../common/models/index.js";

const StockAdjustment = db.stockAdjustment;
const StockAdjustmentItem = db.stockAdjustmentItem;
const Inventory = db.Inventory;
const ItemMaster = db.ItemMaster;
const User = db.User;
const Company = db.Company;

const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();
dotenv.config();









//get all items based on inventory
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

// Create stock adjustment
// v1Router.post("/stock-adjustments", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();
//   try {
//     const { remarks, items } = req.body;
//     const stockAdjustmentId = await generateId(req.user.company_id, StockAdjustment, "stock_adjustment");
//     const company_id = req.user.company_id;

//     const adjustment = await StockAdjustment.create(
//       {
//         stockAdjustmentId,
//         company_id,
//         adjustment_date: new Date(),
//         remarks,
//         created_by: req.user.id,
//         updated_by: req.user.id,
//       },
//       { transaction }
//     );

//     for (const item of items) {
//       const { type, adjustment_quantity, item_id, reason } = item;
//       const quantity = parseFloat(adjustment_quantity || 0);

//       const existingInventory = await Inventory.findOne({
//         where: { item_id, company_id },
//         transaction,
//       });

//       if (!existingInventory) {
//         await transaction.rollback();
//         return res.status(404).json({
//           success: false,
//           message: `Inventory not found for item_id: ${item_id}`,
//         });
//       }

//       const previous_quantity = parseFloat(existingInventory.quantity_available || 0);
//       let new_quantity =
//         type === "increase"
//           ? previous_quantity + quantity
//           : previous_quantity - quantity;

//       if (type === "decrease" && quantity > previous_quantity) {
//         await transaction.rollback();
//         return res.status(400).json({
//           success: false,
//           message: "Cannot decrease more than available quantity",
//         });
//       }

//       const adjustment_items = await StockAdjustmentItem.create(
//         {
//           adjustment_id: adjustment.id,
//           item_id,
//           inventory_id: existingInventory.id,
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

//       await existingInventory.update(
//         { quantity_available: new_quantity },
//         { transaction }
//       );
//     }

//     await transaction.commit();
//     return res.status(201).json({
//       success: true,
//       data: {adjustment, adjustment_items},
//       message: "Stock adjustment created successfully",
//       adjustment_id: adjustment.id,
//     });

//   } catch (error) {
//     await transaction.rollback();
//     console.error("Stock adjustment error:", error);
//     return res.status(500).json({
//       success: false,
//       message: `Stock adjustment error: ${error.message}`,
//     });
//   }
// });

v1Router.post("/stock-adjustments", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { remarks, items } = req.body;
    const stockAdjustmentId = await generateId(req.user.company_id, StockAdjustment, "stock_adjustment");
    const company_id = req.user.company_id;

    const adjustment = await StockAdjustment.create(
      {
        stock_adjustment_generate_id:stockAdjustmentId,
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
      const { type, adjustment_quantity, item_id, reason } = item;
      const quantity = parseFloat(adjustment_quantity || 0);

      const existingInventory = await Inventory.findOne({
        where: { item_id, company_id },
        transaction,
      });

      if (!existingInventory) {
        throw new Error(`Inventory not found for item_id: ${item_id}`);
      }

      const previous_quantity = parseFloat(existingInventory.quantity_available || 0);
      let new_quantity =
        type === "increase"
          ? previous_quantity + quantity
          : previous_quantity - quantity;

      if (type === "decrease" && quantity > previous_quantity) {
        throw new Error("Cannot decrease more than available quantity");
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
        { transaction }
      );
    }

    await transaction.commit();
    return res.status(201).json({
      success: true,
      data: { adjustment, adjustment_items: adjustmentItemsCreated },
      message: "Stock adjustment created successfully",
      adjustment_id: adjustment.id,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Stock adjustment error:", error.message);
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


// put
// v1Router.put("/stock-adjustments/:id", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();
//   try {
//     const { remarks, items } = req.body;
//     const adjustmentId = req.params.id;
//     console.log("Adjustment ID:", adjustmentId);
    
//     const company_id = req.user.company_id;

//     const adjustment = await StockAdjustment.findOne({
//       where: { id: adjustmentId, company_id, status: "active" },
//       include: [{ model: StockAdjustmentItem }],
//       transaction,
//     });

//     if (!adjustment) {
//       throw new Error("Stock Adjustment not found");
//     }

//     // 2. Rollback old quantities
//     for (const oldItem of adjustment.StockAdjustmentItems) {
//       const inventory = await Inventory.findOne({
//         where: { id: oldItem.inventory_id },
//         transaction,
//       });

//       if (inventory) {
//         const diff = parseFloat(oldItem.adjustment_quantity || 0);
//         inventory.quantity_available =
//           oldItem.type === "increase"
//             ? inventory.quantity_available - diff
//             : inventory.quantity_available + diff;

//         await inventory.save({ transaction });
//       }
//     }
//     await StockAdjustmentItem.destroy({
//       where: { adjustment_id: adjustmentId },
//       transaction,
//     });

//     const newAdjustmentItems = [];
//     for (const item of items) {
//       const { type, adjustment_quantity, item_id, reason } = item;
//       const quantity = parseFloat(adjustment_quantity || 0);

//       const inventory = await Inventory.findOne({
//         where: { item_id, company_id },
//         transaction,
//       });

//       if (!inventory) {
//         throw new Error(`Inventory not found for item_id: ${item_id}`);
//       }

//       const previous_quantity = parseFloat(inventory.quantity_available || 0);
//       let new_quantity =
//         type === "increase"
//           ? previous_quantity + quantity
//           : previous_quantity - quantity;

//       if (type === "decrease" && quantity > previous_quantity) {
//         throw new Error("Cannot decrease more than available quantity");
//       }

//       const adjustment_item = await StockAdjustmentItem.create(
//         {
//           adjustment_id: adjustment.id,
//           item_id,
//           inventory_id: inventory.id,
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

//       newAdjustmentItems.push(adjustment_item);

//       await inventory.update({ quantity_available: new_quantity }, { transaction });
//     }

//     // 5. Update remarks, updated_by
//     await adjustment.update(
//       {
//         remarks,
//         updated_by: req.user.id,
//         updated_at: new Date(),
//       },
//       { transaction }
//     );

//     await transaction.commit();
//     return res.status(200).json({
//       success: true,
//       message: "Stock adjustment updated successfully",
//       data: { adjustment, adjustment_items: newAdjustmentItems },
//     });
//   } catch (error) {
//     await transaction.rollback();
//     console.error("Update error:", error.message);
//     return res.status(400).json({
//       success: false,
//       message: error.message,
//     });
//   }
// });


// PUT: Update adjustment
// v1Router.put("/stock-adjustments/:id", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();
//     const updatedItems = [];

//   try {
//     const adjustmentId = req.params.id;
//     const {  reason, items } = req.body;

//     const adjustment = await StockAdjustment.findByPk(adjustmentId, { transaction });

//     if (!adjustment) {
//       return res.status(404).json({
//         success: false,
//         message: "Stock Adjustment not found",
//       });
//     }

//     const company_id = req.user.company_id;

//     // Update main stock adjustment fields
//     const adjustmentdata =await adjustment.update(
//       {
//         reason,
//         updated_by: req.user.id,
//         updated_at: new Date(),
//       },
//       { transaction }
//     );

//     // Process updates to each adjustment item
//     for (const item of items) {
//       const { item_id, type, adjustment_quantity } = item;
//       const quantity = parseFloat(adjustment_quantity || 0);

//       if (!["increase", "decrease"].includes(type)) {
//         return res.status(400).json({
//           success: false,
//           message: "Item type must be 'increase' or 'decrease'",
//         });
//       }

//       const inventory = await Inventory.findOne({
//         where: { item_id, company_id },
//         transaction,
//       });

//       if (!inventory) {
//         return res.status(404).json({
//           success: false,
//           message: `Inventory not found for item_id: ${item_id}`,
//         });
//       }

//       const stockItem = await StockAdjustmentItem.findOne({
//         where: { adjustment_id: adjustment.id, item_id },
//         transaction,
//       });

//       if (!stockItem) {
//         return res.status(404).json({
//           success: false,
//           message: `Stock Adjustment Item not found for item_id: ${item_id}`,
//         });
//       }

//       // Use current inventory value to calculate new quantity
//       const previous_quantity = parseFloat(inventory.quantity_available || 0);
//       const new_quantity = type === "increase"
//         ? previous_quantity + quantity
//         : previous_quantity - quantity;

//       if (type === "decrease" && quantity > previous_quantity) {
//         return res.status(400).json({
//           success: false,
//           message: `Cannot decrease more than available for item_id: ${item_id}`,
//         });
//       }

//       const updatedStockItem  = await stockItem.update(
//         {
//           type,
//           adjustment_quantity: quantity,
//           previous_quantity,
//           difference: new_quantity,
//           updated_by: req.user.id,
//           updated_at: new Date(),
//         },
//         { transaction }
//       );

// updated_items: updatedItems, // ✅ use the correct variable name


//       await inventory.update(
//         { quantity_available: new_quantity },
//         { transaction }
//       );
//     }

//     await transaction.commit();

//     return res.status(200).json({
//       success: true,
//       data: {
//         adjustment: adjustmentdata,
//         updated_items: updated_items,
//     },
//       message: "Stock Adjustment updated successfully",
//     });
//   } catch (error) {
//     await transaction.rollback();
//     console.error("Update error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Unexpected error during update",
//     });
//   }
// });


v1Router.put("/stock-adjustments/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  const updatedItems = [];

  try {
    const adjustmentId = req.params.id;
    const { remarks, items } = req.body;

    const adjustment = await StockAdjustment.findByPk(adjustmentId, { transaction });

    if (!adjustment) {
      return res.status(404).json({
        success: false,
        message: "Stock Adjustment not found",
      });
    }

    const company_id = req.user.company_id;

    // Update the main stock adjustment record
    const adjustmentdata = await adjustment.update(
      {
        remarks,
        updated_by: req.user.id,
        updated_at: new Date(),
      },
      { transaction }
    );

    // Process and update each item in the adjustment
    for (const item of items) {
      const { item_id, type, adjustment_quantity } = item;
      const quantity = isNaN(adjustment_quantity)
        ? 0
        : parseFloat(adjustment_quantity);

      if (!["increase", "decrease"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Item type must be 'increase' or 'decrease'",
        });
      }

      const inventory = await Inventory.findOne({
        where: { item_id, company_id },
        transaction,
      });

      if (!inventory) {
        return res.status(404).json({
          success: false,
          message: `Inventory not found for item_id: ${item_id}`,
        });
      }

      const stockItem = await StockAdjustmentItem.findOne({
        where: { adjustment_id: adjustment.id, item_id },
        transaction,
      });

      if (!stockItem) {
        return res.status(404).json({
          success: false,
          message: `Stock Adjustment Item not found for item_id: ${item_id}`,
        });
      }

      const previous_quantity = parseFloat(inventory.quantity_available || 0);
      const new_quantity =
        type === "increase"
          ? previous_quantity + quantity
          : previous_quantity - quantity;

      if (type === "decrease" && quantity > previous_quantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot decrease more than available for item_id: ${item_id}`,
        });
      }

      const updatedStockItem = await stockItem.update(
        {
          type,
          adjustment_quantity: quantity,
          previous_quantity,
          difference: new_quantity,
          updated_by: req.user.id,
          updated_at: new Date(),
        },
        { transaction }
      );

      updatedItems.push(updatedStockItem);

      await inventory.update(
        { quantity_available: new_quantity },
        { transaction }
      );
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      data: {
        adjustment: adjustmentdata,
        updated_items: updatedItems,
      },
      message: "Stock Adjustment updated successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Unexpected error during update",
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

// v1Router.post("/stock-adjustments", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();

// })
