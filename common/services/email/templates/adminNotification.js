import { BaseEmailTemplate } from './baseTemplate.js';

/**
 * Admin notification email template for new company registrations
 * @param {Object} data - Template data
 * @param {string} data.companyName - Company name
 * @param {string} data.companyEmail - Company email
 * @param {string} data.companyPhone - Company phone
 * @param {string} data.companyWebsite - Company website
 * @param {string} data.userName - User name
 * @param {string} data.userEmail - User email
 * @param {string} data.registrationDate - Registration date
 * @param {string} data.adminPanelUrl - Admin panel URL
 */
export const AdminNotificationTemplate = (data) => {
    const content = `
        <!-- Alert Header -->
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="background-color: #e67e22; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h1 style="color: white; font-size: 24px; margin: 0;">
                    🚨 New Company Registration Alert
                </h1>
            </div>
            <p style="color: #6c757d; font-size: 16px; margin: 0;">
                A new company has been registered on the PackWorkX platform
            </p>
        </div>

        <!-- Registration Summary -->
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #28a745;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 20px 0;">
                📋 Registration Summary
            </h2>
            <div style="background-color: white; padding: 20px; border-radius: 6px; margin-bottom: 15px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 8px 0; color: #6c757d; font-size: 14px; width: 35%; font-weight: 600;">
                            Registration Date:
                        </td>
                        <td style="padding: 8px 0; color: #333; font-size: 14px;">
                            ${data.registrationDate} ${new Date().toLocaleTimeString()}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6c757d; font-size: 14px; font-weight: 600;">
                            Registration ID:
                        </td>
                        <td style="padding: 8px 0; color: #333; font-size: 14px;">
                            #${Date.now().toString().slice(-8)}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6c757d; font-size: 14px; font-weight: 600;">
                            Status:
                        </td>
                        <td style="padding: 8px 0;">
                            <span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">
                                ACTIVE
                            </span>
                        </td>
                    </tr>
                </table>
            </div>
        </div>

        <!-- Company Details -->
        <div style="margin-bottom: 30px;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 20px 0;">
                🏢 Company Information
            </h2>
            <div style="background-color: white; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #e67e22; color: white; padding: 15px;">
                    <h3 style="color: white; font-size: 18px; margin: 0;">
                        ${data.companyName}
                    </h3>
                </div>
                <div style="padding: 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #f8f9fa;">
                                <div style="display: flex; align-items: center;">
                                    <span style="color: #e67e22; font-size: 16px; margin-right: 10px;">📧</span>
                                    <div>
                                        <div style="color: #6c757d; font-size: 12px; margin-bottom: 2px;">Email</div>
                                        <div style="color: #333; font-size: 14px; font-weight: 500;">
                                            <a href="mailto:${data.companyEmail}" style="color: #e67e22; text-decoration: none;">
                                                ${data.companyEmail}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        ${data.companyPhone ? `
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #f8f9fa;">
                                <div style="display: flex; align-items: center;">
                                    <span style="color: #e67e22; font-size: 16px; margin-right: 10px;">📞</span>
                                    <div>
                                        <div style="color: #6c757d; font-size: 12px; margin-bottom: 2px;">Phone</div>
                                        <div style="color: #333; font-size: 14px; font-weight: 500;">
                                            <a href="tel:${data.companyPhone}" style="color: #e67e22; text-decoration: none;">
                                                ${data.companyPhone}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        ` : ''}
                        ${data.companyWebsite ? `
                        <tr>
                            <td style="padding: 10px 0;">
                                <div style="display: flex; align-items: center;">
                                    <span style="color: #e67e22; font-size: 16px; margin-right: 10px;">🌐</span>
                                    <div>
                                        <div style="color: #6c757d; font-size: 12px; margin-bottom: 2px;">Website</div>
                                        <div style="color: #333; font-size: 14px; font-weight: 500;">
                                            <a href="${data.companyWebsite}" target="_blank" style="color: #e67e22; text-decoration: none;">
                                                ${data.companyWebsite}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
            </div>
        </div>

        <!-- Primary Contact -->
        <div style="margin-bottom: 30px;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 20px 0;">
                👤 Primary Contact Information
            </h2>
            <div style="background-color: white; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #2c3e50; color: white; padding: 15px;">
                    <h3 style="color: white; font-size: 18px; margin: 0;">
                        Account Administrator
                    </h3>
                </div>
                <div style="padding: 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #f8f9fa;">
                                <div style="display: flex; align-items: center;">
                                    <span style="color: #2c3e50; font-size: 16px; margin-right: 10px;">👤</span>
                                    <div>
                                        <div style="color: #6c757d; font-size: 12px; margin-bottom: 2px;">Full Name</div>
                                        <div style="color: #333; font-size: 14px; font-weight: 500;">
                                            ${data.userName}
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0;">
                                <div style="display: flex; align-items: center;">
                                    <span style="color: #2c3e50; font-size: 16px; margin-right: 10px;">📧</span>
                                    <div>
                                        <div style="color: #6c757d; font-size: 12px; margin-bottom: 2px;">Email Address</div>
                                        <div style="color: #333; font-size: 14px; font-weight: 500;">
                                            <a href="mailto:${data.userEmail}" style="color: #e67e22; text-decoration: none;">
                                                ${data.userEmail}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>

        <!-- Quick Stats -->
        <div style="margin-bottom: 30px;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 20px 0;">
                📊 Quick Statistics
            </h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                <div style="background: linear-gradient(135deg, #e67e22, #d35400); color: white; padding: 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">1</div>
                    <div style="font-size: 12px; opacity: 0.9;">New Company</div>
                </div>
                <div style="background: linear-gradient(135deg, #2c3e50, #34495e); color: white; padding: 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">1</div>
                    <div style="font-size: 12px; opacity: 0.9;">New User</div>
                </div>
                <div style="background: linear-gradient(135deg, #27ae60, #229954); color: white; padding: 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">ACTIVE</div>
                    <div style="font-size: 12px; opacity: 0.9;">Status</div>
                </div>
            </div>
        </div>

        <!-- Action Required -->
        <div style="background: linear-gradient(135deg, #f39c12, #e67e22); color: white; padding: 25px; border-radius: 8px; margin: 30px 0; text-align: center;">
            <h2 style="color: white; font-size: 20px; margin: 0 0 15px 0;">
                ⚡ Action Required
            </h2>
            <p style="color: white; opacity: 0.9; font-size: 14px; margin: 0 0 20px 0; line-height: 1.5;">
                Please review the new company registration and ensure all details are correct. 
                You may want to reach out to welcome them personally.
            </p>
            <div>
                <a href="${data.adminPanelUrl}" style="display: inline-block; background-color: white; color: #e67e22; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: 500; margin: 0 10px 10px 0;">
                    🔧 Review in Admin Panel
                </a>
                <a href="mailto:${data.userEmail}" style="display: inline-block; background-color: rgba(255,255,255,0.2); color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: 500; margin: 0 10px 10px 0;">
                    📧 Contact Company
                </a>
            </div>
        </div>

        <!-- System Information -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h3 style="color: #2c3e50; font-size: 16px; margin: 0 0 15px 0;">
                🔧 System Information
            </h3>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                    <td style="padding: 5px 0; color: #6c757d; font-size: 12px; width: 30%;">
                        Registration Method:
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 12px;">
                        Web Registration Form
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #6c757d; font-size: 12px;">
                        IP Address:
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 12px;">
                        [System Generated]
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #6c757d; font-size: 12px;">
                        User Agent:
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 12px;">
                        [Browser Information]
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #6c757d; font-size: 12px;">
                        Email Sent:
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 12px;">
                        ${new Date().toISOString()}
                    </td>
                </tr>
            </table>
        </div>

        <!-- Footer Message -->
        <div style="border-top: 1px solid #e9ecef; padding-top: 25px; text-align: center;">
            <p style="color: #333; font-size: 14px; line-height: 1.6; margin: 0;">
                This is an automated notification from the PackWorkX registration system.
                Please review the new company registration at your earliest convenience.
            </p>
            <p style="color: #6c757d; font-size: 12px; margin: 15px 0 0 0;">
                Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}<br>
                <strong style="color: #e67e22;">PackWorkX Admin System</strong>
            </p>
        </div>
    `;

    return BaseEmailTemplate({
        title: `New Company Registration - ${data.companyName}`,
        content,
        preheader: `New company ${data.companyName} registered by ${data.userName}. Review required.`
    });
};
