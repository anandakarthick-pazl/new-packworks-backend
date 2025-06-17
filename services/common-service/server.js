import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import Country from "../../common/models/country.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendEmail } from "../../common/helper/emailService.js";
import { DemoRequestCustomerTemplate } from "../../common/services/email/templates/demoRequestCustomer.js";
import { DemoRequestAdminTemplate } from "../../common/services/email/templates/demoRequestAdmin.js";
import { ForgotPasswordTemplate } from "../../common/services/email/templates/forgotPassword.js";
import { PasswordResetSuccessTemplate } from "../../common/services/email/templates/passwordResetSuccess.js";
import { ContactFormCustomerTemplate } from "../../common/services/email/templates/contactFormCustomer.js";
import { ContactFormAdminTemplate } from "../../common/services/email/templates/contactFormAdmin.js";
import { Sequelize } from "sequelize";
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
const Color = db.Color;
const WorkOrderStatus = db.WorkOrderStatus;
const User = db.User;
const Package = db.Package;
const DemoRequest = db.DemoRequest;
const ContactMessage = db.ContactMessage;
const PasswordReset = db.PasswordReset;

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

v1Router.get("/colors", authenticateJWT, async (req, res) => {
  try {
    const colors = await Color.findAll({
      include: [
        {
          model: Company,
          as: "company",
          attributes: ["id", "company_name"],
          required: false,
        },
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
      count: colors.length,
      data: colors,
    });
  } catch (error) {
    console.error("Error fetching colors data:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

v1Router.get("/work-order-status", authenticateJWT, async (req, res) => {
  try {
    const workOrderStatus = await WorkOrderStatus.findAll({
      include: [
        {
          model: Company,
          as: "company",
          attributes: ["id", "company_name"],
          required: false,
        },
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
      count: workOrderStatus.length,
      data: workOrderStatus,
    });
  } catch (error) {
    console.error("Error fetching work order status data:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// ============ NEW API ENDPOINTS ============

// GET /packages - Fetch all packages
v1Router.get("/packages", async (req, res) => {
  try {
    const packages = await Package.findAll({
      where: { status: "active" },
      attributes: [
        "id",
        "name",
        "description",
        "monthly_price",
        "annual_price",
        "module_in_package",
        "is_recommended"
      ],
      include: [
        {
          model: Currency,
          as: "currency", // 👈 Add this
          attributes: ["currency_symbol"],
          required: false
        }
      ],
      order: [["created_at", "DESC"]]
    });

    return res.status(200).json({
      status: true,
      message: "Packages fetched successfully",
      data: packages
    });
  } catch (error) {
    logger.error("Error fetching packages:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// POST /demo-request - Create demo request
v1Router.post("/demo-request", async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      company_name,
      full_name,
      email,
      phone,
      role,
      preferred_demo_time,
      needs_description
    } = req.body;

    // Validate required fields
    if (!company_name || !full_name || !email || !phone) {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        message: "Missing required fields: company_name, full_name, email, and phone are required"
      });
    }

    // Create demo request
    const demoRequest = await DemoRequest.create({
      company_name,
      full_name,
      email,
      phone,
      role: role || "",
      preferred_demo_time: preferred_demo_time || "",
      needs_description: needs_description || "",
      source: "website_form",
      status: "pending",
      created_at: new Date(),
      updated_at: new Date()
    }, { transaction });

    await transaction.commit();

    // Send demo request customer email (async, non-blocking)
    try {
      const customerEmailTemplate = DemoRequestCustomerTemplate({
        customerName: full_name,
        companyName: company_name,
        preferredTime: preferred_demo_time,
        needs: needs_description
      });

      await sendEmail(
        email,
        "Demo Request Confirmation - PackWorkX",
        customerEmailTemplate
      );

      logger.info(`📧 Demo request customer email sent successfully to: ${email}`);
    } catch (emailError) {
      logger.error(`📧 Failed to send demo request customer email to: ${email}`, {
        error: emailError.message,
        requestId: demoRequest.id
      });
    }

    // Send demo request admin notification email (async, non-blocking)
    try {
      const adminEmailTemplate = DemoRequestAdminTemplate({
        customerName: full_name,
        companyName: company_name,
        email,
        phone,
        role,
        preferredTime: preferred_demo_time,
        needs: needs_description,
        submittedAt: new Date()
      });

      const adminEmail = process.env.ADMIN_EMAIL || "admin@packworkx.com";
      await sendEmail(
        adminEmail,
        `New Demo Request from ${company_name}`,
        adminEmailTemplate
      );

      logger.info(`📧 Demo request admin notification sent for: ${company_name}`);
    } catch (emailError) {
      logger.error(`📧 Failed to send demo request admin notification`, {
        error: emailError.message,
        requestId: demoRequest.id
      });
    }

    return res.status(201).json({
      status: true,
      message: "Demo request submitted successfully. We'll contact you soon!",
      data: {
        id: demoRequest.id,
        company_name,
        full_name,
        email,
        emailStatus: "sent"
      }
    });

  } catch (error) {
    // Only rollback if transaction hasn't been committed
    if (!transaction.finished) {
      await transaction.rollback();
    }
    logger.error("Error creating demo request:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
      data: []
    });
  }
});

// POST /forgot-password - Handle forgot password
v1Router.post("/forgot-password", async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { email } = req.body;

    if (!email) {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        message: "Email is required"
      });
    }

    // Check if user exists
    const user = await User.findOne({
      where: { email },
      transaction
    });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        status: false,
        message: "User with this email does not exist"
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save or update password reset record
    await PasswordReset.upsert({
      email,
      token: resetToken,
      expires_at: tokenExpiry,
      used: false,
      created_at: new Date(),
      updated_at: new Date()
    }, { transaction });

    await transaction.commit();

    // Send password reset email (async, non-blocking)
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${email}`;
      const forgotPasswordTemplate = ForgotPasswordTemplate({
        userName: user.name,
        resetUrl,
        expiryTime: "1 hour"
      });

      await sendEmail(
        email,
        "Password Reset Request - PackWorkX",
        forgotPasswordTemplate
      );

      logger.info(`📧 Password reset email sent successfully to: ${email}`);
    } catch (emailError) {
      logger.error(`📧 Failed to send password reset email to: ${email}`, {
        error: emailError.message
      });
    }

    return res.status(200).json({
      status: true,
      message: "Password reset instructions have been sent to your email",
      data: {
        email,
        emailStatus: "sent"
      }
    });

  } catch (error) {
    // Only rollback if transaction hasn't been committed
    if (!transaction.finished) {
      await transaction.rollback();
    }
    logger.error("Error processing forgot password:", error);
    return res.status(500).json({
      status: false,
      message: error.message
    });
  }
});

// POST /reset-password - Handle password reset
v1Router.post("/reset-password", async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { email, token, newPassword, confirmPassword } = req.body;

    // Validate required fields
    if (!email || !token || !newPassword || !confirmPassword) {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        message: "All fields are required: email, token, newPassword, confirmPassword"
      });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        message: "Passwords do not match"
      });
    }

    // Validate password strength (minimum 6 characters)
    if (newPassword.length < 6) {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        message: "Password must be at least 6 characters long"
      });
    }

    // Check if reset token is valid
    const resetRecord = await PasswordReset.findOne({
      where: {
        email,
        token,
        used: false,
        expires_at: { [Op.gt]: new Date() }
      },
      transaction
    });

    if (!resetRecord) {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        message: "Invalid or expired reset token"
      });
    }

    // Find the user
    const user = await User.findOne({
      where: { email },
      transaction
    });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        status: false,
        message: "User not found"
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await user.update({
      password: hashedPassword,
      updated_at: new Date()
    }, { transaction });

    // Mark reset token as used
    await resetRecord.update({
      used: true,
      updated_at: new Date()
    }, { transaction });

    await transaction.commit();

    // Send password reset success email (async, non-blocking)
    try {
      const passwordResetSuccessTemplate = PasswordResetSuccessTemplate({
        userName: user.name,
        resetDate: new Date(),
        loginUrl: `${process.env.FRONTEND_URL}/login`
      });

      await sendEmail(
        email,
        "Password Reset Successful - PackWorkX",
        passwordResetSuccessTemplate
      );

      logger.info(`📧 Password reset confirmation email sent to: ${email}`);
    } catch (emailError) {
      logger.error(`📧 Failed to send password reset confirmation email to: ${email}`, {
        error: emailError.message
      });
    }

    return res.status(200).json({
      status: true,
      message: "Password has been reset successfully. You can now login with your new password.",
      data: {
        email,
        passwordResetAt: new Date(),
        emailStatus: "sent"
      }
    });

  } catch (error) {
    // Only rollback if transaction hasn't been committed
    if (!transaction.finished) {
      await transaction.rollback();
    }
    logger.error("Error resetting password:", error);
    return res.status(500).json({
      status: false,
      message: error.message
    });
  }
});

// POST /contact-message - Handle contact form submissions
v1Router.post("/contact-message", async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { name, email, company, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        message: "Missing required fields: name, email, and message are required"
      });
    }

    // Create contact message
    const contactMessage = await ContactMessage.create({
      name,
      email,
      company: company || "",
      subject: subject || "Contact Form Submission",
      message,
      status: "new",
      created_at: new Date(),
      updated_at: new Date()
    }, { transaction });

    await transaction.commit();

    // Send contact form customer confirmation email (async, non-blocking)
    try {
      const customerTemplate = ContactFormCustomerTemplate({
        name,
        email,
        subject: subject || "Contact Form Submission",
        message,
        submittedAt: new Date()
      });

      await sendEmail(
        email,
        "Thank you for contacting us - PackWorkX",
        customerTemplate
      );

      logger.info(`📧 Contact form confirmation email sent to: ${email}`);
    } catch (emailError) {
      logger.error(`📧 Failed to send contact form confirmation email to: ${email}`, {
        error: emailError.message,
        contactId: contactMessage.id
      });
    }

    // Send contact form admin notification email (async, non-blocking)
    try {
      const adminTemplate = ContactFormAdminTemplate({
        name,
        email,
        company: company || "Not specified",
        subject: subject || "Contact Form Submission",
        message,
        submittedAt: new Date(),
        contactId: contactMessage.id
      });

      const adminEmail = process.env.ADMIN_EMAIL || "admin@packworkx.com";
      await sendEmail(
        adminEmail,
        `New Contact Form Submission from ${name}`,
        adminTemplate
      );

      logger.info(`📧 Contact form admin notification sent for message ID: ${contactMessage.id}`);
    } catch (emailError) {
      logger.error(`📧 Failed to send contact form admin notification`, {
        error: emailError.message,
        contactId: contactMessage.id
      });
    }

    return res.status(201).json({
      status: true,
      message: "Your message has been sent successfully. We'll get back to you soon!",
      data: {
        id: contactMessage.id,
        name,
        email,
        subject,
        emailStatus: "sent"
      }
    });

  } catch (error) {
    // Only rollback if transaction hasn't been committed
    if (!transaction.finished) {
      await transaction.rollback();
    }
    logger.error("Error creating contact message:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
      data: []
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
// await db.sequelize.sync();
const PORT = 3008;
app.listen(process.env.PORT_COMMON, '0.0.0.0', () => {
  console.log(`Common Service running on port ${process.env.PORT_COMMON}`);
});

export default app;