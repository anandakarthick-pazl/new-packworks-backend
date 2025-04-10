import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import {
  publishToQueue,
  rabbitChannel,
  closeRabbitMQConnection,
} from "../../common/helper/rabbitmq.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import ExcelJS from "exceljs";
import { Readable } from "stream";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const Sku = db.Sku;
const SkuVersion = db.SkuVersion;
const User = db.User;
const SkuType = db.SkuType;
const Client = db.Client;

// 🔹 Create a SKU (POST)
/**
 * @swagger
 * /sku-details:
 *   post:
 *     summary: Create a new SKU
 *     description: Creates a new SKU entry for the authenticated user's company and publishes the event to a queue.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SkuInput'
 *     responses:
 *       201:
 *         description: SKU created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU created successfully
 *                 sku:
 *                   $ref: '#/components/schemas/Sku'
 *       500:
 *         description: Error creating SKU
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error creating SKU
 *                 error:
 *                   type: string
 *                   example: Detailed error message
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SkuInput:
 *       type: object
 *       required:
 *         - client_id
 *         - sku_name
 *         - client
 *         - ply
 *         - composite_type
 *       properties:
 *         client_id:
 *           type: integer
 *           example: 1
 *         sku_name:
 *           type: string
 *           example: 3-Ply Brown Carton
 *         client:
 *           type: string
 *           example: TATA Inc.
 *         ply:
 *           type: integer
 *           example: 3
 *         length:
 *           type: number
 *           example: 45.5
 *         width:
 *           type: number
 *           example: 30.0
 *         height:
 *           type: number
 *           example: 25.0
 *         unit:
 *           type: string
 *           example: cm
 *         joints:
 *           type: integer
 *           example: 2
 *         ups:
 *           type: integer
 *           example: 4
 *         select_dies:
 *           type: string
 *           example: D1,D2
 *         inner_outer_dimension:
 *           type: string
 *           enum: [Inner, Outer]
 *           example: Outer
 *         flap_width:
 *           type: number
 *           example: 1.5
 *         flap_tolerance:
 *           type: number
 *           example: 0.2
 *         length_trimming_tolerance:
 *           type: number
 *           example: 0.3
 *         width_trimming_tolerance:
 *           type: number
 *           example: 0.3
 *         strict_adherence:
 *           type: boolean
 *           example: false
 *         customer_reference:
 *           type: string
 *           example: REF-CUST-001
 *         reference_number:
 *           type: string
 *           example: REF123456
 *         internal_id:
 *           type: string
 *           example: INT-SKU-789
 *         length_board_size_cm2:
 *           type: string
 *           example: 1200
 *         width_board_size_cm2:
 *           type: string
 *           example: 800
 *         board_size_cm2:
 *           type: string
 *           example: 960000
 *         deckle_size:
 *           type: number
 *           example: 55.0
 *         minimum_order_level:
 *           type: integer
 *           example: 100
 *         sku_type:
 *           type: string
 *           example: Master Carton
 *         sku_values:
 *           type: object
 *           example: { "gsm": 120, "bf": 22 }
 *         sku_version_limit:
 *           type: integer
 *           example: 3
 *         composite_type:
 *           type: string
 *           enum: [Partition, Panel]
 *           example: Partition
 *         part_count:
 *           type: integer
 *           example: 3
 *         part_value:
 *           type: object
 *           example: { "parts": [{ "part": "A", "length": 10 }, { "part": "B", "length": 20 }] }

 *     Sku:
 *       allOf:
 *         - $ref: '#/components/schemas/SkuInput'
 *         - type: object
 *           properties:
 *             id:
 *               type: integer
 *               example: 101
 *             status:
 *               type: string
 *               example: active
 *             created_by:
 *               type: integer
 *               example: 5
 *             updated_by:
 *               type: integer
 *               example: 5
 *             created_at:
 *               type: string
 *               format: date-time
 *             updated_at:
 *               type: string
 *               format: date-time
 */


v1Router.post("/sku-details", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Add created_by and updated_by from the authenticated user
    const skuData = {
      ...req.body,
      company_id: req.user.company_id,
      created_by: req.user.id,
      // updated_by: req.user.id,
      status: "active",
    };

    const newSku = await Sku.create(skuData, { transaction: t });
    await t.commit();
    await publishToQueue({
      operation: "CREATE",
      skuId: newSku.id,
      timestamp: new Date(),
      data: newSku,
    });
    res.status(201).json({ message: "SKU created successfully", sku: newSku });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error creating SKU", error: error.message });
  }
});


