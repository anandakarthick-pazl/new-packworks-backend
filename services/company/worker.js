import sequelize from "../../common/database/database.js"; // Adjust based on your project structure
import amqp from "amqplib";
import dotenv from "dotenv";
import { sendEmail } from "../../common/helper/emailService.js";
dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL; // Update if needed
const QUEUE_NAME = process.env.COMPANY_QUEUE_NAME;

const processCompanyTasks = async (companyId) => {
  try {
    console.log(`⚙️ Processing Company ID: ${companyId}`);

    // 🔹 Step 1: Copy Email Notification Settings
    await sequelize.query("CALL CopyEmailNotificationSettings(:companyId)", {
      replacements: { companyId },
    });
    console.log(`✅ Email notifications copied for Company ID: ${companyId}`);

    // 🔹 Step 2: Copy Module Settings
    await sequelize.query("CALL ProcedureCopyModuleSettings(:companyId)", {
      replacements: { companyId },
    });
    console.log(`✅ Module settings copied for Company ID: ${companyId}`);

    // 🔹 Step 3: Copy Roles and Permissions
    await sequelize.query("CALL ProcedureCopyRolesAndPermissions(:companyId)", {
      replacements: { companyId },
    });
    console.log(`✅ Roles and permissions copied for Company ID: ${companyId}`);

    console.log(`🎉 All tasks completed for Company ID: ${companyId}`);

    const companyData = await sequelize.query(
      "SELECT name, email FROM Company WHERE id = :companyId",
      {
        replacements: { companyId },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    if (!companyData) {
      console.error(`❌ No company found with ID: ${companyId}`);
      return;
    }

    // 🔹 Step 5: Send Email to Super Admin
    const superAdminSubject = `🚀 New Company Onboarded: ${companyData.name}`;
    const superAdminBody = `
            <h2>Super Admin Notification</h2>
            <p>A new company <strong>${companyData.name}</strong> has been successfully onboarded.</p>
            <p>Company Email: ${companyData.email}</p>
            <p>Company ID: ${companyId}</p>
        `;

    await sendEmail(SUPER_ADMIN_EMAIL, superAdminSubject, superAdminBody);
    console.log(
      `📩 Notification email sent to Super Admin: ${SUPER_ADMIN_EMAIL}`
    );

    // 🔹 Step 6: Send Welcome Email to the New Company
    const companySubject = `🎉 Welcome to Our Platform, ${companyData.name}!`;
    const companyBody = `
            <h2>Hello ${companyData.name},</h2>
            <p>Welcome to our platform! Your account has been created successfully.</p>
            <p><strong>Email:</strong> ${companyData.email}</p>
            <p>Please log in and set up your profile.</p>
        `;

    await sendEmail(companyData.email, companySubject, companyBody);
    console.log(`📩 Welcome email sent to ${companyData.email}`);
  } catch (error) {
    console.error(
      `❌ Error processing Company ID ${companyId}:`,
      error.message
    );
  }
};

const startWorker = async () => {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    console.log(`🚀 Worker listening on queue: ${QUEUE_NAME}`);

    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const { companyId } = JSON.parse(msg.content.toString());
        await processCompanyTasks(companyId);
        channel.ack(msg); // Acknowledge message after processing
      }
    });
  } catch (error) {
    console.error("❌ RabbitMQ Worker Error:", error.message);
  }
};

startWorker();
