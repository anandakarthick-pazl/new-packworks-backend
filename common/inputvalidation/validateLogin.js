import Joi from "joi";


// ✅ Login Validation Schema
export const validateLogin = (req, res, next) => {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).max(50).required()
    });

    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
        return res.status(400).json({ message: "Validation error", errors: error.details });
    }

    next();
};
