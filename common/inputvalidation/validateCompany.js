import Joi from "joi";
import { Op } from "sequelize"; // Import Sequelize operators
import Company from "../models/company.model.js";
import User from "../models/user.model.js";  // Adjust the path to your Sequelize model

export const validateCompany = async (req, res, next) => {
    try {
        // Define validation schema
        const companySchema = Joi.object({
            name: Joi.string().min(3).max(100).required(),
            email: Joi.string().email().required(),
            phone: Joi.string().pattern(/^\d+$/).min(8).max(15).optional(),
            website: Joi.string().uri().optional(),
            currency: Joi.number().integer().positive().required(),
            company_state_id: Joi.number().integer().positive().optional(),
            timezone: Joi.string().optional(),
            language: Joi.string().optional(),
            status: Joi.string().valid("active", "inactive").default("active"),
            address: Joi.string().optional(),
            logo: Joi.string().uri().optional(),
            package_name: Joi.string().min(3).max(100).optional(),
            password: Joi.string().min(3).max(100).optional(),
            package_id: Joi.number().integer().positive().optional(),
            package_type: Joi.string().valid("monthly", "annual").default("monthly"),
            
            // 🔹 CHANGED: Made package dates optional since they're auto-generated
            package_start_date: Joi.date().optional(),
            package_end_date: Joi.date().optional(),
            
            // 🔹 NEW: Added version field as optional
            version: Joi.string().valid("trial", "paid").optional(),

            companyAccountDetails: Joi.array().items(
                Joi.object({
                    accountName: Joi.string().min(3).max(100).required(),
                    accountEmail: Joi.string().email().required()
                })
            ).required()
        });

        // Validate request body
        const { error, value } = companySchema.validate(req.body, { abortEarly: false });

        if (error) {
            return res.status(400).json({ message: "Validation error", errors: error.details });
        }

        const companyId = req.params.id || null; // Get ID from request params (for update)

        if (companyId) {
            // Update scenario: Ensure email is unique excluding the current record
            const existingCompany = await Company.findOne({
                where: { email: value.email, id: { [Op.ne]: companyId } }
            });

            if (existingCompany) {
                return res.status(400).json({ message: "Email is already in use by another company." });
            }
        } else {
            // Insert scenario: Ensure email is unique
            const existingCompany = await Company.findOne({ where: { company_email: value.email } });

            if (existingCompany) {
                return res.status(400).json({ message: "Email is already in use. Please use a different email." });
            }

            const accountEmails = value.companyAccountDetails.map(acc => acc.accountEmail);
            const existingUsers = await User.findAll({ where: { email: accountEmails } });

            if (existingUsers.length > 0) {
                return res.status(400).json({ message: " Admin Email is already in use. Please use a different email." });
            }
        }

        // If validation passes, proceed to next middleware/controller
        next();
    } catch (err) {
        console.error("Validation error:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};