import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// ✅ Configure Email Transport
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * ✅ Send Email Function
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlBody - HTML email content
 * @param {Array} attachments - Optional email attachments
 */
export const sendEmail = async (to, subject, htmlBody, attachments = []) => {
    console.log(`📩 Email sending to ${to}`);
    try {
        const mailOptions = {
             from: {
                    name: process.env.FROM_NAME || 'PackWorkX',
                    address: process.env.FROM_EMAIL || process.env.SMTP_USER
                },
            // from: process.env.FROM_EMAIL, // Sender email
            to, // Recipient
            subject, // Email subject
            html: htmlBody // Email content in HTML format
        };

        // Add attachments if provided
        if (attachments && attachments.length > 0) {
            mailOptions.attachments = attachments;
            console.log(`📎 Email has ${attachments.length} attachment(s)`);
        }

        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log(`📩 Email sent successfully to ${to}: ${info.messageId}`);
        return { success: true, message: "Email sent successfully", messageId: info.messageId };
    } catch (error) {
        console.error("❌ Error sending email:", error);
        return { success: false, message: "Error sending email", error };
    }
};
