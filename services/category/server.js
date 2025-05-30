import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import express, { json, Router } from "express";
import cors from "cors";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";

const Categories = db.Categories;
const Company = db.Company;
const User =db.User;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();

// Create category
v1Router.post("/category", authenticateJWT, async (req, res) => {
  try {
    // Merge user-related fields into the request body before create
        const category_generate_id = await generateId(req.user.company_id, Categories, "CAT");
    
    const newCategoryData = {
      ...req.body,
      category_generate_id: category_generate_id,
      created_by: req.user.id,
      updated_by: req.user.id,
      company_id: req.user.company_id,
    };

    const category = await Categories.create(newCategoryData);

    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Get categories with pagination and search
v1Router.get("/category", authenticateJWT, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const offset = (page - 1) * limit;

    const { rows, count } = await Categories.findAndCountAll({
      where: {
        // is_visible: 1,
        category_name: {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get category by ID
v1Router.get("/category/:id", authenticateJWT, async (req, res) => {
  try {
    const category = await Categories.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update category
v1Router.put("/category/:id", authenticateJWT, async (req, res) => {
  try {
    const category = await Categories.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    // Prepare updated data, merging req.body with audit fields
    const updatedData = {
      ...req.body,
      updated_by: req.user.id,
      company_id: req.user.company_id,
    };

    await category.update(updatedData);
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Delete category
v1Router.delete("/category/:id", authenticateJWT, async (req, res) => {
  try {
    const category = await Categories.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    // Soft delete: update status to 'inactive'
    await category.update({ status: "inactive" });

    res.json({ message: "Category soft deleted (status set to inactive)" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = process.env.PORT_CATEGORY;
app.listen(process.env.PORT_CATEGORY,'0.0.0.0', () => {
  console.log(`Purchase running on port ${process.env.PORT_CATEGORY}`);
});
