import Joi from "joi";
import { Op } from "sequelize";
import CompanyAddress from "../models/companyAddress.model.js";

export const validateCompanyAddress = async (req, res, next) => {
    try {
        // ✅ Define Joi Schema
        const schema = Joi.object({
            country_id: Joi.number().integer().positive().required(),
            address: Joi.string().min(5).max(255).required(),
            tax_number: Joi.string().optional().allow(null, ""),
            tax_name: Joi.string().optional().allow(null, ""),
            location: Joi.string().optional().allow(null, ""),
            latitude: Joi.number().optional().allow(null),
            longitude: Joi.number().optional().allow(null),
            company_id: Joi.number().integer().positive().required(),
        });

        // ✅ Validate Request Body
        const { error, value } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            return res.status(400).json({ message: "Validation error", errors: error.details });
        }

        const companyAddressId = req.params.id || null; // Get ID from request params (for update)

        if (companyAddressId) {
            // ✅ Update scenario: Ensure address exists before updating
            const existingCompanyAddress = await CompanyAddress.findOne({
                where: { id: companyAddressId }
            });

            if (!existingCompanyAddress) {
                return res.status(404).json({ message: "Company Address not found." });
            }
        }

        // ✅ If validation passes, proceed to next middleware/controller
        next();
    } catch (err) {
        console.error("Validation error:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
