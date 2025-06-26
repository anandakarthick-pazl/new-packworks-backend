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


//post
v1Router.post("/create", authenticateJWT, async (req, res) => {
  try {
    const data = await ProductionSchedule.create({
      ...req.body,                     
      company_id: req.user.company_id  
    });

    res.status(200).json({ success: true, data: data });
  } catch (err) {
       res.status(500).json({ success: false, error: err.message });
  }
});

//get
v1Router.get("/get-all", authenticateJWT, async (req, res) => {
  try {
     const schedules = await ProductionSchedule.findAll({
      where: {
        company_id: req.user.company_id
      }
    });    res.status(200).json({ success: true, data: schedules });
  } catch (err) {
       res.status(500).json({ success: false, error: err.message });
  }
});

//get by id
v1Router.get("/get-by-id/:id", authenticateJWT, async (req, res) => {
   try {
    const schedule = await ProductionSchedule.findByPk(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: schedule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

//update
v1Router.put("/update/:id", authenticateJWT, async (req, res) => {
  try {
    const [updated] = await ProductionSchedule.update(req.body, {
      where: { id: req.params.id },
    });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    const updatedSchedule = await ProductionSchedule.findByPk(req.params.id);
    res.status(200).json({ success: true, data: updatedSchedule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


//delete
v1Router.delete("/delete/:id", authenticateJWT, async (req, res) => {
  try {
    const deleted = await ProductionSchedule.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});






app.use("/api/production-schedule", v1Router);
// await db.sequelize.sync();
const PORT = process.env.PORT_PRODUCTIONPLANING;
app.listen(process.env.PORT_PRODUCTIONPLANING,'0.0.0.0', () => {
  console.log(`Production Schedule Service running on port ${process.env.PORT_PRODUCTIONPLANING}`);
});