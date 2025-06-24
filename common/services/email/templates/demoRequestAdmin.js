import { BaseEmailTemplate } from './baseTemplate.js';

/**
 * Demo request admin notification email template
 * @param {Object} data - Template data
 * @param {string} data.fullName - Customer's full name
 * @param {string} data.companyName - Company name
 * @param {string} data.email - Customer email
 * @param {string} data.phone - Customer phone
 * @param {string} data.role - Customer role
 * @param {string} data.preferredDemoTime - Preferred demo time
 * @param {string} data.needsDescription - Customer needs description
 * @param {string} data.requestId - Demo request ID
 * @param {string} data.ipAddress - Customer IP address
 * @param {string} data.userAgent - Customer user agent
 * @param {string} data.requestDate - Request date
 */
export const DemoRequestAdminTemplate = (data) => {
    const content = `
        <!-- Alert Header -->
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc3545; font-size: 28px; margin: 0 0 10px 0;">
                🚨 New Demo Request
            </h1>
            <p style="color: #6c757d; font-size: 16px; margin: 0;">
                A new demo request has been submitted and requires immediate attention
            </p>
        </div>

        <!-- Priority Alert -->
        <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #dc3545; border: 1px solid #f5c6cb;">
            <h2 style="color: #721c24; font-size: 18px; margin: 0 0 10px 0;">
                ⏰ Action Required
            </h2>
            <p style="color: #721c24; font-size: 14px; margin: 0;">
                <strong>Contact the prospect within 24 hours</strong> to maintain our response time SLA and maximize conversion potential.
            </p>
        </div>

        <!-- Request Overview -->
        <div style="background-color: #fff3cd; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ffc107; border: 1px solid #ffeaa7;">
            <h2 style="color: #856404; font-size: 20px; margin: 0 0 15px 0;">
                📋 Request Overview
            </h2>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                    <td style="padding: 5px 0; color: #856404; font-size: 14px; width: 25%;">
                        <strong>Request ID:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 14px; font-family: 'Courier New', monospace; background-color: #f8f9fa; padding-left: 8px; border-radius: 3px;">
                        #${data.requestId || 'DEMO-' + Date.now()}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #856404; font-size: 14px;">
                        <strong>Submitted:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 14px;">
                        ${data.requestDate || new Date().toLocaleString()}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #856404; font-size: 14px;">
                        <strong>Status:</strong>
                    </td>
                    <td style="padding: 5px 0;">
                        <span style="background-color: #ffc107; color: #212529; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                            PENDING CONTACT
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Customer Details -->
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #e67e22;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 15px 0;">
                👤 Customer Information
            </h2>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px; width: 25%;">
                        <strong>Company:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 500;">
                        ${data.companyName}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>Contact Person:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 500;">
                        ${data.fullName}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>Role/Position:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px;">
                        ${data.role}
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
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>Phone:</strong>
                    </td>
                    <td style="padding: 8px 0;">
                        <a href="tel:${data.phone}" style="color: #e67e22; text-decoration: none; font-weight: 500;">
                            ${data.phone}
                        </a>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>Preferred Demo Time:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px;">
                        <span style="background-color: #e3f2fd; color: #1565c0; padding: 2px 6px; border-radius: 4px; font-size: 12px;">
                            ${data.preferredDemoTime}
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Customer Needs -->
        ${data.needsDescription ? `
        <div style="background-color: #e8f5e8; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #28a745; border: 1px solid #c3e6cb;">
            <h2 style="color: #155724; font-size: 20px; margin: 0 0 15px 0;">
                💭 Customer Requirements & Needs
            </h2>
            <div style="background-color: white; padding: 15px; border-radius: 6px; border: 1px solid #c3e6cb;">
                <p style="color: #333; font-size: 14px; line-height: 1.6; margin: 0;">
                    "${data.needsDescription}"
                </p>
            </div>
        </div>
        ` : ''}

        <!-- Quick Actions -->
        <div style="text-align: center; margin: 30px 0;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 20px 0;">
                🚀 Quick Actions
            </h2>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                    <td style="padding: 0 10px 15px 0;">
                        <a href="mailto:${data.email}?subject=Demo Request - ${data.companyName}&body=Hi ${data.fullName},%0D%0A%0D%0AThank you for your interest in PackWorkX! I'm reaching out regarding your demo request for ${data.companyName}.%0D%0A%0D%0AWhen would be a convenient time for a 30-minute personalized demonstration?%0D%0A%0D%0ABest regards" 
                           style="display: inline-block; padding: 12px 24px; background-color: #e67e22; color: white; text-decoration: none; border-radius: 5px; font-weight: 500;">
                            📧 Send Email
                        </a>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 10px;">
                        <a href="tel:${data.phone}" 
                           style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: 500;">
                            📞 Call Now
                        </a>
                    </td>
                </tr>
            </table>
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

        <!-- Follow-up Reminder -->
        <div style="border-top: 1px solid #e9ecef; padding-top: 25px; text-align: center;">
            <p style="color: #dc3545; font-size: 16px; line-height: 1.6; margin: 0; font-weight: 500;">
                ⚠️ Remember: Quick response time is crucial for demo request conversion!
            </p>
            <p style="color: #6c757d; font-size: 14px; margin: 15px 0 0 0;">
                This is an automated notification from PackWorkX CRM<br>
                <strong>Demo Request System</strong>
            </p>
        </div>
    `;

    return BaseEmailTemplate({
        title: `🚨 New Demo Request from ${data.companyName}`,
        content,
        preheader: `New demo request from ${data.fullName} at ${data.companyName}. Contact required within 24 hours.`
    });
};
