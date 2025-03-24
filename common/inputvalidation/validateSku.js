import Joi from "joi";
import { Op } from "sequelize";
import Client from "../models/client.model.js";
import Sku from "../models/skuModel/sku.model.js";

export const validateSku = async (req, res, next) => {
  try {
    // Schema for SKU Values
    const skuValueSchema = Joi.object({
      layer: Joi.string().required(),
      gsm: Joi.string().required(),
      bf: Joi.number().positive().required(),
      color: Joi.string().required(),
      flute_type: Joi.string().required(),
      flute_ratio: Joi.number().positive().required(),
      material: Joi.string().required(),
      flat: Joi.number().positive().allow(null),
    });

    // Main SKU Schema
    const skuSchema = Joi.object({
      client_id: Joi.number().integer().positive().required(),
      sku_name: Joi.string().required(),
      ply: Joi.number().integer().positive().required(),
      length: Joi.number().positive().required(),
      width: Joi.number().positive().required(),
      height: Joi.number().positive().required(),
      joints: Joi.number().integer().positive().required(),
      ups: Joi.number().integer().positive().required(),
      inner_outer_dimension: Joi.string().valid("Inner", "Outer").required(),
      flap_width: Joi.number().positive().required(),
      flap_tolerance: Joi.number().positive().required(),
      length_trimming_tolerance: Joi.number().positive().required(),
      width_trimming_tolerance: Joi.number().positive().required(),
      strict_adherence: Joi.boolean().required(),
      customer_reference: Joi.string().required(),
      reference_number: Joi.string().required(),
      internal_id: Joi.string().required(),
      board_size_cm2: Joi.number().positive().required(),
      deckle_size: Joi.number().positive().required(),
      minimum_order_level: Joi.number().integer().positive().required(),
      sku_type: Joi.string()
        .valid("Corrugated box", "Carton", "Package")
        .required(),
      sku_values: Joi.array().items(skuValueSchema).min(1).required(),
    });

    // Validate request body
    const { error, value } = skuSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res
        .status(400)
        .json({ message: "Validation error", errors: error.details });
    }

    const { client_id, sku_name } = value;

    // Check if Client exists
    const clientExists = await Client.findByPk(client_id);
    if (!clientExists) {
      return res.status(400).json({ message: "Client not found" });
    }

    // Check for duplicate SKU Name
    const existingSku = await Sku.findOne({ where: { sku_name, client_id } });
    if (existingSku) {
      return res
        .status(400)
        .json({ message: "SKU name already exists for this client" });
    }

    // Save validated data back to req.body
    req.body = value;

    next();
  } catch (err) {
    console.error("Validation error:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
