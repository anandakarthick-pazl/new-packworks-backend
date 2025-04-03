import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const STATIC_TOKEN = process.env.STATIC_API_TOKEN; // Static API Token

export const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    // Ensure Authorization header exists and starts with 'Bearer '
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            status: false,
            message: "Unauthorized: Missing or invalid token format",
            data: [],
        });
    }

    // Extract token after 'Bearer '
    const token = authHeader.split(" ")[1];

    try {
        // Verify JWT Token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach user payload to request
        console.log("Decoded Token:", decoded);
        // if (!decoded.company_id) {
        //     return res.status(400).json({
        //         status: false,
        //         message: "company_id is missing in token",
        //     });
        // }
        req.sequelizeOptions = { req }; // Attach Sequelize options to request
        next();
    } catch (err) {
        return res.status(403).json({
            status: false,
            message: "Forbidden: Invalid or expired token",
            error: err.message, // Include error message for debugging
            data: [],
        });
    }
};

export const authenticateStaticToken = (req, res, next) => {
    const token = req.headers["x-api-key"];

    if (!token || token !== STATIC_TOKEN) {
        return res.status(401).json({
            status: false,
            message: "Unauthorized: No token provided or invalid static token",
            data: [],
        });
    }
    next();
};
