import { BaseEmailTemplate } from './baseTemplate.js';

/**
 * Contact form customer confirmation email template
 * @param {Object} data - Template data
 * @param {string} data.name - Customer's name
 * @param {string} data.email - Customer's email
 * @param {string} data.company - Customer's company
 * @param {string} data.subject - Message subject
 * @param {string} data.message - Customer's message
 * @param {string} data.messageId - Message ID for reference
 * @param {string} data.submissionTime - Submission timestamp
 */
export const ContactFormCustomerTemplate = (data) => {
    const content = `
        <!-- Confirmation Header -->
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #e67e22; font-size: 28px; margin: 0 0 10px 0;">
                📧 Message Received!
            </h1>
            <p style="color: #6c757d; font-size: 16px; margin: 0;">
                Thank you for contacting PackWorkX. We've received your message.
            </p>
        </div>

        <!-- Confirmation Details -->
        <div style="background-color: #d4edda; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #28a745; border: 1px solid #c3e6cb;">
            <h2 style="color: #155724; font-size: 20px; margin: 0 0 15px 0;">
                ✅ Your Message Has Been Received
            </h2>
            <p style="color: #155724; font-size: 14px; margin: 0 0 10px 0;">
                <strong>Message ID:</strong> #${data.messageId || 'MSG-' + Date.now()}
            </p>
            <p style="color: #155724; font-size: 14px; margin: 0;">
                We typically respond to messages within <strong>24 hours</strong> during business days.
            </p>
        </div>

        <!-- Message Summary -->
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #e67e22;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 15px 0;">
                📋 Your Message Details
            </h2>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px; width: 25%;">
                        <strong>Name:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 500;">
                        ${data.name}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>Email:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px;">
                        ${data.email}
                    </td>
                </tr>
                ${data.company ? `
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>Company:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px;">
                        ${data.company}
                    </td>
                </tr>
                ` : ''}
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>Subject:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 500;">
                        ${data.subject}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>Submitted:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px;">
                        ${data.submissionTime || new Date().toLocaleString()}
                    </td>
                </tr>
            </table>
        </div>

        <!-- Message Content -->
        <div style="background-color: #e8f5e8; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #28a745; border: 1px solid #c3e6cb;">
            <h2 style="color: #155724; font-size: 20px; margin: 0 0 15px 0;">
                💬 Your Message
            </h2>
            <div style="background-color: white; padding: 20px; border-radius: 6px; border: 1px solid #c3e6cb;">
                <p style="color: #333; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">
"${data.message}"
                </p>
            </div>
        </div>

        <!-- What Happens Next -->
        <div style="margin-bottom: 30px;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 20px 0;">
                📅 What Happens Next?
            </h2>
            
            <div style="margin-bottom: 20px;">
                <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #e67e22;">
                    <h3 style="color: #e67e22; font-size: 16px; margin: 0 0 8px 0;">
                        1. 👀 We Review Your Message
                    </h3>
                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                        Our team will carefully review your message and determine the best person to help you.
                    </p>
                </div>
                
                <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #e67e22;">
                    <h3 style="color: #e67e22; font-size: 16px; margin: 0 0 8px 0;">
                        2. 📞 We'll Contact You
                    </h3>
                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                        You'll receive a personalized response from our team within 24 hours during business days.
                    </p>
                </div>
                
                <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #e67e22;">
                    <h3 style="color: #e67e22; font-size: 16px; margin: 0 0 8px 0;">
                        3. 💡 We Provide Solutions
                    </h3>
                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                        Our experts will work with you to address your needs and provide the best solutions.
                    </p>
                </div>
            </div>
        </div>

        <!-- Quick Links -->
        <div style="background: linear-gradient(135deg, #e67e22 0%, #d35400 100%); padding: 25px; border-radius: 8px; margin: 30px 0; color: white; text-align: center;">
            <h2 style="color: white; font-size: 20px; margin: 0 0 15px 0;">
                🚀 Explore PackWorkX
            </h2>
            <p style="color: white; font-size: 14px; margin: 0 0 20px 0; opacity: 0.9;">
                While you wait for our response, explore what PackWorkX can do for your business
            </p>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 20px;">
                <div style="flex: 1; min-width: 150px; text-align: center; margin: 10px 0;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📦</div>
                    <strong style="display: block; margin-bottom: 5px;">Order Management</strong>
                    <small style="opacity: 0.9;">Streamline your orders</small>
                </div>
                <div style="flex: 1; min-width: 150px; text-align: center; margin: 10px 0;">
                    <div style="font-size: 24px; margin-bottom: 8px;">🏭</div>
                    <strong style="display: block; margin-bottom: 5px;">Production Planning</strong>
                    <small style="opacity: 0.9;">Optimize manufacturing</small>
                </div>
                <div style="flex: 1; min-width: 150px; text-align: center; margin: 10px 0;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📊</div>
                    <strong style="display: block; margin-bottom: 5px;">Business Analytics</strong>
                    <small style="opacity: 0.9;">Data-driven insights</small>
                </div>
            </div>
        </div>

        <!-- Urgent Contact -->
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #ffc107; border: 1px solid #ffeaa7;">
            <h3 style="color: #856404; font-size: 16px; margin: 0 0 10px 0;">
                ⚡ Need Immediate Assistance?
            </h3>
            <p style="color: #856404; font-size: 14px; margin: 0 0 10px 0;">
                If your inquiry is urgent, you can reach us directly:
            </p>
            <div style="text-align: center;">
                <a href="tel:+15551234567" style="color: #856404; text-decoration: none; font-weight: 500; margin-right: 20px;">
                    📞 +1 (555) 123-4567
                </a>
                <a href="mailto:support@packworkx.com" style="color: #856404; text-decoration: none; font-weight: 500;">
                    📧 support@packworkx.com
                </a>
            </div>
        </div>

        <!-- Support Information -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <h3 style="color: #2c3e50; font-size: 18px; margin: 0 0 15px 0;">
                💬 Additional Resources
            </h3>
            <p style="color: #6c757d; font-size: 14px; margin: 0 0 15px 0; line-height: 1.5;">
                Need answers right away? Check out our help resources:
            </p>
            <div>
                <a href="${process.env.FRONTEND_URL || 'https://packworkx.com'}/help" style="color: #e67e22; text-decoration: none; font-weight: 500; margin: 0 15px;">
                    📖 Help Center
                </a>
                <a href="${process.env.FRONTEND_URL || 'https://packworkx.com'}/faq" style="color: #e67e22; text-decoration: none; font-weight: 500; margin: 0 15px;">
                    ❓ FAQ
                </a>
                <a href="${process.env.FRONTEND_URL || 'https://packworkx.com'}/demo" style="color: #e67e22; text-decoration: none; font-weight: 500; margin: 0 15px;">
                    🎯 Request Demo
                </a>
            </div>
        </div>

        <!-- Footer Message -->
        <div style="border-top: 1px solid #e9ecef; padding-top: 25px; text-align: center;">
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0;">
                Thank you for reaching out to us, <strong>${data.name}</strong>! We appreciate your interest in PackWorkX 
                and look forward to helping you streamline your corrugated box manufacturing operations.
            </p>
            <p style="color: #6c757d; font-size: 14px; margin: 15px 0 0 0;">
                Best regards,<br>
                <strong style="color: #e67e22;">The PackWorkX Team</strong>
            </p>
        </div>
    `;

    return BaseEmailTemplate({
        title: `Message Received - PackWorkX`,
        content,
        preheader: `Thank you ${data.name}! We've received your message about "${data.subject}" and will respond within 24 hours.`
    });
};
