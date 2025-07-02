import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import moment from "moment-timezone";
import Employee from "../../common/models/employee.model.js";

const Company = db.Company;
const User =db.User;
const ProductionSchedule = db.ProductionSchedule;
const ProductionGroup = db.ProductionGroup;


dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();


//post production_schedule
// v1Router.post("/create", authenticateJWT, async (req, res) => {
//   try {
//     const { employee_id, ...restData } = req.body;

//     // Step 1: Generate production schedule ID
//     const production_schedule_generate_id = await generateId(
//       req.user.company_id,
//       ProductionSchedule,
//       "production_schedule"
//     );

//     // Step 2: Validate employee
//     const employee = await Employee.findOne({
//       where: {
//         company_id: req.user.company_id,
//         id: employee_id,
//       },
//       attributes: ["id", "user_id", "company_id"],
//     });

//     if (!employee) {
//       return res.status(404).json({
//         success: false,
//         message: "Employee not found",
//       });
//     }

//     // Step 3: Create production schedule
//     const data = await ProductionSchedule.create({
//       ...restData,
//       employee_id: employee.id,
//       production_schedule_generate_id,
//       user_id: employee.user_id,
//       company_id: req.user.company_id,
//       created_by: req.user.id,
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Production schedule created successfully",
//       data,
//     });
//   } catch (err) {
//     console.error("Error creating production schedule:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to create production schedule",
//       error: err.message,
//     });
//   }
// });

v1Router.post("/create", authenticateJWT, async (req, res) => {
  try {
    const { employee_id, start_time, end_time, ...restData } = req.body;

    // Validate required time fields
    if (!start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: "start_time and end_time are required",
      });
    }

    // Parse and validate date values
    const parsedStartTime = new Date(start_time);
    const parsedEndTime = new Date(end_time);

    if (isNaN(parsedStartTime.getTime()) || isNaN(parsedEndTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format for start_time or end_time",
      });
    }

    // Generate production schedule ID
    const production_schedule_generate_id = await generateId(
      req.user.company_id,
      ProductionSchedule,
      "production_schedule"
    );

    // Validate employee
    const employee = await Employee.findOne({
      where: {
        company_id: req.user.company_id,
        id: employee_id,
      },
      attributes: ["id", "user_id", "company_id"],
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Create the production schedule
    const data = await ProductionSchedule.create({
      ...restData,
      employee_id: employee.id,
      user_id: employee.user_id,
      company_id: req.user.company_id,
      created_by: req.user.id,
      production_schedule_generate_id,
      start_time: parsedStartTime,
      end_time: parsedEndTime,
    });

    return res.status(200).json({
      success: true,
      message: "Production schedule created successfully",
      data,
    });

  } catch (err) {
    console.error("Error creating production schedule:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create production schedule",
      error: err.message,
    });
  }
});




