import amqp from "amqplib";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";

dotenv.config();

const QUEUE_NAME = "client_operations";

async function startConsumer() {
  try {
    // Connect to RabbitMQ
    const connection = await amqp.connect(process.env.RABBITMQ_URL || "amqp://localhost");
    const channel = await connection.createChannel();
    
    // Ensure queue exists
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    
    // Set prefetch count to limit concurrent processing
    channel.prefetch(1);
    
    logger.info(`Consumer waiting for messages in ${QUEUE_NAME} queue`);
    
    // Start consuming messages
    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        try {
          const content = JSON.parse(msg.content.toString());
          logger.info(`Processing message: ${content.operation} for clientId: ${content.clientId}`);
          
          // Process the message based on operation
          switch (content.operation) {
            case "CREATE":
              await processClientCreation(content);
              break;
            default:
              logger.warn(`Unknown operation: ${content.operation}`);
          }
          
          // Acknowledge the message
          channel.ack(msg);
          logger.info(`Message processed successfully`);
        } catch (error) {
          logger.error(`Error processing message: ${error.message}`);
          // Reject the message and requeue
          channel.nack(msg, false, true);
        }
      }
    });
    
    // Handle connection closure
    process.on("SIGINT", async () => {
      await channel.close();
      await connection.close();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error("Error in consumer:", error);
    setTimeout(startConsumer, 5000); // Retry after 5 seconds
  }
}

async function processClientCreation(content) {
  // Implement your business logic here
  // For example: send welcome email, notification, sync with other systems
  logger.info(`Processing client creation for clientId: ${content.clientId}`);
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 500));

  logger.info(`Client creation processing completed for clientId: ${content.clientId}`);
}

// Start the consumer
startConsumer().catch(err => {
  logger.error("Failed to start consumer:", err);
  process.exit(1);
});