import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import Country from "../../common/models/country.model.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const DropdownName = db.DropdownName;
const DropdownValue = db.DropdownValue;
const Currency = db.Currency;
const Flute = db.Flute;
const ModuleSettings = db.ModuleSettings;
const Module = db.Module;
const Company = db.Company;
const Die = db.Die;
const States = db.States;
const User = db.User;

// Middleware to extract user details from token
const extractUserDetails = (req, res, next) => {
  // Assuming authenticateJWT middleware has already added user details to req.user
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Extract company_id, user_id (for created_by/updated_by)
  req.userCompanyId = req.user.company_id;
  req.userId = req.user.id;

  next();
};

// POST create new dropdown name
v1Router.post(
  "/dropdown-name",
  authenticateJWT,
  extractUserDetails,
  async (req, res) => {
    const dropdownDetails = req.body;

    if (!dropdownDetails) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    // Validate required fields - only dropdown_name is strictly required
    if (!dropdownDetails.dropdown_name) {
      return res.status(400).json({
        message: "Missing required field: dropdown_name is required",
      });
    }

    try {
      // Create Dropdown Name - using token-based details
      const newDropdownName = await DropdownName.create({
        company_id: req.userCompanyId,
        client_id: dropdownDetails.client_id,
        dropdown_name: dropdownDetails.dropdown_name,
        status: dropdownDetails.status || "active",
        created_by: req.userId,
        updated_by: req.userId,
      });

      res.status(201).json({
        message: "Dropdown Name created successfully",
        data: newDropdownName,
      });
    } catch (error) {
      logger.error("Error creating dropdown name:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

// GET dropdown names with search options

v1Router.get(
  "/dropdown-name",
  authenticateJWT,
  extractUserDetails,
  async (req, res) => {
    try {
      const {
        dropdown_name,
        client_id,
        status = "active", // Default to showing only active records
      } = req.query;

      // Build filter conditions
      const where = { company_id: req.userCompanyId };
      if (dropdown_name)
        where.dropdown_name = { [Op.like]: `%${dropdown_name}%` };
      if (client_id) where.client_id = client_id;

      // Filter by status - allow "all" to return both active and inactive records
      if (status && status !== "all") {
        where.status = status;
      }

      // Fetch data from database
      const dropdownNames = await DropdownName.findAll({
        where,
        order: [["created_at", "DESC"]],
      });

      res.json(dropdownNames);
    } catch (error) {
      logger.error("Error fetching dropdown names:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

// PUT update existing dropdown name
v1Router.put(
  "/dropdown-name/:id",
  authenticateJWT,
  extractUserDetails,
  async (req, res) => {
    const { id } = req.params;
    const dropdownDetails = req.body;

    if (!dropdownDetails) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    try {
      // Find the dropdown name
      const dropdownName = await DropdownName.findByPk(id);

      if (!dropdownName) {
        return res.status(404).json({ message: "Dropdown name not found" });
      }

      // Update dropdown name
      await dropdownName.update({
        client_id: dropdownDetails.client_id || dropdownName.client_id,
        dropdown_name:
          dropdownDetails.dropdown_name || dropdownName.dropdown_name,
        // status: dropdownDetails.status || dropdownName.status,
        updated_by: req.userId,
        updated_at: new Date(),
      });

      res.json({
        message: "Dropdown Name updated successfully",
        data: dropdownName,
      });
    } catch (error) {
      logger.error("Error updating dropdown name:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

// DELETE dropdown name (soft delete)

v1Router.delete(
  "/dropdown-name/:id",
  authenticateJWT,
  extractUserDetails,
  async (req, res) => {
    const { id } = req.params;

    try {
      // Find the dropdown name
      const dropdownName = await DropdownName.findByPk(id);

      if (!dropdownName) {
        return res.status(404).json({ message: "Dropdown name not found" });
      }

      // Soft delete - update status to inactive
      await dropdownName.update({
        status: "inactive",
        updated_by: req.userId,
        updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
      });

      res.json({
        message: "Dropdown Name successfully marked as inactive",
        // data: dropdownName,
      });
    } catch (error) {
      logger.error("Error soft deleting dropdown name:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

// POST create new dropdown value
v1Router.post(
  "/dropdown-value",
  authenticateJWT,
  extractUserDetails,
  async (req, res) => {
    const valueDetails = req.body;

    if (!valueDetails) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    // Validate required fields
    if (!valueDetails.dropdown_id || !valueDetails.dropdown_value) {
      return res.status(400).json({
        message:
          "Missing required fields: dropdown_id and dropdown_value are required",
      });
    }

    try {
      // Check if dropdown name exists
      const dropdownName = await DropdownName.findByPk(
        valueDetails.dropdown_id
      );
      if (!dropdownName) {
        return res.status(404).json({ message: "Dropdown name not found" });
      }

      // Create Dropdown Value
      const newDropdownValue = await DropdownValue.create({
        company_id: req.userCompanyId,
        client_id: valueDetails.client_id,
        dropdown_id: valueDetails.dropdown_id,
        dropdown_value: valueDetails.dropdown_value,
        status: valueDetails.status || "active",
        created_by: req.userId,
        updated_by: req.userId,
      });

      res.status(201).json({
        message: "Dropdown Value created successfully",
        data: newDropdownValue,
      });
    } catch (error) {
      logger.error("Error creating dropdown value:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

// PUT update existing dropdown value
v1Router.put(
  "/dropdown-value/:id",
  authenticateJWT,
  extractUserDetails,
  async (req, res) => {
    const { id } = req.params;
    const valueDetails = req.body;

    if (!valueDetails) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    try {
      // Find the dropdown value
      const dropdownValue = await DropdownValue.findByPk(id);

      if (!dropdownValue) {
        return res.status(404).json({ message: "Dropdown value not found" });
      }

      // If dropdown_id is being changed, check if new dropdown name exists
      if (
        valueDetails.dropdown_id &&
        valueDetails.dropdown_id !== dropdownValue.dropdown_id
      ) {
        const dropdownName = await DropdownName.findByPk(
          valueDetails.dropdown_id
        );
        if (!dropdownName) {
          return res
            .status(404)
            .json({ message: "New dropdown name not found" });
        }
      }

      // Update dropdown value
      await dropdownValue.update({
        client_id: valueDetails.client_id || dropdownValue.client_id,
        dropdown_id: valueDetails.dropdown_id || dropdownValue.dropdown_id,
        dropdown_value:
          valueDetails.dropdown_value || dropdownValue.dropdown_value,
        status: valueDetails.status || dropdownValue.status,
        updated_by: req.userId,
        updated_at: new Date(),
      });

      res.json({
        message: "Dropdown Value updated successfully",
        data: dropdownValue,
      });
    } catch (error) {
      logger.error("Error updating dropdown value:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

// DELETE dropdown value (soft delete)
v1Router.delete(
  "/dropdown-value/:id",
  authenticateJWT,
  extractUserDetails,
  async (req, res) => {
    const { id } = req.params;

    try {
      // Find the dropdown value
      const dropdownValue = await DropdownValue.findByPk(id);

      if (!dropdownValue) {
        return res.status(404).json({ message: "Dropdown value not found" });
      }

      // Soft delete - update status to inactive
      await dropdownValue.update({
        status: "inactive",
        updated_by: req.userId,
        updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
      });

      res.json({
        message: "Dropdown Value successfully marked as inactive",
        // data: dropdownValue.get({ plain: true }),
      });
    } catch (error) {
      logger.error("Error soft deleting dropdown value:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

// GET dropdown values with search options
v1Router.get(
  "/dropdown-value",
  authenticateJWT,
  extractUserDetails,
  async (req, res) => {
    try {
      const {
        dropdown_id,
        dropdown_value,
        client_id,
        status = "active", // Default to showing only active records
      } = req.query;

      // Build filter conditions
      const where = { company_id: req.userCompanyId };
      if (dropdown_id) where.dropdown_id = dropdown_id;
      if (dropdown_value)
        where.dropdown_value = { [Op.like]: `%${dropdown_value}%` };
      if (client_id) where.client_id = client_id;

      // Filter by status - allow "all" to return both active and inactive records
      if (status && status !== "all") {
        where.status = status;
      }

      // Fetch data from database
      const dropdownValues = await DropdownValue.findAll({
        where,
        include: [
          {
            model: DropdownName,
            attributes: ["dropdown_name"],
            as: "dropdownName",
          },
        ],
        order: [["created_at", "DESC"]],
      });

      res.json(dropdownValues);
    } catch (error) {
      logger.error("Error fetching dropdown values:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

v1Router.get("/countries", authenticateJWT, async (req, res) => {
  try {
    const countries = await Country.findAll({
      attributes: [
        "id",
        "iso",
        "name",
        "nicename",
        "iso3",
        "numcode",
        "phonecode",
      ], // ✅ Fetch only required fields
      order: [["name", "ASC"]],
    });

    return res.json({
      success: true,
      data: countries,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching countries",
      error: error.message,
    });
  }
});

// Get Currency
v1Router.get("/currency", authenticateJWT, async (req, res) => {
  try {
    const currency = await Currency.findAll({
      where: { status: "active" },
      attributes: [
        "id",
        "company_id",
        "currency_name",
        "currency_symbol",
        "currency_code",
        "status",
      ],
    });
    return res.status(200).json({
      success: true,
      message: "Currencies fetched Successfully",
      data: currency,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get ModuleSettings
v1Router.get("/module-setting", authenticateJWT, async (req, res) => {
  try {
    const settings = await ModuleSettings.findAll({
      where: { status: "active", type: "admin" },
      attributes: ["id", "company_id", "module_name", "status"],
      group: ["module_name"],
      order: [["id", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Module Fetched Successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching Module Settings:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get Module
v1Router.get("/module", authenticateJWT, async (req, res) => {
  try {
    const module = await Module.findAll({
      where: {
        status: "active",
        is_superadmin: 0,
        module_name: { [Op.ne]: "dashboards" },
      },
      attributes: ["id", "module_name", "description"],
    });

    return res.status(200).json({
      success: true,
      message: "Module Fetched Successfully",
      data: module,
    });
  } catch (error) {
    console.error("Error fetching Module:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get Flute
v1Router.get("/flute", authenticateJWT, async (req, res) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    const offset = (pageNumber - 1) * limitNumber;
    let whereCondition = { status: "active" };
    if (search) {
      whereCondition = {
        ...whereCondition,
        name: { [Op.like]: `%${search}%` },
      };
    }
    const totalflutes = await Flute.count({ where: whereCondition });
    const flutes = await Flute.findAll({
      where: whereCondition,
      limit: limitNumber,
      offset,
    });
    const formattedFlutes = flutes.map((flt) => ({
      ...flt.toJSON(),
    }));
    return res.status(200).json({
      success: true,
      message: "Flutes Fetched Successfully",
      total: totalflutes,
      page,
      totalPages: Math.ceil(totalflutes / limit),
      data: formattedFlutes,
    });
  } catch (error) {
    console.error("Error fetching flutes:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

//create flute
v1Router.post("/flute/create", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const userId = req.user.id;
    const { fluteData, ...rest } = req.body;

    rest.created_by = userId;
    rest.updated_by = userId;
    rest.created_at = new Date();
    rest.updated_at = new Date();
    rest.company_id = req.user.company_id;

    // Save flute data
    const flute = await Flute.create(rest, { transaction });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Flute created successfully",
      data: flute.toJSON(),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating Flute:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get id based flute
v1Router.get("/flute/edit/:fluteId", authenticateJWT, async (req, res) => {
  try {
    const fluteId = parseInt(req.params.fluteId);

    if (isNaN(fluteId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid flute ID" });
    }

    const flute = await Flute.findOne({ where: { id: fluteId } });

    if (!flute) {
      return res
        .status(404)
        .json({ success: false, message: "Flute not found", data: {} });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...flute.toJSON(),
      },
    });
  } catch (error) {
    console.error("Error fetching flute:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

//update flute
v1Router.put("/flute/update/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const fulteId = req.params.id;
    const userId = req.user.id;
    const { ...rest } = req.body;

    const existingFlute = await Flute.findByPk(fulteId, { transaction });
    if (!existingFlute) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Flute not found" });
    }

    rest.updated_by = userId;

    rest.created_at = existingFlute.created_at;

    rest.updated_at = new Date();

    rest.company_id = req.user.company_id;

    await Flute.update(rest, { where: { id: fulteId }, transaction });

    const updatedFlute = await Flute.findByPk(fulteId, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Flute updated successfully",
      data: {
        ...updatedFlute.toJSON(),
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating Flute:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Delete Flute
v1Router.delete("/flute/delete/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const fluteId = req.params.id;
    const userId = req.user.id;

    const Flutes = await Flute.findOne({ where: { id: fluteId } });

    if (!Flutes) {
      return res.status(404).json({
        success: false,
        message: "Flutes not found",
      });
    }

    await Flute.update(
      {
        status: "inactive",
        updated_at: new Date(),
        updated_by: userId,
      },
      { where: { id: fluteId }, transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      status: true,
      message: "Flute deleted successfully",
      data: [],
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error Deleted Packages:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

//get die
v1Router.get("/die", authenticateJWT, async (req, res) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    const offset = (pageNumber - 1) * limitNumber;
    let whereCondition = { status: "active" };
    if (search) {
      whereCondition = {
        ...whereCondition,
        name: { [Op.like]: `%${search}%` },
      };
    }
    const totalDie = await Die.count({ where: whereCondition });
    const die = await Die.findAll({
      where: whereCondition,
      limit: limitNumber,
      offset,
    });
    const dieFlutes = die.map((diemap) => ({
      ...diemap.toJSON(),
    }));
    return res.status(200).json({
      success: true,
      message: "Die Fetched Successfully",
      total: totalDie,
      page,
      totalPages: Math.ceil(totalDie / limit),
      data: dieFlutes,
    });
  } catch (error) {
    console.error("server error : ", error);
  }
});

v1Router.post("/die/create", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const userId = req.user.id;
    const { dieData, ...rest } = req.body;

    rest.created_by = userId;
    rest.updated_by = userId;
    rest.created_at = new Date();
    rest.updated_at = new Date();
    rest.company_id = req.user.company_id;

    // Save die data
    const die = await Die.create(rest, { transaction });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Die created successfully",
      data: die.toJSON(),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating Die:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

//edit die
v1Router.get("/die/edit/:id", authenticateJWT, async (req, res) => {
  try {
    const dieId = parseInt(req.params.id);
    if (isNaN(dieId)) {
      return res.status(400).json({
        success: false,
        message: "Die id is required",
      });
    }

    const die = await Die.findOne({ where: { id: dieId } });

    if (!die) {
      return res.status(404).json({
        success: false,
        message: "Die not found",
      });
    }

    return res.status(200).json({
      sucess: true,
      data: { ...die.toJSON() },
      message: "Die Fetched Successfully",
    });
  } catch (error) {
    console.error("Die get a id based details error :", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

//update die
v1Router.put("/die/update/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const dieId = req.params.id;
    const userId = req.user.id;
    const { ...rest } = req.body;

    const existingDie = await Die.findByPk(dieId, { transaction });
    if (!existingDie) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Die not found" });
    }

    rest.updated_by = userId;

    rest.updated_at = new Date();

    rest.company_id = req.user.company_id;

    await Die.update(rest, { where: { id: dieId }, transaction });

    const updatedDie = await Die.findByPk(dieId, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Die updated successfully",
      data: {
        ...updatedDie.toJSON(),
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating Die:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

//delete die

v1Router.delete("/die/delete/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const dieId = req.params.id;
    const userId = req.user.id;

    const die = await Die.findByPk(dieId, { transaction });

    if (!die) {
      return res.status(404).json({
        success: false,
        message: "Die not found",
      });
    }

    await Die.update(
      {
        updated_by: userId,
        updated_at: new Date(),
        status: "inactive",
      },
      { where: { id: dieId }, transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Die Deleted Successfully",
      data: [],
    });
  } catch (error) {
    await transaction.rollback(); // Important: rollback on error
    console.error("Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Die delete error",
    });
  }
});

// states

v1Router.get("/states", authenticateJWT, async (req, res) => {
  try {
    const states = await States.findAll({
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: User,
          as: "updater",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    res.status(200).json({
      status: "success",
      count: states.length,
      data: states,
    });
  } catch (error) {
    console.error("Error fetching states data:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// Basic Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
  });
});

// Use Version 1 Router
app.use("/api/common-service", v1Router);

// Start the server
await db.sequelize.sync();
const PORT = 3008;
app.listen(PORT, () => {
  console.log(`Common Service running on port ${PORT}`);
});

export default app;
