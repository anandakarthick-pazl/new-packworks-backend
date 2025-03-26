import Joi from "joi";
import { Op } from "sequelize";
import Client from "../models/client.model.js";
import Company from "../models/company.model.js";

export const validateClient = async (req, res, next) => {
  try {
    // Define validation schema for client data
    const clientDataSchema = Joi.object({
      // Core required fields
      company_id: Joi.number().integer().positive().allow(null),
      client_ref_id: Joi.string().required(),
      gst_status: Joi.boolean().default(true),
      gst_number: Joi.string().when("gst_status", {
        is: true,
        then: Joi.string()
          .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
          .message("Invalid GST number format")
          .required(),
        otherwise: Joi.string().allow(null, ""),
      }),
      entity_type: Joi.string().valid("Client", "Vendor").default("Client"),
      customer_type: Joi.string().valid("Business", "Individual").required(),
      salutation: Joi.string().allow(null, ""),
      first_name: Joi.string().when("customer_type", {
        is: "Individual",
        then: Joi.string().required(),
        otherwise: Joi.string().allow(null, ""),
      }),
      last_name: Joi.string().when("customer_type", {
        is: "Individual",
        then: Joi.string().required(),
        otherwise: Joi.string().allow(null, ""),
      }),
      display_name: Joi.string().required(),
      company_name: Joi.string().when("customer_type", {
        is: "Business",
        then: Joi.string().required(),
        otherwise: Joi.string().allow(null, ""),
      }),
      email: Joi.string().email().required(),
      work_phone: Joi.string().allow(null, ""),
      mobile: Joi.string().allow(null, ""),
      PAN: Joi.string()
        .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
        .message("Invalid PAN format")
        .allow(null, ""),
      status: Joi.string().valid("active", "inactive").default("active"),

      // Optional fields
      currency: Joi.string().optional().allow(null, ""),
      opening_balance: Joi.number().optional().allow(null),
      payment_terms: Joi.string().optional().allow(null, ""),
      enable_portal: Joi.boolean().optional(),
      portal_language: Joi.string().optional().allow(null, ""),
      documents: Joi.object().optional().allow(null),
      website_url: Joi.string().uri().optional().allow(null, ""),
      department: Joi.string().optional().allow(null, ""),
      designation: Joi.string().optional().allow(null, ""),
      twitter: Joi.string().optional().allow(null, ""),
      skype: Joi.string().optional().allow(null, ""),
      facebook: Joi.string().optional().allow(null, ""),
    }).unknown(true);

    // Define schema for address
    const addressSchema = Joi.object({
      // Core required fields
      id: Joi.number().integer().positive().optional(),
      attention: Joi.string().allow(null, ""),
      country: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      pinCode: Joi.string().required(),
      phone: Joi.string().required(),
      faxNumber: Joi.string().allow(null, ""),
      status: Joi.string().valid("active", "inactive").default("active"),

      // Optional fields
      street1: Joi.string().optional().allow(null, ""),
      street2: Joi.string().optional().allow(null, ""),
    }).unknown(true);

    // Define the main schema with clientData and addresses as separate properties
    const mainSchema = Joi.object({
      clientData: clientDataSchema.required(),
      addresses: Joi.array().items(addressSchema).min(1).required().messages({
        "array.min": "At least one address is required",
      }),
    }).unknown(true);

    // Validate request body
    const { error, value } = mainSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res
        .status(400)
        .json({ message: "Validation error", errors: error.details });
    }

    const { clientData, addresses } = value;

    // Sanitize phone numbers
    if (clientData.work_phone) {
      clientData.work_phone = clientData.work_phone.replace(/\D/g, "");
    }

    if (clientData.mobile) {
      clientData.mobile = clientData.mobile.replace(/\D/g, "");
    }

    addresses.forEach((address) => {
      if (address.phone) {
        address.phone = address.phone.replace(/\D/g, "");
      }
    });

    // Store sanitized data back in req.body
    req.body = { clientData, addresses };

    // Get client ID from route parameter (for update scenario)
    const clientId = req.params.id || req.params.client_id || null;

    // Check if email is unique
    if (clientId) {
      // Update scenario: Ensure email is unique excluding the current record
      const existingClient = await Client.findOne({
        where: {
          email: clientData.email,
          client_id: { [Op.ne]: clientId }, // Exclude current client's ID
        },
      });

      if (existingClient) {
        return res.status(400).json({
          message: "Email is already in use by another client.",
          status: false,
        });
      }
    } else {
      // Insert scenario: Ensure email is unique
      const existingClient = await Client.findOne({
        where: { email: clientData.email },
      });

      if (existingClient) {
        return res.status(400).json({
          message: "Email is already in use. Please use a different email.",
          status: false,
        });
      }
    }

    // Validate company_id exists if provided
    if (clientData.company_id) {
      const companyExists = await Company.findByPk(clientData.company_id);
      if (!companyExists) {
        return res.status(400).json({
          message: "The specified company does not exist.",
          status: false,
        });
      }
    }

    // If validation passes, proceed to next middleware/controller
    next();
  } catch (err) {
    console.error("Validation error:", err.message);
    res.status(500).json({
      message: "Server error",
      error: err.message,
      status: false,
    });
  }
};
