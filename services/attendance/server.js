import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import redisClient, { clearClientCache } from "../../common/helper/redis.js";
import {
  publishToQueue,
  rabbitChannel,
  closeRabbitMQConnection,
} from "../../common/helper/rabbitmq.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import User from "../../common/models/user.model.js";
import Company from "../../common/models/company.model.js";
import Attendance from "../../common/models/attendance.model.js";
import Department from "../../common/models/department.model.js";
import Role from "../../common/models/designation.model.js";
import CompanyAddress from "../../common/models/companyAddress.model.js";
import EmployeeDetail from "../../common/models/employee.model.js";




dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();
Attendance.belongsTo(User, { foreignKey: "user_id" });
User.belongsTo(Department, { foreignKey: "department_id" });
Attendance.belongsTo(CompanyAddress, { foreignKey: "location_id" });

// GET single work order by ID


// v1Router.post("/attendance", authenticateJWT, async (req, res) => {
//   try {
//     const { location_id, clock_in_time, clock_out_time , department_id,user_id} = req.body;

//     if (!department_id || !Array.isArray(department_id) || department_id.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "department_id must be a non-empty array",
//       });
//     }
//     const departments = await Department.findAll({
//       attributes: ['id'],
//       where: {
//         id: department_id,
//       },
//       raw: true
//     });

//     const foundIds = departments.map(dep => dep.id);

//     const missingIds = department_id.filter(id => !foundIds.includes(id));


//     if (missingIds.length > 0) {
//       return res.status(404).json({
//         success: false,
//         message: `Department IDs not found: ${missingIds.join(", ")}`,
//       });
//     }




//        const employees = await EmployeeDetail.findAll({
//       attributes: ["user_id", "department_id"],
//       raw: true,
//       where: {
//         department_id: department_id,
//         company_id: req.user.company_id,

//         user_id: user_id,
//         user_id: { [Op.ne]: req.user.id }, // Exclude the current user


//       },
//     });




//         // Prepare attendance entries
//     const attendanceData = employees.map(emp => ({
//        company_id: req.user.company_id,
//        user_id: emp.user_id,
//        location_id,
//        clock_in_time,
//        clock_out_time,
//        clock_in_ip: req.ip,
//        clock_out_ip: req.ip,
//        created_by: req.user.id,
//        created_at: new Date(),
//        department_id,
//        user_id: emp.user_id,
//      }));

//      // Create attendance for all users
//    const newAttendance = await Attendance.bulkCreate(attendanceData);

//     return res.status(201).json({
//       success: true,
//       message: "Attendance created successfully",
//       already_logged_in: alreadyLoggedIn.map(u => u.user_id),

//       data: newAttendance,
//     });
//   } catch (error) {
//     console.error("Error creating Attendance:", error);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// });


v1Router.post("/attendance", authenticateJWT, async (req, res) => {
  try {
    const { location_id, clock_in_time, clock_out_time, department_id, user_id } = req.body;
    if (department_id && (Array.isArray(department_id) && department_id.length !== 0)) {

      let employees = await EmployeeDetail.findAll({
        attributes: ["user_id", "department_id"],
        raw: true,
        where: {
          department_id,
          company_id: req.user.company_id,

        },
      });
      const attendanceData = employees.map(emp => ({
        company_id: req.user.company_id,
        user_id: emp.user_id,
        location_id,
        clock_in_time,
        clock_out_time,
        clock_in_ip: req.ip,
        clock_out_ip: req.ip,
        created_by: req.user.id,
        created_at: new Date(),
        department_id: emp.department_id,
      }));
      // Bulk create attendance
      const created = await Attendance.bulkCreate(attendanceData);

    }
    if (user_id && (Array.isArray(user_id) && user_id.length !== 0)) {

      let employees = await EmployeeDetail.findAll({
        attributes: ["user_id","department_id"],
        raw: true,
        where: {
          user_id,
          company_id: req.user.company_id,
         
        },
      });
      const attendanceData = employees.map(emp => ({
          company_id: req.user.company_id,
          user_id: emp.user_id,
          location_id,
          clock_in_time,
          clock_out_time,
          clock_in_ip: req.ip,
          clock_out_ip: req.ip,
          created_by: req.user.id,
          created_at: new Date(),
          // department_id: emp.department_id,
        }));
        // Bulk create attendance
        const created = await Attendance.bulkCreate(attendanceData);

    }

    return res.status(201).json({
      success: true,
      message: "Attendance created successfully"
    });
  } catch (error) {
    console.error("Error creating Attendance:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});



v1Router.get("/attendance", authenticateJWT, async (req, res) => {
  try {
    const { department_id, user_id } = req.query;

    let whereClause = {
      company_id: req.user.company_id
    };

    if (department_id) {
      whereClause.department_id = department_id;
    }

    if (user_id) {
      whereClause.user_id = user_id;
    }

    const attendanceRecords = await Attendance.findAll({
      attributes: {
        exclude: ['created_by', 'updated_by', 'created_at', 'updated_at']
      },
      where: whereClause,
      raw: true
    });

    return res.status(200).json({
      success: true,
      data: attendanceRecords
    });
  } catch (error) {
    console.error("Error fetching Attendance:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


v1Router.get("/attendance/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findOne({
      where: {
        id,
        company_id: req.user.company_id
      },
      attributes: {
        exclude: ['created_by', 'updated_by', 'created_at', 'updated_at']
      },
      raw: true
    });

    if (!attendance) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }

    return res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    console.error("Error fetching attendance by ID:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.put("/attendance/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { location_id, clock_in_time, clock_out_time } = req.body;

    const attendance = await Attendance.findOne({
      where: {
        id,
        company_id: req.user.company_id
      }
    });

    if (!attendance) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }

    await attendance.update({
      location_id,
      clock_in_time,
      clock_out_time,
      updated_by: req.user.id,
      updated_at: new Date()
    });

    return res.status(200).json({
      success: true,
      message: "Attendance updated successfully"
    });
  } catch (error) {
    console.error("Error updating attendance:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


v1Router.delete("/attendance/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findOne({
      where: {
        id,
        company_id: req.user.company_id,
        status: "active", // Only delete active records
      },
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found or already inactive",
      });
    }

    await attendance.update({
      status: "inactive",
      updated_by: req.user.id,
      updated_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Attendance record marked as inactive successfully",
      data: [],
    });
  } catch (error) {
    console.error("Error updating attendance status:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});










// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
    redis: redisClient.status === "ready" ? "connected" : "disconnected",
    rabbitmq: rabbitChannel ? "connected" : "disconnected",
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await redisClient.quit();
  await closeRabbitMQConnection();
  process.exit(0);
});

// Use Version 1 Router
app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3026;
app.listen(process.env.PORT_ATTENDANCE,'0.0.0.0', () => {
  console.log(`attendance Service running on port ${PORT}`);
});
