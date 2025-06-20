import { BaseEmailTemplate } from './baseTemplate.js';

/**
 * Forgot password email template
 * @param {Object} data - Template data
 * @param {string} data.userName - User's name
 * @param {string} data.email - User's email
 * @param {string} data.resetUrl - Password reset URL
 * @param {string} data.resetToken - Reset token
 * @param {string} data.expiresIn - Token expiry time
 * @param {string} data.ipAddress - Request IP address
 * @param {string} data.requestTime - Request timestamp
 */
export const ForgotPasswordTemplate = (data) => {
    const content = `
        <!-- Alert Header -->
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #e67e22; font-size: 28px; margin: 0 0 10px 0;">
                🔐 Password Reset Request
            </h1>
            <p style="color: #6c757d; font-size: 16px; margin: 0;">
                We received a request to reset your PackWorkX password
            </p>
        </div>

        <!-- Security Alert -->
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ffc107; border: 1px solid #ffeaa7;">
            <h2 style="color: #856404; font-size: 18px; margin: 0 0 10px 0;">
                🛡️ Security Information
            </h2>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                    <td style="padding: 5px 0; color: #856404; font-size: 14px; width: 25%;">
                        <strong>Account:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 14px;">
                        ${data.email}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #856404; font-size: 14px;">
                        <strong>Request Time:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 14px;">
                        ${data.requestTime || new Date().toLocaleString()}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #856404; font-size: 14px;">
                        <strong>IP Address:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #333; font-size: 14px; font-family: 'Courier New', monospace;">
                        ${data.ipAddress || 'Unknown'}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #856404; font-size: 14px;">
                        <strong>Expires In:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #dc3545; font-size: 14px; font-weight: 500;">
                        ${data.expiresIn || '1 hour'}
                    </td>
                </tr>
            </table>
        </div>

        <!-- Reset Instructions -->
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #e67e22;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 15px 0;">
                🔑 Reset Your Password
            </h2>
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${data.userName || 'there'}</strong>,
            </p>
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                You recently requested to reset your password for your PackWorkX account. Click the button below to reset it:
            </p>
        </div>

        <!-- Reset Button -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetUrl}" 
               style="display: inline-block; padding: 15px 30px; background-color: #e67e22; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(230, 126, 34, 0.3);">
                🔐 Reset Password
            </a>
        </div>

        <!-- Alternative Link -->
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #28a745;">
            <h3 style="color: #155724; font-size: 16px; margin: 0 0 10px 0;">
                Can't click the button?
            </h3>
            <p style="color: #155724; font-size: 14px; margin: 0 0 10px 0;">
                Copy and paste this link into your browser:
            </p>
            <div style="background-color: #fff; padding: 10px; border-radius: 4px; border: 1px solid #c3e6cb; word-break: break-all;">
                <code style="color: #e67e22; font-size: 12px;">
                    ${data.resetUrl}
                </code>
            </div>
        </div>

        <!-- Security Instructions -->
        <div style="margin-bottom: 30px;">
            <h2 style="color: #2c3e50; font-size: 20px; margin: 0 0 20px 0;">
                🛡️ Security Tips
            </h2>
            
            <div style="margin-bottom: 20px;">
                <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #17a2b8;">
                    <h3 style="color: #17a2b8; font-size: 16px; margin: 0 0 8px 0;">
                        ⏰ Act Quickly
                    </h3>
                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                        This reset link expires in <strong>${data.expiresIn || '1 hour'}</strong>. If you don't reset your password within this time, you'll need to request a new reset link.
                    </p>
                </div>
                
                <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #ffc107;">
                    <h3 style="color: #856404; font-size: 16px; margin: 0 0 8px 0;">
                        🔒 Choose a Strong Password
                    </h3>
                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                        Use at least 8 characters with a mix of letters, numbers, and special characters. Avoid using personal information.
                    </p>
                </div>
                
                <div style="background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #dc3545;">
                    <h3 style="color: #721c24; font-size: 16px; margin: 0 0 8px 0;">
                        🚫 Didn't Request This?
                    </h3>
                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                        If you didn't request a password reset, please ignore this email or contact support immediately. Your account remains secure.
                    </p>
                </div>
            </div>
        </div>

        <!-- Support Information -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <h3 style="color: #2c3e50; font-size: 18px; margin: 0 0 15px 0;">
                💬 Need Help?
            </h3>
            <p style="color: #6c757d; font-size: 14px; margin: 0 0 15px 0; line-height: 1.5;">
                If you're having trouble resetting your password or have security concerns, our support team is here to help.
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
                This password reset link was requested from IP address <strong>${data.ipAddress || 'Unknown'}</strong>.<br>
                If this wasn't you, please contact our support team immediately.
            </p>
            <p style="color: #6c757d; font-size: 12px; margin: 15px 0 0 0;">
                For security reasons, this link will expire in <strong>${data.expiresIn || '1 hour'}</strong><br>
                <strong style="color: #e67e22;">PackWorkX Security Team</strong>
            </p>
        </div>
    `;

    return BaseEmailTemplate({
        title: 'Reset Your PackWorkX Password',
        content,
        preheader: `Reset your password for ${data.email}. Link expires in ${data.expiresIn || '1 hour'}.`
    });
};
