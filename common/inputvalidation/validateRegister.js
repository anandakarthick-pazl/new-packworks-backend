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
        joining_date: Joi.date().iso().optional().allow(null),
        last_date: Joi.date().iso().optional().allow(null),
        added_by: Joi.number().integer().optional().allow(null),
        last_updated_by: Joi.number().integer().optional().allow(null),
        attendance_reminder: Joi.date().iso().optional().allow(null),
        date_of_birth: Joi.date().iso().optional().allow(null),
        calendar_view: Joi.string().optional().allow(null),
        about_me: Joi.string().optional().allow(null),
        reporting_to: Joi.number().integer().optional().allow(null),
        contract_end_date: Joi.date().iso().optional().allow(null),
        internship_end_date: Joi.date().iso().optional().allow(null),
        employment_type: Joi.string().valid("Full-time", "Part-time", "Internship", "Contract").optional().allow(null),
        marriage_anniversary_date: Joi.date().iso().optional().allow(null),
        marital_status: Joi.string().valid("single", "married", "divorced", "widowed").optional().allow(null),
        notice_period_end_date: Joi.date().iso().optional().allow(null),
        notice_period_start_date: Joi.date().iso().optional().allow(null),
        probation_end_date: Joi.date().iso().optional().allow(null),
        company_address_id: Joi.number().integer().optional().allow(null),
        overtime_hourly_rate: Joi.number().precision(2).optional().allow(null)
    });

    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
        return res.status(400).json({ message: "Validation error", errors: error.details });
    }

    next();
};
