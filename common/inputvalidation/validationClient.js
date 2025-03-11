import Joi from "joi";
import { Op } from "sequelize"; // Import Sequelize operators
import Client from "../models/client.model.js";

export const validateClient = async (req, res, next) => {
  try {
    // Define validation schema
    const clientSchema = Joi.object({
      clientData: Joi.object({
        company_id: Joi.number().required(),
        client_ref_id: Joi.string().required(),
        customer_type: Joi.string().required(),
        display_name: Joi.string().required(),
        salutation: Joi.string().optional(),
        first_name: Joi.string().optional(),
        last_name: Joi.string().optional(),
        company_name: Joi.string().optional(),
        email: Joi.string().email().optional(),
        work_phone: Joi.string().optional(),
        mobile: Joi.string().optional(),
        PAN: Joi.string().optional(),
        currency: Joi.string().optional(),
        opening_balance: Joi.number().optional(),
        payment_terms: Joi.string().optional(),
        enable_portal: Joi.boolean().optional(),
        portal_language: Joi.string().optional(),
        documents: Joi.object().optional(),
        website_url: Joi.string().uri().optional(),
        department: Joi.string().optional(),
        designation: Joi.string().optional(),
        twitter: Joi.string().optional(),
        skype: Joi.string().optional(),
        facebook: Joi.string().optional(),
      }),
      addresses: Joi.array()
        .items(
          Joi.object({
            attention: Joi.string().optional(),
            country: Joi.string().optional(),
            street1: Joi.string().optional(),
            street2: Joi.string().optional(),
            city: Joi.string().optional(),
            state: Joi.string().optional(),
            pinCode: Joi.string().optional(),
            phone: Joi.string().optional(),
            faxNumber: Joi.string().optional(),
          })
        )
        .optional(),
    });

    // Validate request body
    const { error, value } = clientSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res
        .status(400)
        .json({ message: "Validation error", errors: error.details });
    }

    const clientId = req.params.id || null; // Get ID from request params (for update)

    if (clientId) {
      // Update scenario: Ensure email is unique excluding the current record
      const existingClient = await Client.findOne({
        where: { email: value.email, client_id: { [Op.ne]: clientId } },
      });

      if (existingClient) {
        return res
          .status(400)
          .json({ message: "Email is already in use by another client." });
      }
    } else {
      // Insert scenario: Ensure email is unique
      if (value.email) {
        const existingClient = await Client.findOne({
          where: { email: value.email },
        });

        if (existingClient) {
          return res
            .status(400)
            .json({
              message: "Email is already in use. Please use a different email.",
            });
        }
      }
    }

    // If validation passes, proceed to next middleware/controller
    next();
  } catch (err) {
    console.error("Validation error:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
