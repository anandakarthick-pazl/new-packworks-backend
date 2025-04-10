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
import Role from "../../common/models/role.model.js";
import { logRequestResponse } from "../../common/middleware/errorLogger.js";
import logger from "../../common/helper/logger.js";
dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();
// app.use(logRequestResponse);
const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE_NAME = process.env.USER_QUEUE_NAME;

// Register API with Transaction
/**
 * @swagger
 * /user/register:
 *   post:
 *     summary: Register a new user
 *     description: Registers a new user and assigns department, designation, and role. Also queues a welcome email.
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role_id
 *               - department_id
 *               - designation_id
 *               - reporting_to
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Secret@123
 *               mobile:
 *                 type: string
 *                 example: "9876543210"
 *               role_id:
 *                 type: integer
 *                 example: 2
 *               department_id:
 *                 type: integer
 *                 example: 3
 *               designation_id:
 *                 type: integer
 *                 example: 1
 *               reporting_to:
 *                 type: integer
 *                 example: 1
 *               image:
 *                 type: string
 *                 example: "profile.jpg"
 *               country_phonecode:
 *                 type: string
 *                 example: "+91"
 *               country_id:
 *                 type: integer
 *                 example: 101
 *               employee_id:
 *                 type: string
 *                 example: EMP001
 *               address:
 *                 type: string
 *                 example: "123 Business St."
 *               hourly_rate:
 *                 type: number
 *                 example: 25.5
 *               slack_username:
 *                 type: string
 *                 example: "john_doe"
 *               joining_date:
 *                 type: string
 *                 format: date
 *                 example: "2025-04-01"
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *               last_date:
 *                 type: string
 *                 format: date
 *               attendance_reminder:
 *                 type: string
 *                 format: date
 *               employment_type:
 *                 type: string
 *                 example: "Full-time"
 *               marital_status:
 *                 type: string
 *                 example: "single"
 *               marriage_anniversary_date:
 *                 type: string
 *                 format: date
 *               probation_end_date:
 *                 type: string
 *                 format: date
 *               contract_end_date:
 *                 type: string
 *                 format: date
 *               internship_end_date:
 *                 type: string
 *                 format: date
 *               notice_period_start_date:
 *                 type: string
 *                 format: date
 *               notice_period_end_date:
 *                 type: string
 *                 format: date
 *               company_address_id:
 *                 type: integer
 *               overtime_hourly_rate:
 *                 type: number
 *               skills:
 *                 type: string
 *                 example: "Node.js, React"
 *     responses:
 *       200:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input or existing user
 *       500:
 *         description: Server error
 */

