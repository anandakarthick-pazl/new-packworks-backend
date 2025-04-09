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
const Currency=db.Currency;
const Flute=db.Flute;
const ModuleSettings=db.ModuleSettings;
const Module = db.Module;
const Company = db.Company;
const Die=db.Die;



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


/**
 * @swagger
 * /common-service/dropdown-name:
 *   post:
 *     summary: Create a new dropdown name
 *     tags:
 *       - Dropdown
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dropdown_name
 *             properties:
 *               client_id:
 *                 type: integer
 *                 example: 1
 *               dropdown_name:
 *                 type: string
 *                 example: "Example Dropdown"
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: "active"
 *     responses:
 *       201:
 *         description: Dropdown Name created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dropdown Name created successfully
 *                 data:
 *                   $ref: '#/components/schemas/DropdownName'
 *       400:
 *         description: Missing required fields or invalid input
 *       500:
 *         description: Internal server error
 */

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


/**
 * @swagger
 * /common-service/dropdown-name/{id}:
 *   put:
 *     summary: Update an existing dropdown name
 *     tags:
 *       - Dropdown
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID of the dropdown name to update
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               client_id:
 *                 type: integer
 *                 example: 2
 *               dropdown_name:
 *                 type: string
 *                 example: "Updated Dropdown Name"
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: "active"
 *     responses:
 *       200:
 *         description: Dropdown Name updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dropdown Name updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/DropdownName'
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Dropdown name not found
 *       500:
 *         description: Internal server error
 */

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
        updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
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
/**
 * @swagger
 * /common-service/dropdown-name/{id}:
 *   delete:
 *     summary: Soft delete a dropdown name
 *     description: Marks a dropdown name as inactive instead of deleting it from the database.
 *     tags:
 *       - Dropdowns
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the dropdown name
 *         schema:
 *           type: integer
 *           example: 7
 *     responses:
 *       200:
 *         description: Dropdown name successfully marked as inactive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dropdown Name successfully marked as inactive
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 7
 *                     name:
 *                       type: string
 *                       example: Sample Dropdown
 *                     status:
 *                       type: string
 *                       example: inactive
 *                     updated_by:
 *                       type: integer
 *                       example: 1
 *       404:
 *         description: Dropdown name not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dropdown name not found
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal Server Error
 *                 error:
 *                   type: string
 *                   example: Unexpected error
 */

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



/**
 * @swagger
 * /common-service/dropdown-value:
 *   post:
 *     summary: Create a new dropdown value
 *     tags:
 *       - Dropdown
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dropdown_id
 *               - dropdown_value
 *             properties:
 *               client_id:
 *                 type: integer
 *                 example: 1
 *               dropdown_id:
 *                 type: integer
 *                 example: 10
 *               dropdown_value:
 *                 type: string
 *                 example: "Option A"
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: "active"
 *     responses:
 *       201:
 *         description: Dropdown Value created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dropdown Value created successfully
 *                 data:
 *                   $ref: '#/components/schemas/DropdownValue'
 *       400:
 *         description: Missing required fields or invalid input data
 *       404:
 *         description: Dropdown name not found
 *       500:
 *         description: Internal Server Error
 */

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


/**
 * @swagger
 * /common-service/dropdown-value/{id}:
 *   put:
 *     summary: Update an existing dropdown value
 *     tags:
 *       - Dropdown
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the dropdown value to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               client_id:
 *                 type: integer
 *                 example: 1
 *               dropdown_id:
 *                 type: integer
 *                 example: 10
 *               dropdown_value:
 *                 type: string
 *                 example: "Updated Option"
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: "active"
 *     responses:
 *       200:
 *         description: Dropdown Value updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dropdown Value updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/DropdownValue'
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Dropdown value or dropdown name not found
 *       500:
 *         description: Internal Server Error
 */

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
        updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
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


/**
 * @swagger
 * /common-service/dropdown-value/{id}:
 *   delete:
 *     summary: Soft delete a dropdown value (mark as inactive)
 *     tags:
 *       - Dropdown
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the dropdown value to delete
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Dropdown Value successfully marked as inactive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dropdown Value successfully marked as inactive
 *                 data:
 *                   $ref: '#/components/schemas/DropdownValue'
 *       404:
 *         description: Dropdown value not found
 *       500:
 *         description: Internal Server Error
 */

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



