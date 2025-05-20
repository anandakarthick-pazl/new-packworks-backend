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
import Role from "../../common/models/designation.model.js";
import faq_categories from "../../common/models/faqCategories.model .js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();
 let whereCondition = { status: "active" };

v1Router.post("/faq_categories", authenticateJWT, async (req, res) => {
  try {
    const { id,name} = req.body;

    const newfaq_categories = await faq_categories.create({
      id,
      name,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "faq_categories created successfully",
      data: newfaq_categories,
    });
  } catch (error) {
    console.error("Error creating faqs:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.get("/faq_categories", authenticateJWT, async (req, res) => {
  try {
    const faqCategories = await faq_categories.findAll( {where :  whereCondition });

    return res.status(200).json({
      success: true,
      message: "faq_categories fetched successfully",
      data: faqCategories,
    });
  } catch (error) {
    console.error("Error fetching faq_categories:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});



v1Router.put("/faq_categories/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const category = await faq_categories.findOne({ where: { id } });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "FAQ category not found",
      });
    }

    await category.update({
      name,
     
      
      updated_at: new Date(),
    });


    return res.status(200).json({
      success: true,
      message: "FAQ category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error updating FAQ category:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.delete("/faq_categories/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

   

    const category = await faq_categories.findOne({ where: { id } });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "FAQ category not found",
      });
    }

    await category.update({
      status: "inactive",
      updated_at: sequelize.literal("CURRENT_TIMESTAMP"),
    });

    return res.status(200).json({
      success: true,
      message: "FAQ category soft-deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting FAQ category:", error);
    return res.status(500).json({ success: false, error: error.message });
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
const PORT = 3019;
app.listen(process.env.PORT_FAQ_CATEGORIES, '0.0.0.0',() => {
  console.log(`faq_categories Service running on port ${PORT}`);
});