v1Router.post(
  "/register",
  validateRegister,
  authenticateJWT,
  async (req, res) => {
    console.log("Registering user");
    const transaction = await sequelize.transaction();
    const userId = req.user.id; // Logged-in user ID

    try {
      logger.info("🔵 Registering a new user : " + JSON.stringify(req.body));

      const {
        name,
        email,
        password,
        mobile,
        role_id,
        department_id,
        designation_id,
        reporting_to,
        image,
        country_phonecode,
        country_id,
      } = req.body;

      // Step 1: Validate department_id, designation_id, and role_id
      const department = await Department.findByPk(department_id);
      if (!department) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ status: false, message: "Invalid department_id" });
      }

      const designation = await Designation.findByPk(designation_id);
      if (!designation) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ status: false, message: "Invalid designation_id" });
      }

      const role = await Role.findByPk(role_id);
      if (!role) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ status: false, message: "Invalid role_id" });
      }
      const reportingTo = await User.findByPk(reporting_to);
      if (!reportingTo) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ status: false, message: "Invalid Reporting To" });
      }

      // Step 2: Check if user already exists
      const existingUser = await User.findOne({
        where: { email, company_id: req.user.company_id },
        transaction,
      });

      if (existingUser) {
        logger.info("❌ Email already registered");
        await transaction.rollback();
        return res
          .status(400)
          .json({ status: false, message: "Email already registered" });
      }

      // Step 3: Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Step 4: Insert into UserAuth table
      const newUserAuth = await UserAuth.create(
        { email, password: hashedPassword },
        { transaction }
      );

      logger.info("✅ newUserAuth: " + JSON.stringify(newUserAuth));

      // Step 5: Insert into User table
      const newUser = await User.create(
        {
          name,
          user_auth_id: newUserAuth.id,
          email,
          mobile,
          company_id: req.user.company_id,
          image,
          country_phonecode,
          country_id,
        },
        { transaction }
      );

      logger.info("✅ newUser: " + JSON.stringify(newUser));

      // Step 6: Insert into Employee table
      const {
        employee_id,
        address,
        hourly_rate,
        slack_username,
        joining_date,
        last_date,
        added_by,
        last_updated_by,
        attendance_reminder,
        date_of_birth,
        contract_end_date,
        internship_end_date,
        employment_type,
        marriage_anniversary_date,
        marital_status,
        notice_period_end_date,
        notice_period_start_date,
        probation_end_date,
        company_address_id,
        overtime_hourly_rate,
        skills,
      } = req.body;

      // ✅ Ensure `joining_date` is set properly
      const employee = await Employee.create(
        {
          user_id: newUser.id,
          company_id: req.user.company_id,
          employee_id,
          address,
          hourly_rate,
          slack_username,
          department_id,
          designation_id,
          joining_date: joining_date || new Date(), // ✅ Fix: Set default date if missing
          last_date,
          added_by,
          last_updated_by,
          attendance_reminder,
          date_of_birth,
          contract_end_date,
          internship_end_date,
          employment_type,
          marriage_anniversary_date,
          marital_status,
          notice_period_end_date,
          notice_period_start_date,
          probation_end_date,
          company_address_id,
          overtime_hourly_rate,
          created_at: new Date(),
          created_by: userId,
          updated_at: new Date(),
          skills,
        },
        { transaction }
      );

      logger.info("✅ newEmployee: " + JSON.stringify(employee));

      // Step 7: Assign Role to User
      const [userRole, created] = await UserRole.findOrCreate({
        where: { user_id: newUser.id },
        defaults: { role_id, created_by: userId },
        transaction,
      });

      if (!created) {
        await userRole.update({ role_id, updated_by: userId }, { transaction });
      }

      logger.info("✅ User role assigned");

      // Step 8: Commit transaction
      await transaction.commit();
      logger.info("✅ User Registered Successfully");

      // Step 9: Prepare Email Message
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

      logger.info("📩 Email Payload: " + JSON.stringify(emailPayload));

      // Step 10: Publish Email Task to RabbitMQ
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
      logger.error(`❌ User Register Error: ${error.message}`);

      return res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /user/employees/{userId}:
 *   delete:
 *     summary: Delete an employee (mark user as inactive)
 *     description: Marks a user associated with an employee as inactive instead of deleting from DB.
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the employee to delete
 *     responses:
 *       200:
 *         description: User deleted successfully (marked as inactive)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User deleted successfully
 *                 data:
 *                   type: array
 *                   example: []
 *       404:
 *         description: Employee or user not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Employee details not found
 *                 data:
 *                   type: array
 *                   example: []
 *       500:
 *         description: Server error while deleting employee
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 file:
 *                   type: string
 *                 line:
 *                   type: string
 *                 data:
 *                   type: array
 */

