import amqp from "amqplib";
import { sendEmail } from "../../common/helper/emailService.js";
import dotenv from "dotenv";

dotenv.config();
const RABBITMQ_URL = process.env.RABBITMQ_URL;
const EMAIL_QUEUE = process.env.USER_QUEUE_NAME;

const startWorker = async () => {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(EMAIL_QUEUE, { durable: true });

        console.log(`🚀 Email Worker listening on queue: ${EMAIL_QUEUE}`);

        channel.consume(EMAIL_QUEUE, async (msg) => {
            if (msg !== null) {
                const { to, subject, body } = JSON.parse(msg.content.toString());

                console.log(`📨 Processing email for ${to}`);
                await sendEmail(to, subject, body);

                channel.ack(msg); // Acknowledge message after sending email
            }
        });

    } catch (error) {
        console.error("❌ Email Worker Error:", error.message);
    }
};

startWorker();
