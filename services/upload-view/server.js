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
import FileStorage from "../../common/models/fileStorage.model.js";
import FileStorageSetting from "../../common/models/fileStorageSetting.model.js";
import Company from "../../common/models/company.model.js";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use("/api/upload", express.static(path.join(process.cwd(), "uploads")));
app.use(json());
app.use(cors());


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
// app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3015;
app.listen(process.env.PORT_FILE_VIEW, '0.0.0.0', () => {
  console.log(`File view and Setting Service running on port ${PORT}`);
});
