import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../../common/models/user.model.js";
import {
  authenticateJWT,
  authenticateStaticToken,
} from "../../common/middleware/auth.js";
import { validateLogin } from "../../common/inputvalidation/validateLogin.js";
import { validateRegister } from "../../common/inputvalidation/validateRegister.js";
import amqp from "amqplib";
import sequelize from "../../common/database/database.js";
import dotenv from "dotenv";
import UserAuth from "../../common/models/userAuth.model.js";
import Employee from "../../common/models/employee.model.js";
import Department from "../../common/models/department.model.js";
import Designation from "../../common/models/designation.model.js";
import UserRole from "../../common/models/userRole.model.js";
import { logRequestResponse } from "../../common/middleware/errorLogger.js";
import logger from "../../common/helper/logger.js";
dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();
app.use(logRequestResponse);
const RABBITMQ_URL = process.env.RABBITMQ_URL; // Update if needed
const QUEUE_NAME = process.env.USER_QUEUE_NAME;


// Register API with Transaction
v1Router.post(
  "/register",
  validateRegister,
  authenticateJWT,
  async (req, res) => {
    console.log("regsitering user");
    const transaction = await sequelize.transaction();
    try {
      logger.info("🔵 Registering a new user : " + JSON.stringify(req.body));
      const { name, email, password, mobile } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { email, company_id: req.user.company_id },
        transaction,
      });

      if (existingUser) {
        logger.info("existingUser : Email already registered");
        await transaction.rollback();
        return res.status(400).json({
          status: false,
          message: "Email already registered",
          data: [],
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Step 1: Insert into UserAuth table
      const newUserAuth = await UserAuth.create(
        {
          email,
          password: hashedPassword,
        },
        { transaction }
      );

      logger.info("newUserAuth : " + JSON.stringify(newUserAuth));

      // Step 2: Insert into User table
      const newUser = await User.create(
        {
          name,
          user_auth_id: newUserAuth.id,
          email,
          mobile,
          company_id: req.user.company_id,
        },
        { transaction }
      );

      logger.info("newUser : " + JSON.stringify(newUser));

      // Step 3: Insert into Employee table
      const {
        employee_id,
        address,
        hourly_rate,
        slack_username,
        department_id,
        designation_id,
        joining_date,
        last_date,
        added_by,
        last_updated_by,
        attendance_reminder,
        date_of_birth,
        calendar_view,
        about_me,
        reporting_to,
        contract_end_date,
        internship_end_date,
        employment_type,
        marriage_anniversary_date,
        marital_status,
        notice_period_end_date,
        notice_period_start_date,
        probation_end_date,
        company_address_id,
        overtime_hourly_rate
      } = req.body; // Extract only Employee-related fields

      const employee = await Employee.create(
        {
          user_id: newUser.id,  // Assigned dynamically
          company_id: req.user.company_id, // Assigned dynamically
          employee_id,
          address,
          hourly_rate,
          slack_username,
          department_id,
          designation_id,
          joining_date,
          last_date,
          added_by,
          last_updated_by,
          attendance_reminder,
          date_of_birth,
          calendar_view,
          about_me,
          reporting_to,
          contract_end_date,
          internship_end_date,
          employment_type,
          marriage_anniversary_date,
          marital_status,
          notice_period_end_date,
          notice_period_start_date,
          probation_end_date,
          company_address_id,
          overtime_hourly_rate
        },
        { transaction }
      );

      logger.info("newEmployee : " + JSON.stringify(employee));

      // Commit transaction
      await transaction.commit();
      logger.info("✅ User Registered Successfully");

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
            `,
      };

      logger.info("emailPayload : " + JSON.stringify(emailPayload));

      // 🔹 Publish Email Task to RabbitMQ
      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();
      await channel.assertQueue(QUEUE_NAME, { durable: true });

      channel.sendToQueue(
        QUEUE_NAME,
        Buffer.from(JSON.stringify(emailPayload)),
        { persistent: true }
      );

      logger.info(`📩 Email task queued for ${email}`);
      await channel.close();
      await connection.close();

      return res.status(200).json({
        status: true,
        message: "User registered successfully",
        data: newUser,
      });
    } catch (error) {
      await transaction.rollback();

      const stackLines = error.stack.split("\n");
      const callerLine = stackLines[1]; // The line where the error occurred
      const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
      let fileName = "";
      let lineNumber = "";

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
      };

      logger.error(`User register : ${JSON.stringify(errorMessage)}`);
      return res.status(500).json(errorMessage);
    }
  }
);

v1Router.put(
  "/employees/:userId",
  authenticateJWT,
  async (req, res) => {
    console.log("Updating user details...");
    const transaction = await sequelize.transaction();
    try {
      logger.info("🟢 Updating user: " + JSON.stringify(req.body));
      const { userId } = req.params;
      const { name, mobile } = req.body;

      // Step 1: Check if User exists
      const user = await User.findOne({
        where: { id: userId, company_id: req.user.company_id },
        transaction,
      });

      if (!user) {
        logger.info("❌ User not found.");
        await transaction.rollback();
        return res.status(404).json({
          status: false,
          message: "User not found",
          data: [],
        });
      }

      // Step 2: Check if Employee exists
      const employee = await Employee.findOne({
        where: { user_id: userId },
        transaction,
      });

      if (!employee) {
        logger.info("⚠️ Employee details not found.");
        await transaction.rollback();
        return res.status(404).json({
          status: false,
          message: "Employee details not found",
          data: [],
        });
      }

      // Step 3: Update User details
      await user.update(
        { name, mobile },
        { transaction }
      );

      logger.info("✅ User details updated: " + JSON.stringify(user));

      // Step 4: Update Employee details
      const {
        employee_id,
        address,
        hourly_rate,
        slack_username,
        department_id,
        designation_id,
        joining_date,
        last_date,
        added_by,
        last_updated_by,
        attendance_reminder,
        date_of_birth,
        calendar_view,
        about_me,
        reporting_to,
        contract_end_date,
        internship_end_date,
        employment_type,
        marriage_anniversary_date,
        marital_status,
        notice_period_end_date,
        notice_period_start_date,
        probation_end_date,
        company_address_id,
        overtime_hourly_rate
      } = req.body; // Extract only Employee-related fields

      await employee.update(
        {
          employee_id,
          address,
          hourly_rate,
          slack_username,
          department_id,
          designation_id,
          joining_date,
          last_date,
          added_by,
          last_updated_by,
          attendance_reminder,
          date_of_birth,
          calendar_view,
          about_me,
          reporting_to,
          contract_end_date,
          internship_end_date,
          employment_type,
          marriage_anniversary_date,
          marital_status,
          notice_period_end_date,
          notice_period_start_date,
          probation_end_date,
          company_address_id,
          overtime_hourly_rate
        },
        { transaction }
      );

      logger.info("✅ Employee details updated: " + JSON.stringify(employee));

      // Step 5: Commit Transaction
      await transaction.commit();
      logger.info("✅ User & Employee Updated Successfully");

      return res.status(200).json({
        status: true,
        message: "User and employee updated successfully",
        data: { user, employee },
      });
    } catch (error) {
      await transaction.rollback();

      const stackLines = error.stack.split("\n");
      const callerLine = stackLines[1];
      const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
      let fileName = "";
      let lineNumber = "";

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
      };

      logger.error(`User update failed: ${JSON.stringify(errorMessage)}`);
      return res.status(500).json(errorMessage);
    }
  }
);



v1Router.post(
  "/login",
  authenticateStaticToken,
  validateLogin,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // 🔹 Check if required fields exist
      if (!email || !password) {
        return res.status(400).json({
          status: false,
          message: "Missing email or password",
          data: [],
        });
      }

      // 🔹 Find user by email
      const user = await User.findOne({ where: { email } });
      const userAuth = await UserAuth.findOne({
        where: { id: user.user_auth_id },
      });

      if (!user) {
        return res.status(400).json({
          status: false,
          message: "Invalid email or password",
        });
      }

      // 🔹 Compare passwords
      const isMatch = await bcrypt.compare(password, userAuth.password);
      if (!isMatch) {
        return res.status(400).json({
          status: false,
          message: "Invalid email or password",
        });
      }

      // 🔹 Generate JWT Token
      const JWT_SECRET = process.env.JWT_SECRET;

      const token = jwt.sign(
        { id: user.id, email: user.email, company_id: user.company_id },
        JWT_SECRET
        // { expiresIn: "1h" }
      );

      // 🔹 Update last login time
      await User.update({ last_login: new Date() }, { where: { id: user.id } });

      return res.status(200).json({
        status: true,
        message: "Login successful",
        token,
        user,
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
  }
);
v1Router.get("/employees", authenticateJWT, async (req, res) => {
  try {


    const { page = 1, limit = 10, search = "" } = req.query;
    const offset = (page - 1) * limit;

    // Get total count of records matching the search criteria
    const totalRecordsResult = await sequelize.query(
      `SELECT COUNT(*) AS total FROM employee_details e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN role_user ru ON u.id = ru.user_id
      LEFT JOIN roles r ON ru.role_id = r.id
      LEFT JOIN users rm ON e.reporting_to = rm.id
      WHERE 
          u.name LIKE :search OR 
          u.email LIKE :search OR 
          d.department_name LIKE :search OR 
          des.name LIKE :search OR 
          r.name LIKE :search OR 
          u.status LIKE :search`,
      {
        replacements: { search: `%${search}%` },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const totalRecords = totalRecordsResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // Fetch paginated records
    const employees = await sequelize.query(
      `SELECT 
          e.id,
          e.employee_id,
          e.user_id,
          u.name AS employee_name,
          u.image AS image,
          d.department_name AS department,
          des.name AS designation,
          r.name AS role,
          u.status AS user_status,
          rm.name AS reporting_manager
      FROM employee_details e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN role_user ru ON u.id = ru.user_id
      LEFT JOIN roles r ON ru.role_id = r.id
      LEFT JOIN users rm ON e.reporting_to = rm.id
      WHERE 
          u.name LIKE :search OR 
          u.email LIKE :search OR 
          d.department_name LIKE :search OR 
          des.name LIKE :search OR 
          r.name LIKE :search OR 
          u.status LIKE :search 
      ORDER BY e.employee_id
      LIMIT :limit OFFSET :offset`,
      {
        replacements: {
          search: `%${search}%`,
          limit: parseInt(limit),
          offset: parseInt(offset)
        },
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json({
      success: true,
      totalRecords,
      totalPages,
      currentPage: parseInt(page),
      pageSize: parseInt(limit),
      data: employees
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.get("/employees/:employeeId", authenticateJWT, async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findOne({
      where: { id: employeeId },
      include: [
        {
          model: User,
          attributes: ['name', 'email'], // Fetch only name and email
        },
      ],
    });

    if (!employee) {
      return res.json({
        success: true,
        message: 'Employee not found',
        data: {} // Empty object if no employee found
      });
    }

    return res.json({
      success: true,
      data: employee  // Use the correct variable "employee"
    });

  } catch (error) {
    console.error("Error fetching employee:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Static Token for Internal APIs (e.g., Health Check)
v1Router.get("/health", (req, res) => {
  res.json({ status: "Service is running", timestamp: new Date() });
});

// Use Version 1 Router
app.use("/api/user", v1Router);

await db.sequelize.sync();
const PORT = 3002;
const service = "User Service";
app.listen(PORT, async () => {
  console.log(`${service} running on port ${PORT}`);
});
