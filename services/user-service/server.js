import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../../common/models/user.model.js";
import { authenticateJWT, authenticateStaticToken } from "../../common/middleware/auth.js";
import { validateLogin } from "../../common/inputvalidation/validateLogin.js";
import { validateRegister } from "../../common/inputvalidation/validateRegister.js";
import amqp from "amqplib";
import sequelize from '../../common/database/database.js';
import dotenv from "dotenv";
import UserAuth from "../../common/models/userAuth.model.js";
import { logRequestResponse } from "../../common/middleware/errorLogger.js";
import logger from "../../common/helper/logger.js";
dotenv.config();

const app = express();
app.use(json());
app.use(cors());

// const v1Router = Router();
app.use(logRequestResponse)
const RABBITMQ_URL = process.env.RABBITMQ_URL; // Update if needed
const QUEUE_NAME = process.env.USER_QUEUE_NAME;

// 🔹 Create a Company (POST)
app.post("/register", validateRegister, authenticateJWT, async (req, res) => {
    try {
        logger.info("🔵 Registering a new user : " + req.body);
        const { name, email, password, mobile } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ where: { email, company_id: req.user.company_id } });
        logger.info("existingUser : " + existingUser);
        if (existingUser) {
            logger.info("existingUser : Email already registered");
            return res.status(400).json({
                status: false,
                message: "Email already registered",
                data: []
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUserAuth = await UserAuth.create({
            email,
            password: hashedPassword
        });
        logger.info("newUserAuth : " + newUserAuth);
        const newUser = await User.create({
            name,
            user_auth_id: newUserAuth.id,
            email,
            mobile,
            company_id: req.user.company_id
        });
        logger.info("newUser : " + newUser);
        console.log("✅ User Registered:", newUser);

        // 🔹 Prepare Email Message
        const emailPayload = {
            to: email,
            subject: "Welcome to Our Platform!",
            body: `
                <h2>Hello ${name},</h2>
                <p>Your account has been created successfully!</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Password:</strong> ${password}</p>
                <p>Please login and change your password.</p>
            `
        };
        logger.info("emailPayload : " + emailPayload);
        // 🔹 Publish Email Task to RabbitMQ
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(emailPayload)), { persistent: true });
        logger.info(`📩 Email task queued for ${email}`);
        await channel.close();
        await connection.close();
        logger.info(`User registered successfully`);
        return res.status(200).json({
            status: true,
            message: "User registered successfully",
            data: newUser
        });

    } catch (error) {
        const stackLines = error.stack.split('\n');
        const callerLine = stackLines[1]; // The line where the error occurred
        const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
        let fileName = '';
        let lineNumber = '';

        if (match) {
            fileName = match[1];
            lineNumber = match[2];
        }
        const errorMessage = {
            status: false,
            message: error.message,
            file: fileName,
            line: lineNumber,
            data: [],
        }
        logger.error(`User register : ${errorMessage}`);
        return res.status(500).json(errorMessage);
    }
});

app.post("/login", authenticateStaticToken, validateLogin, async (req, res) => {
    try {
        const { email, password } = req.body;

        // 🔹 Check if required fields exist
        if (!email || !password) {
            return res.status(400).json({
                status: false,
                message: "Missing email or password",
                data: []
            });
        }

        // 🔹 Find user by email
        const user = await User.findOne({ where: { email } });
        const userAuth = await UserAuth.findOne({ where: { id: user.user_auth_id } });


        if (!user) {
            return res.status(400).json({
                status: false,
                message: "Invalid email or password"
            });
        }

        // 🔹 Compare passwords
        const isMatch = await bcrypt.compare(password, userAuth.password);
        if (!isMatch) {
            return res.status(400).json({
                status: false,
                message: "Invalid email or password"
            });
        }

        // 🔹 Generate JWT Token
        const JWT_SECRET = process.env.JWT_SECRET;

        const token = jwt.sign(
            { id: user.id, email: user.email, company_id: user.company_id },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        // 🔹 Update last login time
        await User.update({ last_login: new Date() }, { where: { id: user.id } });

        return res.status(200).json({
            status: true,
            message: "Login successful",
            token,
            user
        });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({
            status: false,
            message: error.message,
            file: error.stack.split("\n")[1]?.trim(),
            data: [],
        });
    }
});

// ✅ Static Token for Internal APIs (e.g., Health Check)
app.get("/health", (req, res) => {
    res.json({ status: "Service is running", timestamp: new Date() });
});

// Use Version 1 Router
// app.use("/v1", v1Router);

await db.sequelize.sync();
const PORT = 3002;
const service = 'User Service';
app.listen(PORT, async () => {
    console.log(`${service} running on port ${PORT}`);
});
