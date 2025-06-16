import { BaseEmailTemplate } from './baseTemplate.js';

/**
 * Company welcome email template for new users
 * @param {Object} data - Template data
 * @param {string} data.companyName - Company name
 * @param {string} data.userName - User name
 * @param {string} data.userEmail - User email
 * @param {string} data.username - Login username
 * @param {string} data.password - Login password
 * @param {string} data.loginUrl - Login URL
 * @param {string} data.supportEmail - Support email
 * @param {string} data.dashboardUrl - Dashboard URL
 */
export const CompanyWelcomeTemplate = (data) => {
    const content = `
        <!-- Welcome Header -->
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; font-size: 28px; margin: 0 0 10px 0;">
                🎉 Welcome to PackWorkX!
            </h1>
            <p style="color: #6c757d; font-size: 16px; margin: 0;">
                Your company registration is complete and ready to go
            </p>
        </div>

        <!-- Login Credentials Section -->
        <div style="background-color: #fff3cd; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ffc107; border: 1px solid #ffeaa7;">
            <h2 style="color: #856404; font-size: 20px; margin: 0 0 15px 0;">
                🔑 Your Login Credentials
            </h2>
            <p style="color: #856404; font-size: 14px; margin: 0 0 15px 0; font-weight: 500;">
                ⚠️ Please save these credentials securely and change your password after your first login.
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                    <td style="padding: 8px 0; color: #856404; font-size: 14px; width: 30%;">
                        <strong>Username:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; background-color: #f8f9fa; padding-left: 10px; border-radius: 4px; font-family: 'Courier New', monospace;">
                        ${data.username || data.userEmail}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #856404; font-size: 14px;">
                        <strong>Password:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; background-color: #f8f9fa; padding-left: 10px; border-radius: 4px; font-family: 'Courier New', monospace;">
                        ${data.password}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #856404; font-size: 14px;">
                        <strong>Login URL:</strong>
                    </td>
                    <td style="padding: 8px 0;">
                        <a href="${data.loginUrl}" style="color: #e67e22; text-decoration: none; font-weight: 500;">${data.loginUrl}</a>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Company Info -->
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #e67e22;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 15px 0;">
                🏢 Company Registration Details
            </h2>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                    <td style="padding: 5px 0; color: #6c757d; font-size: 14px; width: 30%;">
                        <strong>Company Name:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 14px;">
                        ${data.companyName}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #6c757d; font-size: 14px;">
                        <strong>Account Holder:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 14px;">
                        ${data.userName}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #6c757d; font-size: 14px;">
                        <strong>Email Address:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 14px;">
                        ${data.userEmail}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #6c757d; font-size: 14px;">
                        <strong>Registration Date:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 14px;">
                        ${new Date().toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        })}
                    </td>
                </tr>
            </table>
        </div>

        <!-- Getting Started -->
        <div style="margin-bottom: 30px;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 20px 0;">
                🚀 Getting Started with PackWorkX
            </h2>
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Your PackWorkX account is now active! Here's what you can do next:
            </p>
            
            <div style="margin-bottom: 20px;">
                <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 10px;">
                    <h3 style="color: #e67e22; font-size: 16px; margin: 0 0 8px 0;">
                        1. 📊 Set Up Your Dashboard
                    </h3>
                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                        Configure your company settings, add team members, and customize your workspace.
                    </p>
                </div>
                
                <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 10px;">
                    <h3 style="color: #e67e22; font-size: 16px; margin: 0 0 8px 0;">
                        2. 👥 Add Your Team
                    </h3>
                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                        Invite team members and assign roles to start collaborating effectively.
                    </p>
                </div>
                
                <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 10px;">
                    <h3 style="color: #e67e22; font-size: 16px; margin: 0 0 8px 0;">
                        3. 📦 Import Your Data
                    </h3>
                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                        Import existing customer data, orders, and inventory to get started quickly.
                    </p>
                </div>
            </div>
        </div>

        <!-- Action Buttons -->
        <div style="text-align: center; margin: 30px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                    <td style="padding: 0 10px 15px 0;">
                        <a href="${data.loginUrl}" class="btn btn-primary" style="display: inline-block; padding: 12px 24px; background-color: #e67e22; color: white; text-decoration: none; border-radius: 5px; font-weight: 500;">
                            🚀 Login to Your Dashboard
                        </a>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 10px;">
                        <a href="${data.dashboardUrl}/help" class="btn btn-outline" style="display: inline-block; padding: 12px 24px; background-color: transparent; color: #e67e22; text-decoration: none; border: 2px solid #e67e22; border-radius: 5px; font-weight: 500;">
                            📚 View Getting Started Guide
                        </a>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 15px 0 0 0; font-size: 12px; color: #6c757d;">
                        <strong>Quick Login:</strong> Use <code style="background-color: #f8f9fa; padding: 2px 4px; border-radius: 3px;">${data.username || data.userEmail}</code> and password <code style="background-color: #f8f9fa; padding: 2px 4px; border-radius: 3px;">${data.password}</code>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Features Highlight -->
        <div style="background: linear-gradient(135deg, #e67e22 0%, #d35400 100%); padding: 25px; border-radius: 8px; margin: 30px 0; color: white; text-align: center;">
            <h2 style="color: white; font-size: 20px; margin: 0 0 15px 0;">
                🌟 What You Can Do with PackWorkX
            </h2>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 20px;">
                <div style="flex: 1; min-width: 150px; text-align: center; margin: 10px 0;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📦</div>
                    <strong style="display: block; margin-bottom: 5px;">Order Management</strong>
                    <small style="opacity: 0.9;">Track orders from inquiry to delivery</small>
                </div>
                <div style="flex: 1; min-width: 150px; text-align: center; margin: 10px 0;">
                    <div style="font-size: 24px; margin-bottom: 8px;">👥</div>
                    <strong style="display: block; margin-bottom: 5px;">Customer Relations</strong>
                    <small style="opacity: 0.9;">Manage customer relationships</small>
                </div>
                <div style="flex: 1; min-width: 150px; text-align: center; margin: 10px 0;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📊</div>
                    <strong style="display: block; margin-bottom: 5px;">Analytics</strong>
                    <small style="opacity: 0.9;">Real-time business insights</small>
                </div>
            </div>
        </div>

        <!-- Support Section -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <h3 style="color: #2c3e50; font-size: 18px; margin: 0 0 15px 0;">
                💬 Need Help Getting Started?
            </h3>
            <p style="color: #6c757d; font-size: 14px; margin: 0 0 15px 0; line-height: 1.5;">
                Our support team is here to help you succeed. Don't hesitate to reach out!
            </p>
            <div>
                <a href="mailto:${data.supportEmail}" style="color: #e67e22; text-decoration: none; font-weight: 500;">
                    📧 ${data.supportEmail}
                </a>
                <span style="color: #6c757d; margin: 0 10px;">|</span>
                <a href="tel:+15551234567" style="color: #e67e22; text-decoration: none; font-weight: 500;">
                    📞 +1 (555) 123-4567
                </a>
            </div>
        </div>

        <!-- Welcome Message -->
        <div style="border-top: 1px solid #e9ecef; padding-top: 25px; text-align: center;">
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0;">
                Welcome to the PackWorkX family, <strong>${data.userName}</strong>! We're excited to help 
                <strong>${data.companyName}</strong> streamline operations and grow your business.
            </p>
            <p style="color: #6c757d; font-size: 14px; margin: 15px 0 0 0;">
                Best regards,<br>
                <strong style="color: #e67e22;">The PackWorkX Team</strong>
            </p>
        </div>
    `;

    return BaseEmailTemplate({
        title: `Welcome to PackWorkX - ${data.companyName}`,
        content,
        preheader: `Welcome ${data.userName}! Your PackWorkX account for ${data.companyName} is ready to use.`
    });
};
