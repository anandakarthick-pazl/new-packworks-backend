import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import express, { json, Router } from "express";
import cors from "cors";
import { authenticateJWT } from "../../common/middleware/auth.js";

const Categories = db.Categories;
const Sub_categories = db.Sub_categories;
const Company = db.Company;
const User =db.User;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();

// Create category
v1Router.post("/sub-category", authenticateJWT, async (req, res) => {
  try {
    const category = await Categories.findOne({
    where: {
        id: req.body.category_id,
        status: "active"
    }
    });

    if (!category) {
    return res.status(400).json({ message: "Invalid category_id or category is inactive" });
    }
    if (!category) {
      return res.status(400).json({ error: "Invalid category_id: Category not found." });
    }
    const currentDelhiTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    
    const newSubcategory = {
      ...req.body,
      created_by: req.user.id,
      updated_by: req.user.id,
      company_id: req.user.company_id,
      created_at: currentDelhiTime,
      updated_at: currentDelhiTime,
    };

    const subcategory = await Sub_categories.create(newSubcategory);
    res.status(201).json(subcategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Get categories with pagination and search
v1Router.get("/sub-category", authenticateJWT, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const offset = (page - 1) * limit;

    const { rows, count } = await Sub_categories.findAndCountAll({
      where: {
        // is_visible: 1,
        sub_category_name: {
          [Op.like]: `%${search}%`,
        },
      },
      offset,
      limit,
      order: [["created_at", "DESC"]],
    });

    res.json({
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get category by ID
v1Router.get("/sub-category/:id", authenticateJWT, async (req, res) => {
  try {
    const subcategory = await Sub_categories.findByPk(req.params.id);
    if (!subcategory) return res.status(404).json({ message: "Subcategory not found" });
    res.json(subcategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Update category
v1Router.put("/sub-category/:id", authenticateJWT, async (req, res) => {
  try {
    const subcategory = await Sub_categories.findByPk(req.params.id);
    if (!subcategory) return res.status(404).json({ message: "Subcategory not found" });

    const currentDelhiTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

    await subcategory.update({
      ...req.body,
      updated_by: req.user.id,
      updated_at: currentDelhiTime,
    });

    res.json(subcategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Delete category
v1Router.delete("/sub-category/:id", authenticateJWT, async (req, res) => {
  try {
    const subcategory = await Sub_categories.findByPk(req.params.id);
    if (!subcategory) return res.status(404).json({ message: "Subcategory not found" });

    // Soft delete by updating status to 'inactive'
    await subcategory.update({ status: "inactive" });

    res.json({ message: "Subcategory soft deleted (status set to inactive)" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = process.env.PORT_SUB_CATEGORY;
app.listen(process.env.PORT_SUB_CATEGORY,'0.0.0.0', () => {
  console.log(`Purchase running on port ${process.env.PORT_SUB_CATEGORY}`);
});
