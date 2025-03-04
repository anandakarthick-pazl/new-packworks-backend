import Redis from "ioredis";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";

dotenv.config();

// Redis Configuration
const redisClient = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || "",
});

redisClient.on("error", (err) => {
  logger.error("Redis Client Error", err);
});

redisClient.on("connect", () => {
  logger.info("Redis Client Connected");
});

// Helper function to clear Redis cache
export async function clearClientCache() {
  try {
    const keys = await redisClient.keys("client:*");
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info("Client cache cleared");
    }
  } catch (error) {
    logger.error("Error clearing Redis cache", error);
  }
}

// Graceful shutdown helper
export function closeRedisConnection() {
  return redisClient.quit();
}

export { redisClient };
export default redisClient;