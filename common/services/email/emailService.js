import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import logger from '../../helper/logger.js';

dotenv.config();

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER, // Your email
                pass: process.env.SMTP_PASS  // Your email password or app password
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // Verify connection configuration
        this.transporter.verify((error, success) => {
            if (error) {
                logger.error('Email configuration error:', error);
            } else {
                logger.info('Email server is ready to send messages');
            }
        });
    }

    /**
     * Send email with template
     * @param {Object} emailData - Email configuration
     * @param {string} emailData.to - Recipient email
     * @param {string} emailData.subject - Email subject
     * @param {string} emailData.html - HTML content
     * @param {string} emailData.text - Plain text content (optional)
     * @param {Array} emailData.attachments - Attachments (optional)
     */
    async sendEmail(emailData) {
        try {
            const mailOptions = {
                from: {
                    name: process.env.FROM_NAME || 'PackWorkX',
                    address: process.env.FROM_EMAIL || process.env.SMTP_USER
                },
                to: emailData.to,
                subject: emailData.subject,
                html: emailData.html,
                text: emailData.text || '',
                attachments: emailData.attachments || []
            };

            const result = await this.transporter.sendMail(mailOptions);
            logger.info(`Email sent successfully to ${emailData.to}`, { messageId: result.messageId });
            return {
                success: true,
                messageId: result.messageId,
                message: 'Email sent successfully'
            };
        } catch (error) {
            logger.error('Failed to send email:', {
                error: error.message,
                to: emailData.to,
                subject: emailData.subject
            });
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    /**
     * Send bulk emails
     * @param {Array} emailList - Array of email data objects
     */
    async sendBulkEmails(emailList) {
        const results = [];
        
        for (const emailData of emailList) {
            try {
                const result = await this.sendEmail(emailData);
                results.push({
                    to: emailData.to,
                    status: 'success',
                    result
                });
            } catch (error) {
                results.push({
                    to: emailData.to,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * Send company registration notification emails
     * @param {Object} companyData - Company information
     * @param {Object} userData - User information
     */
    async sendCompanyRegistrationEmails(companyData, userData) {
        try {
            const { CompanyWelcomeTemplate } = await import('./templates/companyWelcome.js');
            const { AdminNotificationTemplate } = await import('./templates/adminNotification.js');

            // Prepare email data
            const userEmailData = {
                to: userData.email,
                subject: `Welcome to PackWorkX - ${companyData.name}`,
                html: CompanyWelcomeTemplate({
                    companyName: companyData.name,
                    userName: userData.name,
                    userEmail: userData.email,
                    username: userData.username || userData.email,
                    password: userData.password || "123456",
                    loginUrl: process.env.FRONTEND_URL + '/login',
                    supportEmail: process.env.SUPPORT_EMAIL || 'support@packworkx.com',
                    dashboardUrl: process.env.FRONTEND_URL + '/dashboard'
                })
            };

            const adminEmailData = {
                to: process.env.ADMIN_EMAIL || 'admin@packworkx.com',
                subject: `New Company Registration - ${companyData.name}`,
                html: AdminNotificationTemplate({
                    companyName: companyData.name,
                    companyEmail: companyData.email,
                    companyPhone: companyData.phone,
                    companyWebsite: companyData.website,
                    userName: userData.name,
                    userEmail: userData.email,
                    registrationDate: new Date().toLocaleDateString(),
                    adminPanelUrl: process.env.ADMIN_PANEL_URL || process.env.FRONTEND_URL + '/admin'
                })
            };

            // Send emails
            const results = await this.sendBulkEmails([userEmailData, adminEmailData]);
            
            return {
                success: true,
                results,
                message: 'Company registration emails sent successfully'
            };
        } catch (error) {
            logger.error('Failed to send company registration emails:', error);
            throw error;
        }
    }
}

// Export singleton instance
export default new EmailService();
