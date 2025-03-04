import amqp from "amqplib";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";

dotenv.config();

// RabbitMQ Configuration
let rabbitChannel = null;
const QUEUE_NAME = "client_operations";

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://localhost"
    );
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertQueue(QUEUE_NAME, { durable: true });
    logger.info("RabbitMQ Connected");
  } catch (error) {
    logger.error("RabbitMQ Connection Error", error);
    setTimeout(connectRabbitMQ, 5000); // Retry after 5 seconds
  }
}

// Initialize connection
connectRabbitMQ();

// Helper function to publish message to RabbitMQ
export async function publishToQueue(message) {
  try {
    if (rabbitChannel) {
      rabbitChannel.sendToQueue(
        QUEUE_NAME,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
        }
      );
      logger.info("Message published to RabbitMQ");
    } else {
      logger.error("RabbitMQ channel not available");
    }
  } catch (error) {
    logger.error("Error publishing to RabbitMQ", error);
  }
}

// Graceful shutdown helper
export function closeRabbitMQConnection() {
  return rabbitChannel ? rabbitChannel.close() : Promise.resolve();
}

export { rabbitChannel, QUEUE_NAME };