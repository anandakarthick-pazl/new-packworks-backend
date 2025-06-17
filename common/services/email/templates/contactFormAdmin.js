import { BaseEmailTemplate } from './baseTemplate.js';

/**
 * Contact form admin notification email template
 * @param {Object} data - Template data
 * @param {string} data.name - Customer's name
 * @param {string} data.email - Customer's email
 * @param {string} data.company - Customer's company
 * @param {string} data.subject - Message subject
 * @param {string} data.message - Customer's message
 * @param {string} data.messageId - Message ID for reference
 * @param {string} data.submissionTime - Submission timestamp
 * @param {string} data.ipAddress - Customer IP address
 * @param {string} data.userAgent - Customer user agent
 * @param {string} data.priority - Message priority
 */
export const ContactFormAdminTemplate = (data) => {
    const content = `
        <!-- Alert Header -->
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc3545; font-size: 28px; margin: 0 0 10px 0;">
                📨 New Contact Message
            </h1>
            <p style="color: #6c757d; font-size: 16px; margin: 0;">
                A new message has been submitted through the contact form
            </p>
        </div>

        <!-- Priority Alert -->
        ${data.priority === 'urgent' || data.priority === 'high' ? `
        <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #dc3545; border: 1px solid #f5c6cb;">
            <h2 style="color: #721c24; font-size: 18px; margin: 0 0 10px 0;">
                🚨 ${data.priority === 'urgent' ? 'URGENT' : 'HIGH PRIORITY'} Message
            </h2>
            <p style="color: #721c24; font-size: 14px; margin: 0;">
                This message has been marked as ${data.priority} priority and requires immediate attention.
            </p>
        </div>
        ` : ''}

        <!-- Message Overview -->
        <div style="background-color: #fff3cd; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ffc107; border: 1px solid #ffeaa7;">
            <h2 style="color: #856404; font-size: 20px; margin: 0 0 15px 0;">
                📋 Message Overview
            </h2>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                    <td style="padding: 5px 0; color: #856404; font-size: 14px; width: 25%;">
                        <strong>Message ID:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 14px; font-family: 'Courier New', monospace; background-color: #f8f9fa; padding-left: 8px; border-radius: 3px;">
                        #${data.messageId || 'MSG-' + Date.now()}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #856404; font-size: 14px;">
                        <strong>Submitted:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 14px;">
                        ${data.submissionTime || new Date().toLocaleString()}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #856404; font-size: 14px;">
                        <strong>Status:</strong>
                    </td>
                    <td style="padding: 5px 0;">
                        <span style="background-color: #ffc107; color: #212529; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                            NEW MESSAGE
                        </span>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #856404; font-size: 14px;">
                        <strong>Priority:</strong>
                    </td>
                    <td style="padding: 5px 0;">
                        <span style="background-color: ${
                            data.priority === 'urgent' ? '#dc3545' : 
                            data.priority === 'high' ? '#fd7e14' : 
                            data.priority === 'low' ? '#6c757d' : '#28a745'
                        }; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: uppercase;">
                            ${data.priority || 'NORMAL'}
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Customer Information -->
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #e67e22;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 15px 0;">
                👤 Customer Information
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
                    <td style="padding: 8px 0;">
                        <a href="mailto:${data.email}" style="color: #e67e22; text-decoration: none; font-weight: 500;">
                            ${data.email}
                        </a>
                    </td>
                </tr>
                ${data.company ? `
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>Company:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 500;">
                        ${data.company}
                    </td>
                </tr>
                ` : ''}
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>Subject:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600;">
                        ${data.subject}
                    </td>
                </tr>
            </table>
        </div>

        <!-- Message Content -->
        <div style="background-color: #e8f5e8; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #28a745; border: 1px solid #c3e6cb;">
            <h2 style="color: #155724; font-size: 20px; margin: 0 0 15px 0;">
                💬 Customer Message
            </h2>
            <div style="background-color: white; padding: 20px; border-radius: 6px; border: 1px solid #c3e6cb;">
                <p style="color: #333; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">
"${data.message}"
                </p>
            </div>
        </div>

        <!-- Quick Actions -->
        <div style="text-align: center; margin: 30px 0;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 20px 0;">
                🚀 Quick Actions
            </h2>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                    <td style="padding: 0 10px 15px 0;">
                        <a href="mailto:${data.email}?subject=Re: ${encodeURIComponent(data.subject)}&body=Hi ${data.name},%0D%0A%0D%0AThank you for contacting PackWorkX. I'm reaching out regarding your message about \"${data.subject}\".%0D%0A%0D%0ABest regards" 
                           style="display: inline-block; padding: 12px 24px; background-color: #e67e22; color: white; text-decoration: none; border-radius: 5px; font-weight: 500;">
                            📧 Reply via Email
                        </a>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 10px 15px 0;">
                        <a href="${process.env.ADMIN_PANEL_URL || process.env.FRONTEND_URL + '/admin'}/contact-messages/${data.messageId}" 
                           style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: 500;">
                            👀 View in Admin Panel
                        </a>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 10px;">
                        <a href="${process.env.ADMIN_PANEL_URL || process.env.FRONTEND_URL + '/admin'}/contact-messages" 
                           style="display: inline-block; padding: 12px 24px; background-color: #6c757d; color: white; text-decoration: none; border-radius: 5px; font-weight: 500;">
                            📋 All Messages
                        </a>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Message Classification -->
        <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #17a2b8; border: 1px solid #bee5eb;">
            <h3 style="color: #0c5460; font-size: 16px; margin: 0 0 15px 0;">
                🏷️ Suggested Classification
            </h3>
            <p style="color: #0c5460; font-size: 14px; margin: 0 0 15px 0;">
                Based on the subject and content, this message might be about:
            </p>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                ${data.subject.toLowerCase().includes('demo') ? '<span style="background-color: #17a2b8; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">🎯 Demo Request</span>' : ''}
                ${data.subject.toLowerCase().includes('support') || data.subject.toLowerCase().includes('help') ? '<span style="background-color: #ffc107; color: #212529; padding: 4px 8px; border-radius: 12px; font-size: 12px;">🆘 Support</span>' : ''}
                ${data.subject.toLowerCase().includes('sales') || data.subject.toLowerCase().includes('price') || data.subject.toLowerCase().includes('quote') ? '<span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">💰 Sales</span>' : ''}
                ${data.subject.toLowerCase().includes('technical') || data.subject.toLowerCase().includes('bug') || data.subject.toLowerCase().includes('error') ? '<span style="background-color: #dc3545; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">🔧 Technical</span>' : ''}
                ${data.subject.toLowerCase().includes('billing') || data.subject.toLowerCase().includes('payment') || data.subject.toLowerCase().includes('invoice') ? '<span style="background-color: #fd7e14; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">💳 Billing</span>' : ''}
                ${data.subject.toLowerCase().includes('partnership') || data.subject.toLowerCase().includes('partner') ? '<span style="background-color: #6f42c1; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">🤝 Partnership</span>' : ''}
                <span style="background-color: #6c757d; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">📞 General</span>
            </div>
        </div>

        <!-- Response Templates -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0; border: 1px solid #e9ecef;">
            <h3 style="color: #2c3e50; font-size: 16px; margin: 0 0 15px 0;">
                📝 Quick Response Templates
            </h3>
            <div style="margin-bottom: 15px;">
                <strong style="color: #495057; font-size: 14px; display: block; margin-bottom: 5px;">General Inquiry:</strong>
                <div style="background-color: #fff; padding: 10px; border-radius: 4px; border: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
                    "Thank you for your interest in PackWorkX. I'd be happy to help you with [specific need]. Let me schedule a quick call to discuss your requirements in detail..."
                </div>
            </div>
            <div style="margin-bottom: 15px;">
                <strong style="color: #495057; font-size: 14px; display: block; margin-bottom: 5px;">Demo Request:</strong>
                <div style="background-color: #fff; padding: 10px; border-radius: 4px; border: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
                    "Thank you for your demo request! I'd love to show you how PackWorkX can streamline your corrugated box manufacturing operations. When would be a good time for a 30-minute personalized demo?"
                </div>
            </div>
            <div>
                <strong style="color: #495057; font-size: 14px; display: block; margin-bottom: 5px;">Support Request:</strong>
                <div style="background-color: #fff; padding: 10px; border-radius: 4px; border: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
                    "I understand you're experiencing [specific issue]. Let me connect you with our technical support team who can assist you immediately. You can also access our help center at..."
                </div>
            </div>
        </div>

        <!-- Technical Information -->
        ${data.ipAddress || data.userAgent ? `
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0; border: 1px solid #e9ecef;">
            <h3 style="color: #6c757d; font-size: 16px; margin: 0 0 15px 0;">
                🔧 Technical Information
            </h3>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                ${data.ipAddress ? `
                <tr>
                    <td style="padding: 5px 0; color: #6c757d; font-size: 12px; width: 20%;">
                        <strong>IP Address:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 12px; font-family: 'Courier New', monospace;">
                        ${data.ipAddress}
                    </td>
                </tr>
                ` : ''}
                ${data.userAgent ? `
                <tr>
                    <td style="padding: 5px 0; color: #6c757d; font-size: 12px; vertical-align: top;">
                        <strong>Browser:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 12px; word-break: break-all;">
                        ${data.userAgent}
                    </td>
                </tr>
                ` : ''}
            </table>
        </div>
        ` : ''}

        <!-- Response Reminders -->
        <div style="border-top: 1px solid #e9ecef; padding-top: 25px; text-align: center;">
            <p style="color: #dc3545; font-size: 16px; line-height: 1.6; margin: 0; font-weight: 500;">
                ⏰ Response Goal: Reply within 24 hours during business days
            </p>
            <p style="color: #6c757d; font-size: 14px; margin: 15px 0 0 0;">
                This is an automated notification from PackWorkX Contact Form<br>
                <strong>Customer Success Team</strong>
            </p>
        </div>
    `;

    return BaseEmailTemplate({
        title: `🔔 New Contact Message from ${data.name}${data.company ? ` (${data.company})` : ''}`,
        content,
        preheader: `New message from ${data.name} about "${data.subject}". Response required within 24 hours.`
    });
};