/**
 * @swagger
 * /sku-details:
 *   get:
 *     summary: Get SKU details with search, filters, pagination, and dashboard insights
 *     description: Fetches SKU list with optional filters (name, client, ply, type, status) and search. Returns paginated results and dashboard stats by SKU type.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Current page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: General search query across sku_name, client, ply, and sku_type
 *       - in: query
 *         name: sku_name
 *         schema:
 *           type: string
 *         description: Filter by SKU name
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *         description: Filter by client name
 *       - in: query
 *         name: ply
 *         schema:
 *           type: string
 *         description: Filter by ply type
 *       - in: query
 *         name: sku_type
 *         schema:
 *           type: string
 *         description: Filter by SKU type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           default: active
 *         description: Filter by SKU status
 *     responses:
 *       200:
 *         description: SKU list with pagination and dashboard counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Sku'
 *                 dashboard:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *                   example:
 *                     rscBox: 10
 *                     board: 15
 *                     dieCutBox: 5
 *                     composite: 2
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *                       example: 42
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       example: 10
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPrevPage:
 *                       type: boolean
 *                       example: false
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

v1Router.get("/sku-details", authenticateJWT, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sku_name,
      client,
      ply,
      sku_type,
      status = "active",
    } = req.query;

    const offset = (page - 1) * limit;

    // Build the where condition for search
    let whereCondition = {
      status: status,
    };

    // Handle specific field searches if provided
    if (sku_name) whereCondition.sku_name = { [Op.like]: `%${sku_name}%` };
    if (ply) whereCondition.ply = { [Op.like]: `%${ply}%` };

    if (client) whereCondition.client = { [Op.like]: `%${client}%` };
    if (sku_type) whereCondition.sku_type = { [Op.like]: `%${sku_type}%` };

    // Apply filters for client and sku_type if provided
    if (client) whereCondition.client = client;
    if (sku_type) whereCondition.sku_type = sku_type;

    // Handle generic search across multiple fields if no specific fields are provided
    if (search) {
      whereCondition = {
        [Op.and]: [
          { status: status },
          {
            [Op.or]: [
              { sku_name: { [Op.like]: `%${search}%` } },
              { client: { [Op.like]: `%${search}%` } },
              { ply: { [Op.like]: `%${ply}%` } },
              { sku_type: { [Op.like]: `%${search}%` } },
            ],
          },
        ],
      };
    }

    // Get total count for pagination metadata
    const totalCount = await Sku.count({ where: whereCondition });

    // Fetch skus with pagination and search
    const skus = await Sku.findAll({
      where: whereCondition,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: db.User,
          as: "sku_creator",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: db.User,
          as: "sku_updater",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    // Calculate dashboard values dynamically
    const skuTypeCounts = await Sku.findAll({
      attributes: [
        "sku_type",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: { status: "active" },
      group: ["sku_type"],
      raw: true,
    });

    // Create a dashboard object with dynamic SKU type counts
    const dashboard = skuTypeCounts.reduce((acc, item) => {
      // Convert SKU type to lowercase first
      const skuTypeLowerCase = item.sku_type.toLowerCase();

      // Map SKU type to a more readable key if needed (with lowercase keys)
      const keyMap = {
        "RSC box": "rscBox",
        Board: "board",
        "Die Cut box": "dieCutBox",
        Composite: "composite",
        "Custom Item": "customItem",
      };

      // Use the mapped key or fallback to a camelCased version of the sku_type
      const key =
        keyMap[skuTypeLowerCase] ||
        skuTypeLowerCase
          .replace(/\s+/g, "")
          .replace(/^./, (char) => char.toLowerCase());

      acc[key] = parseInt(item.count);
      return acc;
    }, {});

    const formattedSkus = skus.map((sku) => ({
      ...sku.toJSON(),
      sku_values: sku.sku_values ? JSON.parse(sku.sku_values) : null,
      part_value: sku.part_value ? JSON.parse(sku.part_value) : null,
      created_at: sku.created_at, // Include created_at timestamp
      updated_at: sku.updated_at, // Include updated_at timestamp
    }));

    const totalPages = Math.ceil(totalCount / limit);

    const responseData = {
      data: formattedSkus,
      dashboard: dashboard,
      pagination: {
        totalCount,
        totalPages,
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    logger.error("Error fetching SKUs:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});
// 🔹 Get SKU by ID (GET)

/**
 * @swagger
 * /sku-details/{id}:
 *   put:
 *     summary: Update an existing SKU
 *     description: Updates allowed fields of an SKU by ID. Validates for duplicates, restricted client change, and parses JSON fields.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the SKU to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               client_id:
 *                 type: integer
 *               sku_name:
 *                 type: string
 *               ply:
 *                 type: string
 *               length:
 *                 type: number
 *               width:
 *                 type: number
 *               height:
 *                 type: number
 *               joints:
 *                 type: string
 *               ups:
 *                 type: string
 *               select_dies:
 *                 type: string
 *               inner_outer_dimension:
 *                 type: string
 *               flap_width:
 *                 type: number
 *               flap_tolerance:
 *                 type: number
 *               length_trimming_tolerance:
 *                 type: number
 *               width_trimming_tolerance:
 *                 type: number
 *               strict_adherence:
 *                 type: boolean
 *               customer_reference:
 *                 type: string
 *               reference_number:
 *                 type: string
 *               internal_id:
 *                 type: string
 *               length_board_size_cm2:
 *                 type: number
 *               width_board_size_cm2:
 *                 type: number
 *               board_size_cm2:
 *                 type: number
 *               deckle_size:
 *                 type: number
 *               minimum_order_level:
 *                 type: number
 *               sku_type:
 *                 type: string
 *               sku_values:
 *                 type: string
 *                 description: JSON string
 *               sku_version_limit:
 *                 type: number
 *               composite_type:
 *                 type: string
 *               part_count:
 *                 type: number
 *               part_value:
 *                 type: string
 *                 description: JSON string
 *     responses:
 *       200:
 *         description: SKU updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU updated successfully.
 *                 updatedData:
 *                   $ref: '#/components/schemas/Sku'
 *       400:
 *         description: Invalid update request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: SKU not found
 *       500:
 *         description: Server error while updating SKU
 */