// GET dropdown names with search options
/**
 * @swagger
 * /common-service/dropdown-name:
 *   get:
 *     summary: Get dropdown names
 *     description: Retrieve dropdown names filtered by name, client, and status. Defaults to active records only unless `status=all` is specified.
 *     tags:
 *       - Dropdowns
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dropdown_name
 *         schema:
 *           type: string
 *         description: Filter by dropdown name (partial match)
 *         example: machine_type
 *       - in: query
 *         name: client_id
 *         schema:
 *           type: integer
 *         description: Filter by client ID
 *         example: 2
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, all]
 *         description: Filter by status. Use "all" to retrieve both active and inactive records.
 *         example: active
 *     responses:
 *       200:
 *         description: List of dropdown names
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   dropdown_name:
 *                     type: string
 *                     example: machine_type
 *                   client_id:
 *                     type: integer
 *                     example: 2
 *                   company_id:
 *                     type: integer
 *                     example: 5
 *                   status:
 *                     type: string
 *                     example: active
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     example: 2024-04-08T12:34:56.000Z
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal Server Error
 *                 error:
 *                   type: string
 *                   example: Unexpected error
 */

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




/**
 * @swagger
 * /common-service/dropdown-value:
 *   get:
 *     summary: Get all dropdown values with optional filters
 *     tags:
 *       - Dropdown
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dropdown_id
 *         schema:
 *           type: integer
 *         description: Filter by dropdown ID
 *       - in: query
 *         name: dropdown_value
 *         schema:
 *           type: string
 *         description: Filter by dropdown value (partial match)
 *       - in: query
 *         name: client_id
 *         schema:
 *           type: integer
 *         description: Filter by client ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, all]
 *           default: active
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of dropdown values
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DropdownValue'
 *       500:
 *         description: Internal Server Error
 */

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


/**
 * @swagger
 * /common-service/countries:
 *   get:
 *     summary: Get list of countries
 *     description: Retrieve a list of all countries with basic information like ISO codes and phone code.
 *     tags:
 *       - Location
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched country list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       iso:
 *                         type: string
 *                         example: "US"
 *                       name:
 *                         type: string
 *                         example: "United States"
 *                       nicename:
 *                         type: string
 *                         example: "United States of America"
 *                       iso3:
 *                         type: string
 *                         example: "USA"
 *                       numcode:
 *                         type: integer
 *                         example: 840
 *                       phonecode:
 *                         type: integer
 *                         example: 1
 *       500:
 *         description: Server error while fetching countries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Error fetching countries
 *                 error:
 *                   type: string
 *                   example: Unexpected error message
 */

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


/**
 * @swagger
 * /common-service/currency:
 *   get:
 *     summary: Get all active currencies
 *     tags:
 *       - Currency
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Currencies fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Currencies fetched Successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       company_id:
 *                         type: integer
 *                         example: 101
 *                       currency_name:
 *                         type: string
 *                         example: US Dollar
 *                       currency_symbol:
 *                         type: string
 *                         example: $
 *                       currency_code:
 *                         type: string
 *                         example: USD
 *                       status:
 *                         type: string
 *                         example: active
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Something went wrong
 */

