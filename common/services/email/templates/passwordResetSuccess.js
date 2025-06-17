import { BaseEmailTemplate } from './baseTemplate.js';

/**
 * Password reset success email template
 * @param {Object} data - Template data
 * @param {string} data.userName - User's name
 * @param {string} data.email - User's email
 * @param {string} data.resetTime - Time when password was reset
 * @param {string} data.ipAddress - Reset IP address
 * @param {string} data.loginUrl - Login URL
 */
export const PasswordResetSuccessTemplate = (data) => {
    const content = `
        <!-- Success Header -->
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #28a745; font-size: 28px; margin: 0 0 10px 0;">
                ✅ Password Reset Successful
            </h1>
            <p style="color: #6c757d; font-size: 16px; margin: 0;">
                Your PackWorkX password has been successfully updated
            </p>
        </div>

        <!-- Success Confirmation -->
        <div style="background-color: #d4edda; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #28a745; border: 1px solid #c3e6cb;">
            <h2 style="color: #155724; font-size: 20px; margin: 0 0 15px 0;">
                🎉 All Set!
            </h2>
            <p style="color: #155724; font-size: 16px; margin: 0 0 15px 0;">
                Hi <strong>${data.userName || 'there'}</strong>,
            </p>
            <p style="color: #155724; font-size: 14px; margin: 0;">
                Your password has been successfully reset. You can now sign in to your PackWorkX account with your new password.
            </p>
        </div>

        <!-- Reset Details -->
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #e67e22;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 15px 0;">
                📋 Reset Details
            </h2>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px; width: 25%;">
                        <strong>Account:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 500;">
                        ${data.email}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>Reset Time:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px;">
                        ${data.resetTime || new Date().toLocaleString()}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>IP Address:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; font-family: 'Courier New', monospace;">
                        ${data.ipAddress || 'Unknown'}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">
                        <strong>Status:</strong>
                    </td>
                    <td style="padding: 8px 0;">
                        <span style="background-color: #28a745; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                            ✅ SUCCESSFUL
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Login Button -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="${data.loginUrl || process.env.FRONTEND_URL + '/login'}" 
               style="display: inline-block; padding: 15px 30px; background-color: #e67e22; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(230, 126, 34, 0.3);">
                🚀 Sign In Now
            </a>
        </div>

        <!-- Security Recommendations -->
        <div style="margin-bottom: 30px;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 20px 0;">
                🛡️ Keep Your Account Secure
            </h2>
            
            <div style="margin-bottom: 20px;">
                <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #17a2b8;">
                    <h3 style="color: #17a2b8; font-size: 16px; margin: 0 0 8px 0;">
                        🔐 Use Strong Passwords
                    </h3>
                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                        Keep your password unique and don't share it with others. Consider using a password manager for better security.
                    </p>
                </div>
                
                <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #28a745;">
                    <h3 style="color: #155724; font-size: 16px; margin: 0 0 8px 0;">
                        🔔 Enable Email Notifications
                    </h3>
                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                        Stay informed about important account activities with email notifications in your account settings.
                    </p>
                </div>
                
                <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #ffc107;">
                    <h3 style="color: #856404; font-size: 16px; margin: 0 0 8px 0;">
                        🚨 Monitor Your Account
                    </h3>
                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                        Regularly review your account activity and report any suspicious behavior to our support team immediately.
                    </p>
                </div>
            </div>
        </div>

        <!-- Feature Highlights -->
        <div style="background: linear-gradient(135deg, #e67e22 0%, #d35400 100%); padding: 25px; border-radius: 8px; margin: 30px 0; color: white; text-align: center;">
            <h2 style="color: white; font-size: 20px; margin: 0 0 15px 0;">
                🌟 Welcome Back to PackWorkX!
            </h2>
            <p style="color: white; font-size: 14px; margin: 0 0 20px 0; opacity: 0.9;">
                Your secure workspace for corrugated box manufacturing management
            </p>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 20px;">
                <div style="flex: 1; min-width: 150px; text-align: center; margin: 10px 0;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📊</div>
                    <strong style="display: block; margin-bottom: 5px;">Dashboard</strong>
                    <small style="opacity: 0.9;">Real-time insights</small>
                </div>
                <div style="flex: 1; min-width: 150px; text-align: center; margin: 10px 0;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📦</div>
                    <strong style="display: block; margin-bottom: 5px;">Orders</strong>
                    <small style="opacity: 0.9;">Manage efficiently</small>
                </div>
                <div style="flex: 1; min-width: 150px; text-align: center; margin: 10px 0;">
                    <div style="font-size: 24px; margin-bottom: 8px;">👥</div>
                    <strong style="display: block; margin-bottom: 5px;">Customers</strong>
                    <small style="opacity: 0.9;">Build relationships</small>
                </div>
            </div>
        </div>

        <!-- Security Alert -->
        <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #dc3545;">
            <h3 style="color: #721c24; font-size: 16px; margin: 0 0 10px 0;">
                🚨 Didn't Reset Your Password?
            </h3>
            <p style="color: #721c24; font-size: 14px; margin: 0 0 10px 0;">
                If you didn't reset your password, someone may have unauthorized access to your account.
            </p>
            <p style="color: #721c24; font-size: 14px; margin: 0;">
                <strong>Immediate action required:</strong> Contact our support team immediately at 
                <a href="mailto:security@packworkx.com" style="color: #721c24; font-weight: 600;">security@packworkx.com</a>
            </p>
        </div>

        <!-- Support Information -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <h3 style="color: #2c3e50; font-size: 18px; margin: 0 0 15px 0;">
                💬 Need Help?
            </h3>
            <p style="color: #6c757d; font-size: 14px; margin: 0 0 15px 0; line-height: 1.5;">
                Our support team is available 24/7 to help with any questions or concerns.
            </p>
            <div>
                <a href="mailto:support@packworkx.com" style="color: #e67e22; text-decoration: none; font-weight: 500;">
                    📧 support@packworkx.com
                </a>
                <span style="color: #6c757d; margin: 0 10px;">|</span>
                <a href="tel:+15551234567" style="color: #e67e22; text-decoration: none; font-weight: 500;">
                    📞 +1 (555) 123-4567
                </a>
            </div>
        </div>

        <!-- Footer Message -->
        <div style="border-top: 1px solid #e9ecef; padding-top: 25px; text-align: center;">
            <p style="color: #6c757d; font-size: 14px; line-height: 1.6; margin: 0;">
                Your password was reset from IP address <strong>${data.ipAddress || 'Unknown'}</strong> on ${data.resetTime || new Date().toLocaleString()}.
            </p>
            <p style="color: #6c757d; font-size: 12px; margin: 15px 0 0 0;">
                This is an automated security notification from PackWorkX<br>
                <strong style="color: #e67e22;">PackWorkX Security Team</strong>
            </p>
        </div>
    `;

    return BaseEmailTemplate({
        title: 'Password Reset Successful - PackWorkX',
        content,
        preheader: `Your PackWorkX password has been successfully reset for ${data.email}.`
    });
};