v1Router.delete("/employees/:userId", authenticateJWT, async (req, res) => {
  console.log("Delete user details...");
  const transaction = await sequelize.transaction();
  try {
    const { userId } = req.params;
    const employee = await Employee.findOne({
      where: { id: userId },
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
    const user = await User.findOne({
      where: { id: employee.user_id, company_id: req.user.company_id },
      transaction,
    });
    if (user) {
      await user.update({
        status: "inactive",
        updated_by: req.user.id,
        updated_at: new Date(),
      });
      await transaction.commit();
      return res.status(200).json({
        status: true,
        message: "User deleted successfully",
        data: [],
      });
    } else {
      await transaction.rollback();
      return res.status(404).json({
        status: false,
        message: "User not found",
        data: [],
      });
    }
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
});

/**
 * @swagger
 * /user/employees/{userId}:
 *   put:
 *     summary: Update user and employee details
 *     description: Updates the user and associated employee records, including roles and departments.
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               mobile:
 *                 type: string
 *               role_id:
 *                 type: integer
 *               image:
 *                 type: string
 *               department_id:
 *                 type: integer
 *               designation_id:
 *                 type: integer
 *               employee_id:
 *                 type: string
 *               address:
 *                 type: string
 *               hourly_rate:
 *                 type: number
 *               slack_username:
 *                 type: string
 *               joining_date:
 *                 type: string
 *                 format: date
 *               last_date:
 *                 type: string
 *                 format: date
 *               added_by:
 *                 type: integer
 *               last_updated_by:
 *                 type: integer
 *               attendance_reminder:
 *                 type: boolean
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *               calendar_view:
 *                 type: string
 *               about_me:
 *                 type: string
 *               reporting_to:
 *                 type: integer
 *               contract_end_date:
 *                 type: string
 *                 format: date
 *               internship_end_date:
 *                 type: string
 *                 format: date
 *               employment_type:
 *                 type: string
 *               marriage_anniversary_date:
 *                 type: string
 *                 format: date
 *               marital_status:
 *                 type: string
 *               notice_period_end_date:
 *                 type: string
 *                 format: date
 *               notice_period_start_date:
 *                 type: string
 *                 format: date
 *               probation_end_date:
 *                 type: string
 *                 format: date
 *               company_address_id:
 *                 type: integer
 *               overtime_hourly_rate:
 *                 type: number
 *               skills:
 *                 type: string
 *     responses:
 *       200:
 *         description: User and employee updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User and employee updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                     employee:
 *                       type: object
 *       400:
 *         description: Validation failed (e.g. invalid role or department)
 *       404:
 *         description: User or employee not found
 *       500:
 *         description: Internal server error
 */

v1Router.put("/employees/:userId", authenticateJWT, async (req, res) => {
  console.log("Updating user details...");
  const transaction = await sequelize.transaction();
  try {
    logger.info("🟢 Updating user: " + JSON.stringify(req.body));
    const { userId } = req.params;

    const { name, email, password, mobile, role_id, image } = req.body;

    // Step 1: Validate department_id, designation_id, and role_id
    const department = await Department.findOne({
      where: { id: req.body.department_id },
    });
    if (!department) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid department_id" });
    }

    const designation = await Designation.findOne({
      where: { id: req.body.designation_id },
    });
    if (!designation) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid designation_id" });
    }

    const role = await Role.findOne({ where: { id: role_id } });
    if (!role) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid role_id" });
    }
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
      { name, mobile, image, updated_at: new Date() },
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
      overtime_hourly_rate,
      skills,
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
        overtime_hourly_rate,
        updated_at: new Date(),
        skills,
      },
      { transaction }
    );

    const existingUserRole = await UserRole.findOne({
      where: { user_id: userId },
    });

    if (existingUserRole) {
      // ✅ If user exists, update role_id
      await existingUserRole.update({
        role_id: role_id,
        updated_by: userId,
        updated_at: new Date(),
      });
    } else {
      // 🚀 If user does not exist, insert new record
      const newUserRole = await UserRole.create({
        user_id: userId,
        role_id: role_id,
        created_by: userId,
        created_at: new Date(),
      });
    }

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
});

/**
 * @swagger
 * /user/login:
 *   post:
 *     summary: User login
 *     description: Authenticates user with email and password and returns a JWT token.
 *     tags:
 *       - Auth
 *     security:
 *       - staticTokenAuth: []  # If you're using a static token header for this route
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: yourpassword123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   description: User object returned after successful login
 *       400:
 *         description: Invalid email or password / Missing credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid email or password
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 *                 file:
 *                   type: string
 *                   example: at Object.<anonymous> (/app/routes/auth.js:32:15)
 */

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

      console.log("Generated Token Payload:", {
        id: user.id,
        email: user.email,
        company_id: user.company_id,
      });

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

/**
 * @swagger
 * /user/employees:
 *   get:
 *     summary: Get paginated employee list
 *     description: Retrieves a paginated list of employees with filtering by search term and status.
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Current page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search keyword for name, email, department, role, etc.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by user status
 *     responses:
 *       200:
 *         description: Paginated list of employees with metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 totalRecords:
 *                   type: integer
 *                   example: 100
 *                 totalPages:
 *                   type: integer
 *                   example: 10
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 pageSize:
 *                   type: integer
 *                   example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       employee_id:
 *                         type: string
 *                       user_id:
 *                         type: integer
 *                       employee_name:
 *                         type: string
 *                       image:
 *                         type: string
 *                         format: uri
 *                       department:
 *                         type: string
 *                       designation:
 *                         type: string
 *                       role:
 *                         type: string
 *                       user_status:
 *                         type: string
 *                         enum: [Active, Inactive]
 *                       reporting_manager:
 *                         type: string
 *                 activeEmployees:
 *                   type: integer
 *                   example: 60
 *                 inactiveEmployees:
 *                   type: integer
 *                   example: 40
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal Server Error
 */

