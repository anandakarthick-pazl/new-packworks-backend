import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const DropdownName = db.DropdownName;
const DropdownValue = db.DropdownValue;

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
      // Check for existing dropdown name with the same name in the company
      const existingDropdownName = await DropdownName.findOne({
        where: {
          company_id: req.userCompanyId,
          dropdown_name: dropdownDetails.dropdown_name,
          status: "active", // Only check against active records
        },
      });

      // If a dropdown name already exists, return an error
      if (existingDropdownName) {
        return res.status(409).json({
          message: "A dropdown name with this name already exists",
          error: "Existing dropdown name",
        });
      }

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

v1Router.get(
  "/dropdown-name",
  authenticateJWT,
  extractUserDetails,
  async (req, res) => {
    try {
      const { dropdown_name } = req.query;

      // Build filter conditions
      const where = {
        company_id: req.userCompanyId,
        status: "active", // Default to active status
      };

      // Case-insensitive partial name search
      if (dropdown_name) {
        where.dropdown_name = sequelize.where(
          sequelize.fn("LOWER", sequelize.col("dropdown_name")),
          {
            [Op.like]: `%${dropdown_name.toLowerCase()}%`,
          }
        );
      }

      // Fetch data from database
      const dropdownNames = await DropdownName.findAll({
        where,
        order: [["created_at", "DESC"]],
        attributes: ["id", "dropdown_name", "status"], // Optional: Select specific fields
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
        status: dropdownDetails.status || dropdownName.status,
        updated_by: req.userId,
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
        updated_at: req.userId,
      });

      res.json({
        message: "Dropdown Name successfully marked as inactive",
        data: dropdownName.get({ plain: true }),
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
        updated_at: req.userId,
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
        updated_at: req.userId,
      });

      res.json({
        message: "Dropdown Value successfully marked as inactive",
        data: dropdownValue.get({ plain: true }),
      });
    } catch (error) {
      logger.error("Error soft deleting dropdown value:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);

v1Router.get(
  "/dropdown-value/:dropdown_id?", // Optional dropdown_id parameter
  authenticateJWT,
  extractUserDetails,
  async (req, res) => {
    try {
      const { dropdown_id } = req.params;
      const { dropdown_value } = req.query;

      // Build filter conditions
      const where = {
        company_id: req.userCompanyId,
        status: "active", // Default to active status
      };

      // Add dropdown_id filter from URL params if provided
      if (dropdown_id) where.dropdown_id = dropdown_id;

      // Case-insensitive partial value search
      if (dropdown_value) {
        where.dropdown_value = sequelize.where(
          sequelize.fn("LOWER", sequelize.col("dropdown_value")),
          {
            [Op.like]: `%${dropdown_value.toLowerCase()}%`,
          }
        );
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
        attributes: ["id", "dropdown_id", "dropdown_value", "status"], // Optional: Select specific fields
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
