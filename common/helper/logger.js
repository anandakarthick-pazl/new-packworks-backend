import winston from "winston";
import "winston-daily-rotate-file";
import fs from "fs";
import path from "path";

// 🔹 Create 'logs' folder if not exists
const logDir = "logs";
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// 🔹 Define Daily Rotate File Transport
const dailyRotateTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDir, "app-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    zippedArchive: false, // Set to true if you want zipped logs
    maxSize: "200m", // Max size per log file
    maxFiles: "90d" // Keep logs for 30 days
});

// 🔹 Define Error Log Transport
const errorRotateTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDir, "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    level: "error", // Only store error logs
    zippedArchive: false,
    maxSize: "1000m",
    maxFiles: "90d"
});

// 🔹 Define Winston Logger
const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
    ),
    transports: [
        new winston.transports.Console(), // Logs to console
        dailyRotateTransport, // Logs daily
        errorRotateTransport // Separate error logs
    ]
});

export default logger;
