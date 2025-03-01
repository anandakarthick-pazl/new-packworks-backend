import Joi from "joi";

// ✅ Register Validation Schema
export const validateRegister = (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(100).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).max(50).required(),
        mobile: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional() // Validates international phone numbers
    });

    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
        return res.status(400).json({ message: "Validation error", errors: error.details });
    }

    next();
};