v1Router.put("/sku-details/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    // Define allowed fields to update
    const allowedFields = [
      "client_id",
      "sku_name",
      "ply",
      "length",
      "width",
      "height",
      "joints",
      "ups",
      "select_dies",
      "inner_outer_dimension",
      "flap_width",
      "flap_tolerance",
      "length_trimming_tolerance",
      "width_trimming_tolerance",
      "strict_adherence",
      "customer_reference",
      "reference_number",
      "internal_id",
      "length_board_size_cm2",
      "width_board_size_cm2",
      "board_size_cm2",
      "deckle_size",
      "minimum_order_level",
      "sku_type",
      "sku_values",
      "sku_version_limit",
      "composite_type",
      "part_count",
      "part_value",
      "estimate_composite_item",
      "description",
      "default_sku_details",
      "tags",
      // "status",
    ];

    // Find the current SKU
    const currentSku = await Sku.findByPk(req.params.id);

    if (!currentSku) {
      await transaction.rollback();
      return res.status(404).json({ message: "SKU not found" });
    }

    // Filter request body to only include allowed fields
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Add updated_by
    updateData.updated_by = req.user.id;
    updateData.updated_at = new Date();

    // Special handling for sku_name
    if (updateData.sku_name) {
      if (
        updateData.sku_name !== currentSku.sku_name &&
        updateData.id !== req.params.id
      ) {
        // Check for duplicate SKU name for the same client, excluding the current SKU
        const existingSku = await Sku.findOne({
          where: {
            sku_name: updateData.sku_name,
            client_id: currentSku.client_id,
            id: { [Op.ne]: req.params.id },
          },
          transaction,
        });
        if (existingSku) {
          await transaction.rollback();
          return res.status(400).json({
            message:
              "SKU name already exists for this client. Please use a different name.",
          });
        }
      }
    }

    // If client_id is provided, ensure it matches the current SKU's client
    if (updateData.client_id && updateData.client_id !== currentSku.client_id) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Cannot change client for an existing SKU.",
      });
    }

    // Check if no valid fields to update
    if (Object.keys(updateData).length <= 1) {
      // 1 is for updated_by
      await transaction.rollback();
      return res.status(400).json({
        message: "No updatable fields provided.",
      });
    }

    // Perform the update
    const [updatedCount] = await Sku.update(updateData, {
      where: { id: req.params.id },
      transaction,
    });

    if (updatedCount === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "SKU not found." });
    }

    // Fetch the updated SKU to return to the client
    const updatedSku = await Sku.findByPk(req.params.id, { transaction });

    // Convert sku_values from string to JSON if needed
    if (updatedSku.sku_values) {
      try {
        updatedSku.sku_values = JSON.parse(updatedSku.sku_values);
      } catch (error) {
        console.error("Error parsing sku_values:", error.message);
        await transaction.rollback();
        return res.status(500).json({
          message: "Error parsing sku_values.",
          error: error.message,
        });
      }
    }

    // Parse part_value JSON if it exists
    if (updatedSku.part_value) {
      try {
        updatedSku.part_value = JSON.parse(updatedSku.part_value);
      } catch (error) {
        console.error("Error parsing part_value:", error.message);
        await transaction.rollback();
        return res.status(500).json({
          message: "Error parsing part_value.",
          error: error.message,
        });
      }
    }

    // Commit the transaction
    await transaction.commit();

    // Publish update to queue (optional)
    await publishToQueue({
      operation: "UPDATE",
      skuId: req.params.id,
      timestamp: new Date(),
      data: updateData,
    });

    return res.status(200).json({
      message: "SKU updated successfully.",
      updatedData: updatedSku,
    });
  } catch (error) {
    console.log(error, "Error in SKU Update");
    // Rollback the transaction on error
    await transaction.rollback();
    return res.status(500).json({
      message: "Error updating SKU.",
      error: error.message,
    });
  }
});

// 🔹 Soft Delete SKU (DELETE) - changes status to inactive

/**
 * @swagger
 * /sku-details/{id}:
 *   delete:
 *     summary: Soft delete an SKU
 *     description: Marks an SKU as inactive instead of permanently deleting it.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the SKU to mark as inactive
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: SKU marked as inactive successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU marked as inactive successfully
 *       404:
 *         description: SKU not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU not found
 *       500:
 *         description: Server error during SKU soft delete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

v1Router.delete("/sku-details/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Update status to inactive instead of deleting
    const updatedSku = await Sku.update(
      {
        status: "inactive",
        updated_at: new Date(),
        updated_by: req.user.id,
      },
      {
        where: { id: req.params.id },
        transaction: t,
      }
    );

    if (!updatedSku[0])
      return res.status(404).json({ message: "SKU not found" });

    await t.commit();
    await publishToQueue({
      operation: "SOFT_DELETE",
      skuId: req.params.id,
      timestamp: new Date(),
      data: { status: "inactive" },
    });
    res.status(200).json({ message: "SKU marked as inactive successfully" });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error deactivating SKU", error: error.message });
  }
});


/**
 * @swagger
 * /sku-details/{id}:
 *   get:
 *     summary: Get SKU details by ID
 *     description: Fetches a specific SKU by its ID, including creator and updater details.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the SKU
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: SKU details fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 sku_name:
 *                   type: string
 *                 sku_values:
 *                   type: object
 *                 part_value:
 *                   type: object
 *                 created_by:
 *                   type: integer
 *                 updated_by:
 *                   type: integer
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                 sku_creator:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                 sku_updater:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *       404:
 *         description: SKU not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU not found
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

v1Router.get("/sku-details/:id", authenticateJWT, async (req, res) => {
  console.log("req.params.id", req.params.id);
  try {
    const sku = await Sku.findByPk(req.params.id, {
      include: [
        {
          model: db.User,
          as: "sku_creator",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: db.User,
          as: "sku_updater",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    if (!sku) {
      return res.status(404).json({ message: "SKU not found" });
    }

    // Parse sku_values if it's stored as a JSON string
    const formattedSku = {
      ...sku.toJSON(),
      sku_values: sku.sku_values ? JSON.parse(sku.sku_values) : null,
      part_value: sku.part_value ? JSON.parse(sku.part_value) : null,
    };

    res.status(200).json(formattedSku);
  } catch (error) {
    logger.error("Error fetching SKU by ID:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /sku-details/download/excel:
 *   get:
 *     summary: Download SKU details as an Excel file
 *     description: Generates and downloads an Excel sheet of SKU details with optional filters.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Text to search across SKU fields
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *           default: active
 *         description: Filter by SKU status
 *       - in: query
 *         name: sku_type
 *         schema:
 *           type: string
 *         description: Filter by SKU type
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *         description: Filter by client
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive SKUs in the export
 *     responses:
 *       200:
 *         description: Excel file downloaded successfully
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Internal Server Error during Excel generation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Error message
 */

