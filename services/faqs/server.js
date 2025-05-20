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
import faqs from "../../common/models/faqs.model.js";
import faq_categories from "../../common/models/faqCategories.model .js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());
faqs.belongsTo(faq_categories, { foreignKey: 'faq_category_id', as: 'category' });
faq_categories.hasMany(faqs, { foreignKey: 'faq_category_id', as: 'faqs' });

const v1Router = Router();


// GET single work order by ID


v1Router.post("/faqs", authenticateJWT, async (req, res) => {
  try {
    const { title, description, image,faq_category_id, status } = req.body;
    console.log("req.body", req.body);

    const newfaqs = await faqs.create({
      title,
      description, 
      image,
      faq_category_id, 
      status,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "faqs created successfully",
      data: newfaqs,
    });
  } catch (error) {
    console.error("Error creating faqs:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

v1Router.get("/faqs", authenticateJWT, async (req, res) => {
  try {
    const allFaqs = await faqs.findAll({
      include: [
        {
          model: faq_categories,
          as: 'category',
          attributes: ['name']
        }
      ]
    });

    // 🔁 Flatten result to include only `name` from category
    const formattedFaqs = allFaqs.map(faq => {
      const faqData = faq.toJSON();
      const { category, ...rest } = faqData;
      return {
        ...rest,
        name: category?.name || null, // 👈 only `name`, no nesting
      };
    });

    return res.status(200).json({
      success: true,
      message: "FAQs fetched successfully",
      data: formattedFaqs,
    });
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});




v1Router.get("/faqs/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const faq = await faqs.findByPk(id, {
      include: [
        {
          model: faq_categories,
          as: 'category',
          attributes: ['name']
        }
      ]
    });

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    // 🔁 Flatten result to include only `name` from category
    const faqData = faq.toJSON();
    const { category, ...rest } = faqData;
    const formattedFaq = {
      ...rest,
      name: category?.name || null, // 👈 only `name`, no nesting
    };

    return res.status(200).json({
      success: true,
      data: formattedFaq,
    });
  } catch (error) {
    console.error("Error fetching FAQ:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
     
v1Router.put("/faqs/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image, faq_category_id, status } = req.body;

    const faq = await faqs.findByPk(id);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }
    await faq.update({
      title,
      description,
      image,
      faq_category_id,
      status,
      
      updated_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      data: faq,
    });
  } catch (error) {
    console.error("Error updating FAQ:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
v1Router.delete("/faqs/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const faq = await faqs.findByPk(id);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    await faq.update({
      status: "inactive",
      updated_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "FAQ deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting FAQ:", error);
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
const PORT = 3018;
app.listen(process.env.PORT_FAQS,'0.0.0.0', () => {
  console.log(`Role Service running on port ${PORT}`);
});
