import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import moment from "moment-timezone";

const Company = db.Company;
const User =db.User;
const ProductionSchedule = db.ProductionSchedule;


dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();


//post production_schedule
v1Router.post("/create", authenticateJWT, async (req, res) => {
  try {
    const production_schedule_generate_id = await generateId(req.user.company_id, ProductionSchedule, "production_schedule");
    const data = await ProductionSchedule.create({
      ...req.body,        
      production_schedule_generate_id: production_schedule_generate_id,             
      company_id: req.user.company_id, 
      created_by: req.user.id, 
    });

    res.status(200).json({ success: true, data: data });
  } catch (err) {
       res.status(500).json({ success: false, error: err.message });
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



//get prodution-schedule
v1Router.get("/employee/schedule", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;

    console.log("Fetching schedule for user:", userId, "in company:", companyId);

    const schedule = await ProductionSchedule.findOne({
      where: {
        employee_id: userId,
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






app.use("/api/production-schedule", v1Router);
const PORT = process.env.PORT_PRODUCTION_SCHEDULE;
app.listen(process.env.PORT_PRODUCTION_SCHEDULE,'0.0.0.0', () => {
  console.log(`Production Schedule Service running on port ${process.env.PORT_PRODUCTION_SCHEDULE}`);
});