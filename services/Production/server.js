import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const ProductionGroup = db.ProductionGroup;

// POST create new production group
v1Router.post("/production-group", authenticateJWT, async (req, res) => {
  const groupDetails = req.body;

  if (!groupDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  // Validate required fields
  if (!groupDetails.group_name) {
    return res.status(400).json({ message: "Group name is required" });
  }

  try {
    // Create Production Group
    const newProductionGroup = await ProductionGroup.create({
      company_id: req.user.company_id,
      group_name: groupDetails.group_name,
      group_value: groupDetails.group_value || null,
      group_Qty: groupDetails.group_Qty || null,
      status: groupDetails.status || "active",
      created_by: req.user.id,
      updated_by: req.user.id,
    });

    res.status(201).json({
      message: "Production Group created successfully",
      data: newProductionGroup,
    });
  } catch (error) {
    logger.error("Error creating production group:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET all production groups with pagination and filtering
v1Router.get("/production-group", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      group_name,
      status = "active", // Default to 'active' status
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const whereClause = {
      company_id: req.user.company_id, // Add company filter for security
    };

    // Status filtering - default to active, but allow override
    if (status === "all") {
      // Don't filter by status if 'all' is specified
    } else {
      whereClause.status = status;
    }

    if (group_name) {
      whereClause.group_name = { [Op.like]: `%${group_name}%` };
    }

    // Fetch from database with pagination and filters
    const { count, rows } = await ProductionGroup.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset: offset,
      order: [["updated_at", "DESC"]],
      include: [
        {
          association: "creator_group",
          attributes: ["id", "name", "email"],
        },
        {
          association: "updater_group",
          attributes: ["id", "name", "email"],
        },
      ],
    });

    // Parse group_value JSON strings for each production group
    const processedRows = rows.map(group => {
      const groupObj = group.toJSON();
      try {
        if (groupObj.group_value && typeof groupObj.group_value === 'string') {
          groupObj.group_value = JSON.parse(groupObj.group_value);
        }
      } catch (parseError) {
        logger.warn(`Failed to parse group_value for production group ${groupObj.id}:`, parseError);
        // Keep original string value if parsing fails
      }
      return groupObj;
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / limitNum);

    res.json({
      productionGroups: processedRows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (error) {
    logger.error("Error fetching production groups:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET single production group by ID
v1Router.get("/production-group/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const productionGroup = await ProductionGroup.findOne({
      where: {
        id: id,
        company_id: req.user.company_id, // Security: only company's own groups
      },
      include: [
        {
          association: "creator_group",
          attributes: ["id", "name", "email"],
        },
        {
          association: "updater_group",
          attributes: ["id", "name", "email"],
        },
      ],
    });

    if (!productionGroup) {
      return res.status(404).json({ message: "Production Group not found" });
    }

    // Parse group_value JSON string
    const groupObj = productionGroup.toJSON();
    try {
      if (groupObj.group_value && typeof groupObj.group_value === 'string') {
        groupObj.group_value = JSON.parse(groupObj.group_value);
      }
    } catch (parseError) {
      logger.warn(`Failed to parse group_value for production group ${groupObj.id}:`, parseError);
      // Keep original string value if parsing fails
    }

    res.json({
      message: "Production Group retrieved successfully",
      data: groupObj,
    });
  } catch (error) {
    logger.error("Error fetching production group:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// PUT update production group
v1Router.put("/production-group/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const updateDetails = req.body;

    if (!updateDetails) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    const productionGroup = await ProductionGroup.findOne({
      where: {
        id: id,
        company_id: req.user.company_id, // Security: only company's own groups
      },
    });

    if (!productionGroup) {
      return res.status(404).json({ message: "Production Group not found" });
    }

    // Update the production group
    await productionGroup.update({
      group_name: updateDetails.group_name || productionGroup.group_name,
      group_value:
        updateDetails.group_value !== undefined
          ? updateDetails.group_value
          : productionGroup.group_value,
      group_Qty:
        updateDetails.group_Qty !== undefined
          ? updateDetails.group_Qty
          : productionGroup.group_Qty,
      status: updateDetails.status || productionGroup.status,
      updated_by: req.user.id,
    });

    res.json({
      message: "Production Group updated successfully",
      data: productionGroup,
    });
  } catch (error) {
    logger.error("Error updating production group:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// DELETE production group (soft delete by setting status to inactive)
v1Router.delete("/production-group/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const productionGroup = await ProductionGroup.findOne({
      where: {
        id: id,
        company_id: req.user.company_id, // Security: only company's own groups
      },
    });

    if (!productionGroup) {
      return res.status(404).json({ message: "Production Group not found" });
    }

    // Soft delete by setting status to inactive
    await productionGroup.update({
      status: "inactive",
      updated_by: req.user.id,
    });

    res.json({
      message: "Production Group deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting production group:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
  });
});

// Use Version 1 Router
app.use("/api/production", v1Router);
// await db.sequelize.sync();
const PORT = 3029;
app.listen(process.env.PORT_PRODUCTION, "0.0.0.0", () => {
  console.log(
    `Production Service running on port ${process.env.PORT_PRODUCTION}`
  );
});
