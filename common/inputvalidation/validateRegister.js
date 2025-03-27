import Joi from "joi";

// ✅ Register Validation Schema
export const validateRegister = (req, res, next) => {
    const schema = Joi.object({
        // User-related fields
        name: Joi.string().min(3).max(100).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).max(50).required(),
        mobile: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),

        // Employee-related fields
        employee_id: Joi.string().max(50).optional().allow(null),
        address: Joi.string().max(255).optional().allow(null),
        hourly_rate: Joi.number().precision(2).optional().allow(null),
        slack_username: Joi.string().max(191).optional().allow(null),
        department_id: Joi.number().integer().optional().allow(null),
        designation_id: Joi.number().integer().optional().allow(null),

        // ✅ Corrected: Default today's date for empty fields
        joining_date: Joi.date().optional().allow(null).default(() => new Date()),
        last_date: Joi.date().optional().allow(null).default(() => new Date()),
        attendance_reminder: Joi.date().optional().allow(null).default(() => new Date()),
        date_of_birth: Joi.date().optional().allow(null).default(() => new Date()),
        contract_end_date: Joi.date().optional().allow(null).default(() => new Date()),
        internship_end_date: Joi.date().optional().allow(null).default(() => new Date()),
        marriage_anniversary_date: Joi.date().optional().allow(null).default(() => new Date()),
        notice_period_end_date: Joi.date().optional().allow(null).default(() => new Date()),
        notice_period_start_date: Joi.date().optional().allow(null).default(() => new Date()),
        probation_end_date: Joi.date().optional().allow(null).default(() => new Date()),
        about_me: Joi.string().optional().allow(null),
        reporting_to: Joi.number().integer().optional().allow(null),
        employment_type: Joi.string().valid("Full-time", "Part-time", "Internship", "Contract").optional().allow(null),
        marital_status: Joi.string().valid("single", "married", "divorced", "widowed").optional().allow(null),

        company_address_id: Joi.number().integer().optional().allow(null),
        role_id: Joi.number().integer().optional().allow(null),
        overtime_hourly_rate: Joi.number().precision(2).optional().allow(null),
    });

    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
        return res.status(400).json({ message: "Validation error", errors: error.details });
    }

    req.body = value; // ✅ Update `req.body` with default values if set
    next();
};
