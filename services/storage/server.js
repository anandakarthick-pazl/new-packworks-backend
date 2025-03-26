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
app.use("/file/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(json());
app.use(cors());
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "uploads/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

/**
 * 📌 Decode Auth Keys (AWS Credentials)
 */
const decodeAuthKeys = (encodedKeys) => {
  try {
    const decoded = Buffer.from(encodedKeys, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch (error) {
    console.error("Error decoding auth keys:", error);
    return null;
  }
};

const getStorageType = async () => {
  try {
    const setting = await FileStorageSetting.findOne({
      where: { status: "enabled" },
    });

    if (!setting) return { storageType: "local", awsConfig: null };

    const awsConfig = setting.filesystem === "aws_s3" ? decodeAuthKeys(setting.auth_keys) : null;

    return { storageType: setting.filesystem, awsConfig };
  } catch (error) {
    console.error("Error fetching storage setting:", error);
    return { storageType: "local", awsConfig: null };
  }
};
const encodeAuthKeys = (awsConfig) => {
  try {
    const jsonString = JSON.stringify(awsConfig);
    return Buffer.from(jsonString, "utf-8").toString("base64");
  } catch (error) {
    console.error("Error encoding auth keys:", error);
    return null;
  }
};
const v1Router = Router();


// GET single work order by ID
v1Router.post("/save-storage-settings", authenticateJWT, upload.single("file"), async (req, res) => {
  try {
    const { filesystem, aws_access_key, aws_secret_key, aws_region, aws_bucket_name } = req.body;

    // Step 1: Disable all existing storage settings
    await FileStorageSetting.update({ status: "disabled" }, { where: {} });

    // Step 2: Insert new setting based on `filesystem` type
    if (filesystem === "aws_s3") {
      // Encode AWS Credentials
      const encodedAuthKeys = encodeAuthKeys({
        AWS_ACCESS_KEY: aws_access_key,
        AWS_SECRET_KEY: aws_secret_key,
        AWS_REGION: aws_region,
        AWS_BUCKET_NAME: aws_bucket_name,
      });

      if (!encodedAuthKeys) {
        return res.status(500).json({ success: false, message: "Error encoding auth keys" });
      }

      // Insert new AWS S3 setting
      await FileStorageSetting.create({
        filesystem: "aws_s3",
        auth_keys: encodedAuthKeys,
        status: "enabled",
      });

      return res.json({
        success: true,
        message: "AWS credentials saved successfully!",
      });
    } else if (filesystem === "local") {
      // Insert new Local Storage setting
      await FileStorageSetting.create({
        filesystem: "local",
        auth_keys: null,
        status: "enabled",
      });

      return res.json({
        success: true,
        message: "Local Storage Setting saved successfully!",
      });
    }

    return res.status(400).json({ success: false, message: "Invalid filesystem type" });
  } catch (error) {
    console.error("Error saving storage settings:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


v1Router.post("/upload", authenticateJWT, upload.single("file"), async (req, res) => {
  try {
    const { storageType, awsConfig } = await getStorageType();
    const { originalname, mimetype, size } = req.file;
    let fileUrl = "";
    let storageLocation = "local";

    if (storageType === "aws_s3" && awsConfig) {
      // Configure AWS S3 Client
      const s3 = new S3Client({
        region: awsConfig.AWS_REGION,
        credentials: {
          accessKeyId: awsConfig.AWS_ACCESS_KEY,
          secretAccessKey: awsConfig.AWS_SECRET_KEY,
        },
      });

      // Upload to S3
      const fileStream = fs.createReadStream(req.file.path);
      const s3Params = {
        Bucket: awsConfig.AWS_BUCKET_NAME,
        Key: `uploads/${req.file.filename}`,
        Body: fileStream,
        ContentType: mimetype,
      };
      await s3.send(new PutObjectCommand(s3Params));

      // Generate File URL
      fileUrl = `https://${awsConfig.AWS_BUCKET_NAME}.s3.${awsConfig.AWS_REGION}.amazonaws.com/uploads/${req.file.filename}`;
      storageLocation = "aws_s3";

      // Delete local temp file after upload
      fs.unlinkSync(req.file.path);
    } else {
      // Store Locally
      fileUrl = `${process.env.FILE_UPLOAD_URL}/uploads/${req.file.filename}`;
    }

    // Insert into file_storage table
    const newFile = await FileStorage.create({
      company_id: 1,
      path: fileUrl,
      filename: originalname,
      type: mimetype,
      size,
      storage_location: storageLocation,
      created_at: new Date(),
    });

    return res.json({
      success: true,
      message: "File uploaded successfully",
      data: {
        file_id: newFile.id,
        filename: originalname,
        file_url: fileUrl,
        storage: storageLocation,
      },
    });
  } catch (error) {
    console.error("Upload Error:", error);
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
app.use("/api/file", v1Router);
await db.sequelize.sync();
const PORT = 3013;
app.listen(PORT, () => {
  console.log(`File Storage and Setting Service running on port ${PORT}`);
});