//get all
v1Router.get("/get-all", authenticateJWT, async (req, res) => {
  try {
    const { 
      startDate, endDate, date, month, year, today, thisWeek,thisMonth 
    } = req.query;
    
    let whereCondition = {
      company_id: req.user.company_id,
      status : "active",
    };
    
    // Current date for relative filters
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    
    if (date) {
      whereCondition.date = date;
    } else if (today === 'true') {
      whereCondition.date = currentDate;
    } else if (thisWeek === 'true') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      whereCondition.date = {
        [Op.between]: [
          startOfWeek.toISOString().split('T')[0],
          endOfWeek.toISOString().split('T')[0]
        ]
      };
    } else if (thisMonth === 'true') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      whereCondition.date = {
        [Op.between]: [
          startOfMonth.toISOString().split('T')[0],
          endOfMonth.toISOString().split('T')[0]
        ]
      };
    } else if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      whereCondition.date = {
        [Op.between]: [
          startOfMonth.toISOString().split('T')[0],
          endOfMonth.toISOString().split('T')[0]
        ]
      };
    } else if (year) {
      whereCondition.date = {
        [Op.between]: [`${year}-01-01`, `${year}-12-31`]
      };
    } else if (startDate || endDate) {
      whereCondition.date = {};
      if (startDate) {
        whereCondition.date[Op.gte] = startDate;
      }
      if (endDate) {
        whereCondition.date[Op.lte] = endDate;
      }
    }
    const schedules = await ProductionSchedule.findAll({
      where: whereCondition,
      order: [['id', 'DESC']]
    });
    res.status(200).json({ 
      success: true, 
      data: schedules,
      filters: {
        startDate, endDate, date, month, year, today, thisWeek, thisMonth
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

//get by id
v1Router.get("/get-by-id/:id", authenticateJWT, async (req, res) => {
  try {
    const schedule = await ProductionSchedule.findOne({
      where: {
        id: req.params.id,
        company_id: req.user.company_id,
      }
    });

    if (!schedule) {
      return res.status(404).json({ success: false, message: "Production schedule not found" });
    }

    return res.status(200).json({ success: true, data: schedule });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});


//update
v1Router.put("/update/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const existingSchedule = await ProductionSchedule.findOne({
      where: {
        id,
        company_id: req.user.company_id,
        status: "active"
      }
    });

    if (!existingSchedule) {
      return res.status(404).json({ success: false, message: "Production schedule not found" });
    }
    await existingSchedule.update({
      ...req.body,
      updated_by: req.user.id,
      updated_at: new Date()
    });

    return res.status(200).json({
      success: true,
      message: "Production schedule updated successfully",
      data: existingSchedule
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});



//delete
v1Router.delete("/delete/:id", authenticateJWT, async (req, res) => {
  try {
    const scheduleId=req.params.id;

    if(!scheduleId){
      return res.status(400).json({
        success:false,
        message:"Production schedule id is required"
      })
    }

    const schedule= await ProductionSchedule.findOne({where:{ id:scheduleId }});
    if(!schedule){
          return res.status(404).json({
            success:false,
            message : "Production schedule id is mismatch"
          })
    }
    const deletedSchedule =await ProductionSchedule.update({
        status : "inactive",
        updated_by : req.user.id,
        updated_at : new Date()
    },
    {where:{id:scheduleId}}
    );
    
    if(!deletedSchedule){
      return res.status(404).json({
        success:false,
        message : "Production schedule id is mismatch"
      })
    }
    res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



//mobile
//get employee prodution-schedule
v1Router.get("/employee/schedule", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;
    console.log("Fetching schedule for user:", userId, "in company:", companyId);
    const employee = await Employee.findOne({
      where: {
        user_id: userId,
        company_id: companyId,
      },
      attributes: ['id', 'user_id', 'company_id']
    });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }
    const schedule = await ProductionSchedule.findAll({
      where: {
        employee_id: employee.id, // use employee.id instead of user_id
        company_id: companyId,
      },
    });
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Production schedule not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: schedule,
    });
  } catch (err) {
    console.error("Error fetching production schedule:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching production schedule",
      error: err.message,
    });
  }
});

v1Router.get("/employee/group-schedule", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;

    // Step 1: Find employee by user_id and company_id
    const employee = await Employee.findOne({
      where: {
        user_id: userId,
        company_id: companyId,
      },
      attributes: ['id', 'user_id', 'company_id']
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Step 2: Get all production schedules for the employee
    const schedule = await ProductionSchedule.findAll({
      where: {
        employee_id: employee.id,
        company_id: companyId,
      },
      order: [['start_time', 'ASC']]
    });

    if (!schedule || schedule.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No upcoming production schedule found",
      });
    }

    // Step 3: Extract unique group_ids from schedule
    const groupIds = [...new Set(schedule.map(s => s.group_id))];
        
    console.log("groupIds is :",groupIds);

    // Step 4: Fetch corresponding groups
    const groups = await ProductionGroup.findAll({
      where: {
        company_id: companyId,
        id: groupIds
      }
    });

    // Step 5: Respond with data
    return res.status(200).json({
      success: true,
      groups: groups
    });

  } catch (err) {
    console.error("Error fetching production group schedule:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching production schedule",
      error: err.message,
    });
  }
});

// Get production group by group id
v1Router.get("/group/:id", authenticateJWT, async (req, res) => {
  try {
    const groupId = req.params.id;
    const companyId = req.user.company_id;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: "Group id is required",
      });
    }

    const group = await ProductionGroup.findOne({
      where: {
        id: groupId,
        company_id: companyId,
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Production group not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: group,
    });
  } catch (err) {
    console.error("Error fetching production group by id:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching production group",
      error: err.message,
    });
  }
});






app.use("/api/production-schedule", v1Router);
const PORT = process.env.PORT_PRODUCTION_SCHEDULE;
app.listen(process.env.PORT_PRODUCTION_SCHEDULE,'0.0.0.0', () => {
  console.log(`Production Schedule Service running on port ${process.env.PORT_PRODUCTION_SCHEDULE}`);
});