// Get Currency
v1Router.get("/currency",authenticateJWT, async (req, res) => {
  try {
  const currency = await Currency.findAll({where: { status: "active" },attributes:["id","company_id","currency_name","currency_symbol","currency_code","status"]});
  return res.status(200).json({
      success: true,
      message:"Currencies fetched Successfully",
      data: currency,
  });
  } catch (error) {
  console.error("Error fetching departments:", error);
  return res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * @swagger
 * /common-service/module-setting:
 *   get:
 *     summary: Get active admin module settings grouped by module name
 *     tags:
 *       - Modules
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Module settings fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Module Fetched Successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       company_id:
 *                         type: integer
 *                         example: 101
 *                       module_name:
 *                         type: string
 *                         example: Reports
 *                       status:
 *                         type: string
 *                         example: active
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Something went wrong
 */

// Get ModuleSettings
v1Router.get("/module-setting",authenticateJWT, async (req, res) => {
  try {
  const settings = await ModuleSettings.findAll({where: { status: "active",type: "admin" },attributes:["id","company_id","module_name","status"],group: ["module_name"],order: [["id", "ASC"]],});

  return res.status(200).json({
      success: true,
      message:"Module Fetched Successfully",
      data: settings,
  });
  } catch (error) {
  console.error("Error fetching Module Settings:", error);
  return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /common-service/module:
 *   get:
 *     summary: Get active modules for non-superadmin users (excluding "dashboards")
 *     tags:
 *       - Modules
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Modules fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Module Fetched Successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       module_name:
 *                         type: string
 *                         example: Users
 *                       description:
 *                         type: string
 *                         example: Manage users and permissions
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Something went wrong
 */

// Get Module
v1Router.get("/module",authenticateJWT, async (req, res) => {
  try {
  const module = await Module.findAll({where: { status: "active",is_superadmin: 0 ,module_name: { [Op.ne]: "dashboards" }},attributes:["id","module_name","description"]});

  return res.status(200).json({
      success: true,
      message:"Module Fetched Successfully",
      data: module,
  });
  } catch (error) {
  console.error("Error fetching Module:", error);
  return res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * @swagger
 * /common-service/flute:
 *   get:
 *     summary: Get a paginated list of active flutes with optional search
 *     tags:
 *       - Flute
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search keyword for flute name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of flutes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Flutes Fetched Successfully
 *                 total:
 *                   type: integer
 *                   example: 25
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: Silver Flute
 *                       status:
 *                         type: string
 *                         example: active
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Server error while fetching flutes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */

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
        const flutes = await Flute.findAll({where: whereCondition, limit: limitNumber, offset });
        const formattedFlutes = flutes.map(flt => ({
          ...flt.toJSON(), 
        }));
        return res.status(200).json({
          success: true,
          message:"Flutes Fetched Successfully",
          total: totalflutes, 
          page, 
          totalPages: Math.ceil(totalflutes / limit), 
          data:formattedFlutes
        }); 
      } catch (error) {
        console.error("Error fetching flutes:", error);
        return res.status(500).json({ success: false, error: error.message });
      }
    });





   /**
 * @swagger
 * /common-service/flute/create:
 *   post:
 *     summary: Create a new flute entry
 *     tags:
 *       - Flute
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - flute_height
 *               - number_of_flutes_per_meter
 *               - take_up_factor
 *               - glue_consumption
 *             properties:
 *               name:
 *                 type: string
 *                 example: Golden Flute
 *               flute_height:
 *                 type: string
 *                 example: 4.8
 *               number_of_flutes_per_meter:
 *                 type: string
 *                 example: 110
 *               take_up_factor:
 *                 type: string
 *                 example: "1.50 - 1.55"
 *               glue_consumption:
 *                 type: string
 *                 example: "4.5 - 5.0"
 *     responses:
 *       201:
 *         description: Flute created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Flute created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: Golden Flute
 *                     status:
 *                       type: string
 *                       example: active
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Server error while creating flute
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */


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


/**
 * @swagger
 * /common-service/flute/edit/{fluteId}:
 *   get:
 *     summary: Get details of a single flute by ID
 *     tags:
 *       - Flute
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fluteId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the flute to fetch
 *     responses:
 *       200:
 *         description: Flute fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: Silver Flute
 *                     description:
 *                       type: string
 *                       example: High-quality flute
 *                     status:
 *                       type: string
 *                       example: active
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid flute ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid flute ID
 *       404:
 *         description: Flute not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Flute not found
 *                 data:
 *                   type: object
 *                   example: {}
 *       500:
 *         description: Server error while fetching flute
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */

  // Get id based flute
  v1Router.get("/flute/edit/:fluteId", authenticateJWT, async (req, res) => {
    try {
      const fluteId = parseInt(req.params.fluteId);
  
      if (isNaN(fluteId)) {
        return res.status(400).json({ success: false, message: "Invalid flute ID" });
      }
  
      const flute = await Flute.findOne({ where: { id: fluteId } });
  
      if (!flute) {
        return res.status(404).json({ success: false, message: "Flute not found", data: {} });
      }
  
      return res.status(200).json({
        success: true,
        data: {
          ...flute.toJSON(),
        }
      });
    } catch (error) {
      console.error("Error fetching flute:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });






/**
 * @swagger
 * /common-service/flute/update/{id}:
 *   put:
 *     summary: Update flute details
 *     description: Update an existing flute's information by its ID.
 *     tags:
 *       - Flute
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID of the flute to update
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - flute_height
 *               - number_of_flutes_per_meter
 *               - take_up_factor
 *               - glue_consumption
 *             properties:
 *               name:
 *                 type: string
 *                 example: Golden Flute
 *               flute_height:
 *                 type: string
 *                 example: 4.8
 *               number_of_flutes_per_meter:
 *                 type: string
 *                 example: 110
 *               take_up_factor:
 *                 type: string
 *                 example: "1.50 - 1.55"
 *               glue_consumption:
 *                 type: string
 *                 example: "4.5 - 5.0"
 *     responses:
 *       200:
 *         description: Flute updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Flute updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     flute_name:
 *                       type: string
 *                       example: "Flute X200"
 *                     description:
 *                       type: string
 *                       example: "Updated description"
 *                     status:
 *                       type: string
 *                       example: active
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-01T12:00:00.000Z"
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-04-08T12:00:00.000Z"
 *                     updated_by:
 *                       type: integer
 *                       example: 10
 *       404:
 *         description: Flute not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Flute not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Error message from server
 */

  //update flute
  v1Router.put("/flute/update/:id", authenticateJWT, async (req,res) => {
    const transaction = await sequelize.transaction();
    try{
      const fulteId=req.params.id;
      const userId=req.user.id;
      const { ...rest} = req.body;

    const existingFlute=await Flute.findByPk(fulteId,{transaction});
    if(!existingFlute){
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "Flute not found" });
    }      

      rest.updated_by=userId;

      rest.created_at = existingFlute.created_at;  

      rest.updated_at = new Date();

      rest.company_id = req.user.company_id;

      await Flute.update( rest,{ where: { id: fulteId }, transaction });

      const updatedFlute = await Flute.findByPk(fulteId, { transaction });

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Flute updated successfully",
        data: {
          ...updatedFlute.toJSON(),
        },
      });

    }catch(error){
      await transaction.rollback();
      console.error("Error updating Flute:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

/**
 * @swagger
 * /common-service/flute/delete/{id}:
 *   delete:
 *     summary: Soft delete a flute by setting its status to 'inactive'
 *     tags:
 *       - Flute
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the flute to be deleted
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Flute deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Flute deleted successfully
 *                 data:
 *                   type: array
 *                   example: []
 *       404:
 *         description: Flute not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Flutes not found
 *       500:
 *         description: Server error while deleting flute
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */


  // Delete Flute
    v1Router.delete("/flute/delete/:id", authenticateJWT, async (req,res) =>{
          const transaction = await sequelize.transaction(); 
          try{
            const fluteId = req.params.id;
            const userId = req.user.id;

            const Flutes = await Flute.findOne({ where:{ id: fluteId } });
            
                  if (!Flutes) {
                    return res.status(404).json({
                      success: false,
                      message: "Flutes not found",
                    });
                  }

                  await Flute.update(
                    {
                    status: 'inactive',
                    updated_at: new Date(),
                    updated_by: userId
                  },
                  { where: { id: fluteId }, transaction }
                );

                  await transaction.commit();

                  return res.status(200).json({
                    status: true,
                    message: "Flute deleted successfully",
                    data: [],
                  });      


          }catch(error){
            await transaction.rollback();
            console.error("Error Deleted Packages:", error);
            return res.status(500).json({ success: false, error: error.message });
          }
    });


//get die
/**
 * @swagger
 * /common-service/die:
 *   get:
 *     summary: Get list of dies with pagination and search
 *     tags:
 *       - Die
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search dies by name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of dies fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Die Fetched Successfully
 *                 total:
 *                   type: integer
 *                   example: 25
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: Die A
 *                       status:
 *                         type: string
 *                         example: active
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */

    v1Router.get("/die",authenticateJWT,async(req,res)=>{
      try{
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
          const die = await Die.findAll({where: whereCondition, limit: limitNumber, offset });
          const dieFlutes = die.map(diemap => ({
            ...diemap.toJSON(), 
          }));
        return res.status(200).json({
          success: true,
          message:"Die Fetched Successfully",
          total: totalDie, 
          page, 
          totalPages: Math.ceil(totalDie / limit), 
          data:dieFlutes
        });
      }catch(error){
        console.error("server error : ",error);
        
      }
    })

/**
 * @swagger
 * /common-service/die/create:
 *   post:
 *     summary: Create a new Die entry
 *     tags:
 *       - Die
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               die_id:
 *                 type: string
 *                 example: Die123
 *               name:
 *                 type: string
 *                 example: Die A
 *               client:
 *                 type: string
 *                 example: ABC
 *               board_size:
 *                 type: string
 *                 example: 25x35cm
 *               ups:
 *                 type: string
 *                 example: 4
 *     responses:
 *       201:
 *         description: Die created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Die created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     die_id:
 *                       type: string
 *                       example: Die123
 *                     name:
 *                       type: string
 *                       example: Die A
 *                     client:
 *                       type: string
 *                       example: ABC
 *                     board_size:
 *                       type: string
 *                       example: 25x35cm
 *                     ups:
 *                       type: string
 *                       example: 4
 *                     status:
 *                       type: string
 *                       example: active
 *                     company_id:
 *                       type: integer
 *                       example: 101
 *                     created_by:
 *                       type: integer
 *                       example: 5
 *                     updated_by:
 *                       type: integer
 *                       example: 5
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Server error while creating die
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */


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
/**
 * @swagger
 * /common-service/die/edit/{id}:
 *   get:
 *     summary: Get Die details by ID
 *     tags:
 *       - Die
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the Die to retrieve
 *     responses:
 *       200:
 *         description: Die fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     die_id:
 *                       type: string
 *                       example: Die123
 *                     name:
 *                       type: string
 *                       example: Die A
 *                     client:
 *                       type: string
 *                       example: ABC
 *                     board_size:
 *                       type: string
 *                       example: 25x35cm
 *                     ups:
 *                       type: string
 *                       example: 4
 *                     status:
 *                       type: string
 *                       example: active
 *                     company_id:
 *                       type: integer
 *                       example: 101
 *                     created_by:
 *                       type: integer
 *                       example: 5
 *                     updated_by:
 *                       type: integer
 *                       example: 5
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: Die Fetched Successfully
 *       400:
 *         description: Invalid Die ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Die id is required
 *       404:
 *         description: Die not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Die not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

v1Router.get("/die/edit/:id",authenticateJWT,async (req,res)=>{
  try{
    const dieId = parseInt(req.params.id);
    if(isNaN(dieId)){
      return res.status(400).json({
        success:false,
        message:"Die id is required" 
      });
    }

    const die = await Die.findOne({where:{id:dieId}});

    if(!die){
      return res.status(404).json({
       success:false,
        message:"Die not found"
      })
    }

    return res.status(200).json({
      sucess:true,
      data:{...die.toJSON()},
      message: "Die Fetched Successfully"
    })

  }catch(error){
    console.error("Die get a id based details error :",error.message);
    return res.status(500).json({
      success:false,
      message:error.message
    })
    
  }
})


//update die
/**
 * @swagger
 * /common-service/die/update/{id}:
 *   put:
 *     summary: Update Die details by ID
 *     tags:
 *       - Die
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the Die to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               die_id:
 *                 type: string
 *                 example: Die123
 *               name:
 *                 type: string
 *                 example: Die B
 *               client:
 *                 type: string
 *                 example: XYZ
 *               board_size:
 *                 type: string
 *                 example: 30x40cm
 *               ups:
 *                 type: string
 *                 example: 5
 *     responses:
 *       200:
 *         description: Die updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Die updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     die_id:
 *                       type: string
 *                       example: Die123
 *                     name:
 *                       type: string
 *                       example: Die B
 *                     client:
 *                       type: string
 *                       example: XYZ
 *                     board_size:
 *                       type: string
 *                       example: 30x40cm
 *                     ups:
 *                       type: string
 *                       example: 5
 *                     status:
 *                       type: string
 *                       example: active
 *                     company_id:
 *                       type: integer
 *                       example: 101
 *                     created_by:
 *                       type: integer
 *                       example: 5
 *                     updated_by:
 *                       type: integer
 *                       example: 6
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid Die ID or Bad Request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Die ID or request body is invalid
 *       404:
 *         description: Die not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Die not found
 *       500:
 *         description: Server error while updating die
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */

  v1Router.put("/die/update/:id", authenticateJWT, async (req,res) => {
    const transaction = await sequelize.transaction();
    try{
      const dieId=req.params.id;
      const userId=req.user.id;
      const { ...rest} = req.body;

    const existingDie=await Die.findByPk(dieId,{transaction});
    if(!existingDie){
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "Die not found" });
    }      

      rest.updated_by=userId;

      rest.updated_at = new Date();

      rest.company_id = req.user.company_id;

      await Die.update( rest,{ where: { id: dieId }, transaction });

      const updatedDie = await Die.findByPk(dieId, { transaction });

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Die updated successfully",
        data: {
          ...updatedDie.toJSON(),
        },
      });

    }catch(error){
      await transaction.rollback();
      console.error("Error updating Die:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });   
  
//delete die
/**
 * @swagger
 * /common-service/die/delete/{id}:
 *   delete:
 *     summary: Soft delete a Die by ID
 *     tags:
 *       - Die
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the Die to delete
 *     responses:
 *       200:
 *         description: Die deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Die Deleted Successfully
 *                 data:
 *                   type: array
 *                   items: {}
 *                   example: []
 *       404:
 *         description: Die not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Die not found
 *       500:
 *         description: Server error while deleting die
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Die delete error
 */

v1Router.delete("/die/delete/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const dieId = req.params.id;
    const userId = req.user.id;

    const die = await Die.findByPk(dieId, { transaction });

    if (!die) {
      return res.status(404).json({
        success: false,
        message: "Die not found"
      });
    }

    await Die.update(
      {
        updated_by: userId,
        updated_at: new Date(),
        status: "inactive"
      },
      { where: { id: dieId }, transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Die Deleted Successfully",
      data: []
    });

  } catch (error) {
    await transaction.rollback(); // Important: rollback on error
    console.error("Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Die delete error"
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