v1Router.get(
  "/sku-details/download/excel",
  authenticateJWT,
  async (req, res) => {
    try {
      const {
        search = "",
        status = "active",
        sku_type,
        client,
        includeInactive = false,
      } = req.query;

      // Build the where condition
      const whereCondition = {};

      // Status handling
      if (includeInactive !== "true") {
        whereCondition.status = status;
      }

      // Additional filters
      if (sku_type) whereCondition.sku_type = sku_type;
      if (client) whereCondition.client = client;

      // Search across multiple fields
      if (search) {
        whereCondition[Op.or] = [
          { sku_name: { [Op.like]: `%${search}%` } },
          { client: { [Op.like]: `%${search}%` } },
          { sku_type: { [Op.like]: `%${search}%` } },
          { reference_number: { [Op.like]: `%${search}%` } },
        ];
      }

      // Fetch SKUs with related data
      const { rows: skus } = await Sku.findAndCountAll({
        where: whereCondition,
        include: [
          {
            model: db.User,
            as: "sku_creator",
            attributes: ["id", "name", "email"],
          },
          {
            model: db.User,
            as: "sku_updater",
            attributes: ["id", "name", "email"],
          },
          {
            model: db.Client,
            attributes: [],
          },
        ],
        order: [["id", "ASC"]],
      });

      // Create a new Excel workbook
      const workbook = new ExcelJS.Workbook();
      const skuSheet = workbook.addWorksheet("SKU Details");

      // Define columns with comprehensive SKU details
      skuSheet.columns = [
        { header: "SKU ID", key: "id", width: 10 },
        { header: "SKU Name", key: "sku_name", width: 20 },
        { header: "Client", key: "client", width: 20 },
        { header: "SKU Type", key: "sku_type", width: 15 },
        { header: "Ply", key: "ply", width: 10 },
        { header: "Length (cm)", key: "length", width: 12 },
        { header: "Width (cm)", key: "width", width: 12 },
        { header: "Height (cm)", key: "height", width: 12 },
        { header: "Unit", key: "unit", width: 10 },
        {
          estimate_composite_item: "estimate_composite_item",
          key: "estimate_composite_item",
          width: 20,
        },
        { header: "description", key: "description", width: 20 },
        {
          header: "default_sku_details",
          key: "default_sku_details",
          width: 20,
        },
        { header: "tags", key: "tags", width: 20 },
        { header: "Joints", key: "joints", width: 10 },
        { header: "UPS", key: "ups", width: 10 },
        { header: "select_dies", key: "select_dies", width: 10 },
        { header: "Inner/Outer", key: "inner_outer_dimension", width: 15 },
        { header: "Flap Width", key: "flap_width", width: 12 },
        { header: "Flap Tolerance", key: "flap_tolerance", width: 15 },
        {
          header: "Length Trimming Tolerance",
          key: "length_trimming_tolerance",
          width: 20,
        },
        {
          header: "Width Trimming Tolerance",
          key: "width_trimming_tolerance",
          width: 20,
        },
        { header: "Strict Adherence", key: "strict_adherence", width: 15 },
        { header: "Customer Reference", key: "customer_reference", width: 20 },
        { header: "Reference Number", key: "reference_number", width: 20 },
        { header: "Internal ID", key: "internal_id", width: 15 },
        { header: "Board Size (cm²)", key: "board_size_cm2", width: 15 },
        { header: "Deckle Size", key: "deckle_size", width: 15 },
        {
          header: "Minimum Order Level",
          key: "minimum_order_level",
          width: 20,
        },
        // {
        //   header: "SKU Version Limit",
        //   key: "sku_version_limit",
        //   width: 15,
        // },
        { header: "Status", key: "status", width: 12 },
        { header: "Created By", key: "created_by_name", width: 20 },
        { header: "Created At", key: "created_at", width: 20 },
        { header: "Updated By", key: "updated_by_name", width: 20 },
        { header: "Updated At", key: "updated_at", width: 20 },
      ];

      // Header styling
      const headerStyle = {
        font: { bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "4472C4" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
      };

      // Apply header style
      skuSheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Add data to sheet
      skus.forEach((sku) => {
        let partValueDisplay = "";
        if (sku.part_value) {
          try {
            const partValueObj =
              typeof sku.part_value === "string"
                ? JSON.parse(sku.part_value)
                : sku.part_value;
            partValueDisplay = JSON.stringify(partValueObj);
          } catch (e) {
            partValueDisplay = "Error parsing JSON";
          }
        }
        skuSheet.addRow({
          id: sku.id,
          sku_name: sku.sku_name,
          client: sku.client,
          sku_type: sku.sku_type,
          composite_type: sku.composite_type, // Added
          part_count: sku.part_count, // Added
          part_value: partValueDisplay,
          ply: sku.ply,
          length: sku.length,
          width: sku.width,
          height: sku.height,
          unit: sku.unit,
          estimate_composite_item: sku.estimate_composite_item,
          description: sku.description,
          default_sku_details: sku.default_sku_details,
          tags: sku.tags,
          joints: sku.joints,
          ups: sku.ups,
          select_dies: sku.select_dies,
          inner_outer_dimension: sku.inner_outer_dimension,
          flap_width: sku.flap_width,
          flap_tolerance: sku.flap_tolerance,
          length_trimming_tolerance: sku.length_trimming_tolerance,
          width_trimming_tolerance: sku.width_trimming_tolerance,
          strict_adherence: sku.strict_adherence ? "Yes" : "No",
          customer_reference: sku.customer_reference,
          reference_number: sku.reference_number,
          internal_id: sku.internal_id,
          board_size_cm2: sku.board_size_cm2,
          deckle_size: sku.deckle_size,
          minimum_order_level: sku.minimum_order_level,
          // sku_version_limit: sku.sku_version_limit,
          status: sku.status,
          created_by_name: sku.sku_creator ? sku.sku_creator.name : "N/A",
          created_at: sku.created_at
            ? new Date(sku.created_at).toLocaleString()
            : "N/A",
          updated_by_name: sku.sku_updater ? sku.sku_updater.name : "N/A",
          updated_at: sku.updated_at
            ? new Date(sku.updated_at).toLocaleString()
            : "N/A",
        });
      });

      // Optional: add a second sheet for part values if needed
      if (skus.some((sku) => sku.part_value)) {
        const partsSheet = workbook.addWorksheet("Part Values");

        partsSheet.columns = [
          { header: "SKU ID", key: "id", width: 10 },
          { header: "SKU Name", key: "sku_name", width: 20 },
          { header: "Composite Type", key: "composite_type", width: 15 },
          { header: "Part Count", key: "part_count", width: 12 },
          { header: "Part Values", key: "part_value", width: 50 },
        ];

        // Apply header style
        partsSheet.getRow(1).eachCell((cell) => {
          cell.style = headerStyle;
        });

        // Add data
        skus.forEach((sku) => {
          if (sku.part_value) {
            let partValueDisplay = "";
            try {
              const partValueObj =
                typeof sku.part_value === "string"
                  ? JSON.parse(sku.part_value)
                  : sku.part_value;
              partValueDisplay = JSON.stringify(partValueObj, null, 2);
            } catch (e) {
              partValueDisplay = "Error parsing JSON";
            }

            partsSheet.addRow({
              id: sku.id,
              sku_name: sku.sku_name,
              composite_type: sku.composite_type,
              part_count: sku.part_count,
              part_value: partValueDisplay,
            });
          }
        });

        // Apply alternating row colors
        partsSheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            const fillColor = rowNumber % 2 === 0 ? "F2F2F2" : "FFFFFF";
            row.eachCell((cell) => {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: fillColor },
              };
            });
          }
        });
      }

      // Apply alternating row colors
      skuSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const fillColor = rowNumber % 2 === 0 ? "F2F2F2" : "FFFFFF";
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: fillColor },
            };
          });
        }
      });

      // Create a readable stream for the workbook
      const buffer = await workbook.xlsx.writeBuffer();
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      // Set response headers for file download
      const searchSuffix = search ? `-${search}` : "";
      const skuTypeSuffix = sku_type ? `-${sku_type}` : "";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `sku-details${searchSuffix}${skuTypeSuffix}-${timestamp}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

      // Pipe the stream to response
      stream.pipe(res);

      // Log the download
      logger.info(
        `SKU Excel download initiated by user ${
          req.user.id
        } with filters: ${JSON.stringify({
          search,
          status,
          sku_type,
          client,
        })}`
      );
    } catch (error) {
      logger.error("SKU Excel Download Error:", error);
      return res.status(500).json({ status: false, message: error.message });
    }
  }
);

// sku versions

/**
 * @swagger
 * /sku-details/sku-version:
 *   post:
 *     summary: Create a new SKU version
 *     description: Creates a new version of an existing SKU and saves it in the database.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sku_id
 *             properties:
 *               sku_id:
 *                 type: integer
 *                 description: ID of the existing SKU to version
 *                 example: 101
 *               sku_values:
 *                 type: object
 *                 description: JSON data representing SKU attributes
 *                 example: { length: 50, width: 30, height: 20 }
 *               reference_number:
 *                 type: string
 *                 example: REF-2025-001
 *               comment:
 *                 type: string
 *                 example: "Updated dimensions for better packaging"
 *               additional_fields:
 *                 type: object
 *                 description: Any extra fields specific to SKU versioning
 *     responses:
 *       201:
 *         description: SKU version created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU Version created successfully
 *                 skuVersion:
 *                   $ref: '#/components/schemas/SkuVersion'
 *       404:
 *         description: Referenced SKU not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Referenced SKU not found
 *       500:
 *         description: Error creating SKU version
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error creating SKU Version
 *                 error:
 *                   type: string
 *                   example: Error message
 */

v1Router.post("/sku-details/sku-version", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Check if the referenced SKU exists
    const existingSku = await Sku.findByPk(req.body.sku_id);
    if (!existingSku) {
      await t.rollback();
      return res.status(404).json({ message: "Referenced SKU not found" });
    }

    // Prepare the data for creation with user info
    const skuVersionData = {
      ...req.body,
      company_id: req.user.company_id,
      created_by: req.user.id,
      status: "active",
    };

    // Convert sku_values to string if it's an object or array
    if (
      skuVersionData.sku_values &&
      typeof skuVersionData.sku_values === "object"
    ) {
      skuVersionData.sku_values = JSON.stringify(skuVersionData.sku_values);
    }

    const newSkuVersion = await SkuVersion.create(skuVersionData, {
      transaction: t,
    });
    await t.commit();

    // Publish to queue if needed
    await publishToQueue({
      operation: "CREATE_VERSION",
      skuVersionId: newSkuVersion.id,
      skuId: newSkuVersion.sku_id,
      timestamp: new Date(),
      data: newSkuVersion,
    });

    res.status(201).json({
      message: "SKU Version created successfully",
      skuVersion: newSkuVersion,
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({
      message: "Error creating SKU Version",
      error: error.message,
    });
  }
});

// 🔹 Get SKU Versions (GET)
/**
 * @swagger
 * /sku-details/sku-version/get:
 *   get:
 *     summary: Get SKU Versions
 *     description: Retrieves a paginated list of SKU versions with optional filters for search, SKU ID, client ID, and status.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Number of records per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Keyword to search by SKU version
 *       - in: query
 *         name: sku_id
 *         schema:
 *           type: integer
 *         description: Filter by SKU ID
 *       - in: query
 *         name: client_id
 *         schema:
 *           type: integer
 *         description: Filter by Client ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           default: active
 *         description: Filter by status (e.g., active/inactive)
 *     responses:
 *       200:
 *         description: List of SKU versions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       sku_id:
 *                         type: integer
 *                         example: 101
 *                       client_id:
 *                         type: integer
 *                         example: 202
 *                       sku_values:
 *                         type: object
 *                         example: { "gsm": 120, "bf": 22 }
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                       Sku:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 101
 *                           sku_name:
 *                             type: string
 *                             example: 3-Ply Brown Carton
 *                       Client:
 *                         type: object
 *                         properties:
 *                           client_id:
 *                             type: integer
 *                             example: 202
 *                           company_name:
 *                             type: string
 *                             example: TATA Inc.
 *                       version_creator:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 5
 *                           name:
 *                             type: string
 *                             example: John Doe
 *                       version_updater:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 6
 *                           name:
 *                             type: string
 *                             example: Jane Smith
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *                       example: 25
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       example: 10
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPrevPage:
 *                       type: boolean
 *                       example: false
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
 *                   example: Error details message
 */


v1Router.get(
  "/sku-details/sku-version/get",
  authenticateJWT,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        sku_id,
        client_id,
        status = "active",
      } = req.query;

      const offset = (page - 1) * limit;

      // Build the where condition for search
      let whereCondition = {
        status: status,
      };

      // Apply specific filters if provided
      if (sku_id) whereCondition.sku_id = sku_id;
      if (client_id) whereCondition.client_id = client_id;

      // Handle generic search across multiple fields
      if (search) {
        whereCondition = {
          [Op.and]: [
            { status: status },
            {
              [Op.or]: [
                { sku_version: { [Op.like]: `%${search}%` } },
                // Add other searchable fields as needed
              ],
            },
          ],
        };
      }

      // Get total count for pagination metadata
      const totalCount = await SkuVersion.count({ where: whereCondition });

      // Fetch sku versions with pagination and search
      const skuVersions = await SkuVersion.findAll({
        where: whereCondition,
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [
          {
            model: Sku,
            attributes: ["id", "sku_name"],
            required: false,
          },
          {
            model: Client,
            attributes: ["client_id", "company_name"],
            required: false,
          },
          {
            model: User,
            as: "version_creator",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: User,
            as: "version_updater",
            attributes: ["id", "name"],
            required: false,
          },
        ],
        order: [["created_at", "DESC"]],
      });

      const formattedSkuVersions = skuVersions.map((skuVersion) => ({
        ...skuVersion.toJSON(),
        sku_values: skuVersion.sku_values
          ? JSON.parse(skuVersion.sku_values)
          : null,
        created_at: skuVersion.created_at,
        updated_at: skuVersion.updated_at,
      }));

      const totalPages = Math.ceil(totalCount / limit);

      const responseData = {
        data: formattedSkuVersions,
        pagination: {
          totalCount,
          totalPages,
          currentPage: parseInt(page),
          pageSize: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      };

      res.status(200).json(responseData);
    } catch (error) {
      logger.error("Error fetching SKU Versions:", error);
      res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);

// 🔹 Get SKU Versions by SKU ID (GET)
/**
 * @swagger
 * /sku-details/sku-version/sku/{skuId}:
 *   get:
 *     summary: Get SKU versions by SKU ID
 *     description: Retrieves a paginated list of SKU versions for a specific SKU.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: skuId
 *         in: path
 *         required: true
 *         description: ID of the SKU
 *         schema:
 *           type: integer
 *           example: 101
 *       - name: page
 *         in: query
 *         required: false
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           example: 1
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Number of records per page
 *         schema:
 *           type: integer
 *           example: 10
 *       - name: status
 *         in: query
 *         required: false
 *         description: Filter by status (default is "active")
 *         schema:
 *           type: string
 *           enum: [active, inactive, archived]
 *           example: active
 *     responses:
 *       200:
 *         description: List of SKU versions for the given SKU ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SkuVersion'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *                       example: 5
 *                     totalPages:
 *                       type: integer
 *                       example: 1
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       example: 10
 *                     hasNextPage:
 *                       type: boolean
 *                       example: false
 *                     hasPrevPage:
 *                       type: boolean
 *                       example: false
 *       404:
 *         description: SKU not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU not found
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
 *                   example: Error details
 */

v1Router.get(
  "/sku-details/sku-version/sku/:skuId",
  authenticateJWT,
  async (req, res) => {
    try {
      const { page = 1, limit = 10, status = "active" } = req.query;

      const skuId = req.params.skuId;
      const offset = (page - 1) * limit;

      // Check if the SKU exists
      const existingSku = await Sku.findByPk(skuId);
      if (!existingSku) {
        return res.status(404).json({ message: "SKU not found" });
      }

      // Get total count for pagination metadata
      const totalCount = await SkuVersion.count({
        where: {
          sku_id: skuId,
          status: status,
        },
      });

      // Fetch all versions for a specific SKU
      const skuVersions = await SkuVersion.findAll({
        where: {
          sku_id: skuId,
          status: status,
        },
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [
          {
            model: User,
            as: "version_creator",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: User,
            as: "version_updater",
            attributes: ["id", "name"],
            required: false,
          },
        ],
        order: [["created_at", "DESC"]],
      });

      const formattedSkuVersions = skuVersions.map((skuVersion) => ({
        ...skuVersion.toJSON(),
        sku_values: skuVersion.sku_values
          ? JSON.parse(skuVersion.sku_values)
          : null,
        created_at: skuVersion.created_at,
        updated_at: skuVersion.updated_at,
      }));

      const totalPages = Math.ceil(totalCount / limit);

      const responseData = {
        data: formattedSkuVersions,
        pagination: {
          totalCount,
          totalPages,
          currentPage: parseInt(page),
          pageSize: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      };

      res.status(200).json(responseData);
    } catch (error) {
      logger.error("Error fetching SKU Versions:", error);
      res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);

// 🔹 Get SKU Version by ID (GET)
// v1Router.get(
//   "/sku-details/sku-version/:id",
//   authenticateJWT,
//   async (req, res) => {
//     try {
//       const skuVersion = await SkuVersion.findByPk(req.params.id, {
//         include: [
//           {
//             model: Sku,
//             attributes: ["id", "sku_name"],
//             required: false,
//           },
//           {
//             model: Client,
//             attributes: ["client_id", "client_name"],
//             required: false,
//           },
//           {
//             model: User,
//             as: "version_creator",
//             attributes: ["id", "name"],
//             required: false,
//           },
//           {
//             model: User,
//             as: "version_updater",
//             attributes: ["id", "name"],
//             required: false,
//           },
//         ],
//       });

//       if (!skuVersion) {
//         return res.status(404).json({ message: "SKU Version not found" });
//       }

//       // Format the response data
//       const formattedSkuVersion = {
//         ...skuVersion.toJSON(),
//         sku_values: skuVersion.sku_values
//           ? JSON.parse(skuVersion.sku_values)
//           : null,
//       };

//       res.status(200).json(formattedSkuVersion);
//     } catch (error) {
//       logger.error("Error fetching SKU Version:", error);
//       res.status(500).json({
//         message: "Internal Server Error",
//         error: error.message,
//       });
//     }
//   }
// );

// 🔹 Soft Delete SKU Version (DELETE) - changes status to inactive
/**
 * @swagger
 * /sku-details/sku-version/{id}:
 *   delete:
 *     summary: Soft delete SKU Version
 *     description: Marks the SKU Version as inactive instead of permanently deleting it.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the SKU Version to deactivate
 *         schema:
 *           type: integer
 *           example: 123
 *     responses:
 *       200:
 *         description: SKU Version marked as inactive successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU Version marked as inactive successfully
 *       404:
 *         description: SKU Version not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU Version not found
 *       500:
 *         description: Error deactivating SKU Version
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error deactivating SKU Version
 *                 error:
 *                   type: string
 *                   example: Error details
 */

v1Router.delete(
  "/sku-details/sku-version/:id",
  authenticateJWT,
  async (req, res) => {
    const t = await sequelize.transaction();
    try {
      // Update status to inactive instead of deleting
      const updatedSkuVersion = await SkuVersion.update(
        {
          status: "inactive",
          updated_at: new Date(),
          updated_by: req.user.id,
        },
        {
          where: { id: req.params.id },
          transaction: t,
        }
      );

      if (!updatedSkuVersion[0]) {
        await t.rollback();
        return res.status(404).json({ message: "SKU Version not found" });
      }

      await t.commit();

      // Publish to queue if needed
      await publishToQueue({
        operation: "SOFT_DELETE_VERSION",
        skuVersionId: req.params.id,
        timestamp: new Date(),
        data: { status: "inactive" },
      });

      res
        .status(200)
        .json({ message: "SKU Version marked as inactive successfully" });
    } catch (error) {
      await t.rollback();
      res.status(500).json({
        message: "Error deactivating SKU Version",
        error: error.message,
      });
    }
  }
);

// sku-type apis
/**
 * @swagger
 * /sku-details/sku-type/get:
 *   get:
 *     summary: Get all SKU Types
 *     description: Retrieve all SKU Types with optional filters like status and company_id.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           default: active
 *         description: Filter SKU Types by status (e.g., active, inactive)
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: integer
 *         description: Filter SKU Types by company ID
 *     responses:
 *       200:
 *         description: List of SKU Types retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
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
 *                         example: Electronics
 *                       status:
 *                         type: string
 *                         example: active
 *                       company_id:
 *                         type: integer
 *                         example: 101
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                       creator_sku_types:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                       updater_sku_types:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *       404:
 *         description: No SKU types found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: No SKU types found
 *                 data:
 *                   type: array
 *                   example: []
 *       500:
 *         description: Internal server error while fetching SKU Types
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
 *                   example: Error message details
 */

v1Router.get("/sku-details/sku-type/get", authenticateJWT, async (req, res) => {
  try {
    const { status = "active", company_id } = req.query;

    // Prepare where conditions
    const whereConditions = {
      status: status,
    };

    // Add company_id filter if provided
    if (company_id) {
      whereConditions.company_id = company_id;
    }

    // Find SKU types with associated data
    const skuTypes = await SkuType.findAll({
      where: whereConditions,
      include: [
        {
          model: db.User,
          as: "creator_sku_types",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: db.User,
          as: "updater_sku_types",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: db.Company,
          attributes: ["id"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]], // Order by creation date
    });

    // If no SKU types found, return meaningful response
    if (skuTypes.length === 0) {
      return res.status(404).json({
        message: "No SKU types found",
        data: [],
      });
    }

    // Send response with SKU types
    res.status(200).json({
      data: skuTypes,
    });
  } catch (error) {
    console.error("Error in SKU Type Fetch:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});
// 🔹 Create SKU Type
/**
 * @swagger
 * /sku-details/sku-type:
 *   post:
 *     summary: Create a new SKU Type
 *     description: Creates a new SKU Type associated with the authenticated user's company.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type_name:
 *                 type: string
 *                 example: Electronics
 *               description:
 *                 type: string
 *                 example: Devices and gadgets
 *             required:
 *               - type_name
 *     responses:
 *       201:
 *         description: SKU Type created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU Type created successfully
 *                 skuType:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     type_name:
 *                       type: string
 *                       example: Electronics
 *                     company_id:
 *                       type: integer
 *                       example: 101
 *                     status:
 *                       type: string
 *                       example: active
 *                     created_by:
 *                       type: integer
 *                     updated_by:
 *                       type: integer
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Error creating SKU Type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error creating SKU Type
 *                 error:
 *                   type: string
 *                   example: Detailed error message
 */

v1Router.post("/sku-details/sku-type", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const skuTypeData = {
      ...req.body,
      company_id: req.user.company_id,
      created_by: req.user.id,
      updated_by: req.user.id,
      status: "active",
    };

    const newSkuType = await SkuType.create(skuTypeData, { transaction: t });
    await t.commit();
    res
      .status(201)
      .json({ message: "SKU Type created successfully", skuType: newSkuType });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error creating SKU Type", error: error.message });
  }
});

// 🔹 Update SKU Type
/**
 * @swagger
 * /sku-details/sku-type/{id}:
 *   put:
 *     summary: Update an existing SKU Type
 *     description: Updates the sku_type field of a specific SKU Type by ID.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the SKU Type to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sku_type:
 *                 type: string
 *                 example: Updated Electronics
 *             required:
 *               - sku_type
 *     responses:
 *       200:
 *         description: SKU Type updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU Type updated successfully
 *                 updated_sku_type:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     sku_type:
 *                       type: string
 *                       example: Updated Electronics
 *                     company_id:
 *                       type: integer
 *                       example: 101
 *                     updated_by:
 *                       type: integer
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: sku_type is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: sku_type is required
 *       404:
 *         description: SKU Type not found or no changes made
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU Type not found or no changes made
 *       500:
 *         description: Error updating SKU Type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error updating SKU Type
 *                 error:
 *                   type: string
 *                   example: Detailed error message
 */

v1Router.put("/sku-details/sku-type/:id", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { sku_type } = req.body; // Extract only sku_type

    if (!sku_type) {
      return res.status(400).json({ message: "sku_type is required" });
    }

    const updatedSkuType = await SkuType.update(
      {
        sku_type,
        updated_at: new Date(),
        updated_by: req.user.id,
      },
      {
        where: { id: req.params.id },
        transaction: t,
      }
    );

    if (!updatedSkuType[0]) {
      await t.rollback();
      return res
        .status(404)
        .json({ message: "SKU Type not found or no changes made" });
    }

    // Fetch the updated record after update
    const updatedRecord = await SkuType.findOne({
      where: { id: req.params.id },
      transaction: t,
    });

    await t.commit();
    res.status(200).json({
      message: "SKU Type updated successfully",
      updated_sku_type: updatedRecord,
    });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Error updating SKU Type", error: error.message });
  }
});

// 🔹 Soft Delete SKU Type
/**
 * @swagger
 * /sku-details/sku-type/{id}:
 *   delete:
 *     summary: Soft delete a SKU Type
 *     description: Marks a SKU Type as inactive instead of permanently deleting it.
 *     tags:
 *       - SKU
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the SKU Type to deactivate
 *     responses:
 *       200:
 *         description: SKU Type marked as inactive successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU Type marked as inactive successfully
 *       404:
 *         description: SKU Type not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SKU Type not found
 *       500:
 *         description: Error deactivating SKU Type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error deactivating SKU Type
 *                 error:
 *                   type: string
 *                   example: Detailed error message
 */

v1Router.delete(
  "/sku-details/sku-type/:id",
  authenticateJWT,
  async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const updatedSkuType = await SkuType.update(
        {
          status: "inactive",
          updated_by: req.user.id,
        },
        {
          where: { id: req.params.id },
          transaction: t,
        }
      );

      if (!updatedSkuType[0])
        return res.status(404).json({ message: "SKU Type not found" });

      await t.commit();
      res
        .status(200)
        .json({ message: "SKU Type marked as inactive successfully" });
    } catch (error) {
      await t.rollback();
      res
        .status(500)
        .json({ message: "Error deactivating SKU Type", error: error.message });
    }
  }
);

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
    rabbitmq: rabbitChannel ? "connected" : "disconnected",
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await closeRabbitMQConnection();
  process.exit(0);
});

// Use Version 1 Router
app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3004;
app.listen(PORT, () => {
  console.log(`SKU Service running on port ${PORT}`);
});