v1Router.get("/employees", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status } = req.query;
    const offset = (page - 1) * limit;

    let statusCondition = "";
    let statusReplacement = {};

    if (status) {
      statusCondition = "AND u.status = :status";
      statusReplacement = { status: status.toLowerCase() };
    }

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
          (u.name LIKE :search OR 
          u.email LIKE :search OR 
          d.department_name LIKE :search OR 
          des.name LIKE :search OR 
          r.name LIKE :search) 
          ${statusCondition}`,
      {
        replacements: { search: `%${search}%`, ...statusReplacement },
        type: sequelize.QueryTypes.SELECT,
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
          CASE
          WHEN u.status='inactive' THEN 'Inactive'
          WHEN u.status='active' THEN 'Active'
          END AS user_status,
          rm.name AS reporting_manager
      FROM employee_details e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN role_user ru ON u.id = ru.user_id
      LEFT JOIN roles r ON ru.role_id = r.id
      LEFT JOIN users rm ON e.reporting_to = rm.id
      WHERE 
          (u.name LIKE :search OR 
          u.email LIKE :search OR 
          d.department_name LIKE :search OR 
          des.name LIKE :search OR 
          r.name LIKE :search) 
          ${statusCondition}
      ORDER BY e.employee_id
      LIMIT :limit OFFSET :offset`,
      {
        replacements: {
          search: `%${search}%`,
          limit: parseInt(limit),
          offset: parseInt(offset),
          ...statusReplacement,
        },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const statusCounts = await sequelize.query(
      `SELECT 
          SUM(CASE WHEN u.status = 'active' THEN 1 ELSE 0 END) AS active_count,
          SUM(CASE WHEN u.status = 'inactive' THEN 1 ELSE 0 END) AS inactive_count
      FROM employee_details e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN role_user ru ON u.id = ru.user_id
      LEFT JOIN roles r ON ru.role_id = r.id
      LEFT JOIN users rm ON e.reporting_to = rm.id
      WHERE 
          (u.name LIKE :search OR 
          u.email LIKE :search OR 
          d.department_name LIKE :search OR 
          des.name LIKE :search OR 
          r.name LIKE :search) 
          ${statusCondition}
      ORDER BY e.employee_id`,
      {
        replacements: { search: `%${search}%`, ...statusReplacement },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Extract active and inactive counts from the query result
    const { active_count = 0, inactive_count = 0 } = statusCounts[0];

    res.json({
      success: true,
      totalRecords,
      totalPages,
      currentPage: parseInt(page),
      pageSize: parseInt(limit),
      data: employees,
      activeEmployees: active_count,
      inactiveEmployees: inactive_count,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * @swagger
 * /user/employees/{employeeId}:
 *   get:
 *     summary: Get single employee details
 *     description: Retrieve detailed information about a specific employee using the employee ID.
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique identifier of the employee
 *     responses:
 *       200:
 *         description: Employee detail retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Employee not found
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     user_id:
 *                       type: integer
 *                     employee_id:
 *                       type: string
 *                     address:
 *                       type: string
 *                     department_id:
 *                       type: integer
 *                     designation_id:
 *                       type: integer
 *                     role_id:
 *                       type: integer
 *                     joining_date:
 *                       type: string
 *                       format: date
 *                     last_date:
 *                       type: string
 *                       format: date
 *                     user_name:
 *                       type: string
 *                     user_email:
 *                       type: string
 *                     mobile:
 *                       type: string
 *                     country_phonecode:
 *                       type: string
 *                     country_id:
 *                       type: integer
 *                     image:
 *                       type: string
 *                       format: uri
 *                     user_status:
 *                       type: string
 *                       enum: [Active, Inactive]
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Error message
 */

v1Router.get("/employees/:employeeId", authenticateJWT, async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Raw SQL Query to fetch employee details along with user details
    const employee = await sequelize.query(
      `SELECT 
          e.*, 
          r.role_id,
          u.name AS user_name, 
          u.email AS user_email,
          u.mobile AS mobile,
          u.country_phonecode AS country_phonecode,
          u.country_id AS country_id,
          u.image AS image,
          CASE
          WHEN u.status='inactive' THEN 'Inactive'
          WHEN u.status='active' THEN 'Active'
          END AS user_status
      FROM employee_details e
      JOIN users u ON e.user_id = u.id
      JOIN role_user r ON u.id = r.user_id
      WHERE e.id = :employeeId`,
      {
        replacements: { employeeId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    if (employee.length === 0) {
      return res.json({
        success: true,
        message: "Employee not found",
        data: {}, // Empty object if no employee found
      });
    }

    return res.json({
      success: true,
      data: employee[0], // Returning the first record as an object
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
