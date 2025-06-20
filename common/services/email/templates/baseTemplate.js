/**
 * Base email template with header and footer
 * @param {Object} data - Template data
 * @param {string} data.title - Email title
 * @param {string} data.content - Main email content (HTML)
 * @param {string} data.preheader - Preheader text (optional)
 */
export const BaseEmailTemplate = ({ title, content, preheader = '' }) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>${title}</title>
        <style>
            /* Reset and base styles */
            body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
            table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
            img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
            
            /* Email client fixes */
            body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100% !important; }
            .container { max-width: 600px; margin: 0 auto; }
            
            /* Typography */
            body, table, td, div, p, a { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            
            /* Colors */
            .primary-color { color: #e67e22; }
            .secondary-color { color: #2c3e50; }
            .text-color { color: #333333; }
            .muted-color { color: #6c757d; }
            .bg-primary { background-color: #e67e22; }
            .bg-secondary { background-color: #2c3e50; }
            .bg-light { background-color: #f8f9fa; }
            
            /* Utilities */
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .fw-bold { font-weight: bold; }
            .fw-normal { font-weight: normal; }
            
            /* Buttons */
            .btn {
                display: inline-block;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: 500;
                text-align: center;
                transition: all 0.3s ease;
            }
            .btn-primary {
                background-color: #e67e22;
                color: white;
                border: 2px solid #e67e22;
            }
            .btn-secondary {
                background-color: #2c3e50;
                color: white;
                border: 2px solid #2c3e50;
            }
            .btn-outline {
                background-color: transparent;
                color: #e67e22;
                border: 2px solid #e67e22;
            }
            
            /* Responsive */
            @media only screen and (max-width: 600px) {
                .container { padding: 0 15px; }
                .mobile-center { text-align: center !important; }
                .mobile-block { display: block !important; width: 100% !important; }
                .mobile-padding { padding: 15px !important; }
            }
        </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8f9fa;">
        <!-- Preheader -->
        ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #f8f9fa;">${preheader}</div>` : ''}
        
        <!-- Email Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa;">
            <tr>
                <td align="center" style="padding: 20px 0;">
                    <div class="container" style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        
                        <!-- Header -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                                <td style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); padding: 30px 40px; text-align: center;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                        <tr>
                                            <td align="center">
                                                <!-- Logo -->
                                                <div style="margin-bottom: 15px;">
                                                    <h1 style="color: #e67e22; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: -1px;">PackWorkX</h1>
                                                    <p style="color: #bdc3c7; font-size: 14px; margin: 5px 0 0 0;">Corrugated Box Manufacturing CRM</p>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>

                        <!-- Main Content -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                                <td style="padding: 40px;">
                                    ${content}
                                </td>
                            </tr>
                        </table>

                        <!-- Footer -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                                <td style="background-color: #f8f9fa; padding: 30px 40px; border-top: 1px solid #e9ecef;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                        <tr>
                                            <td align="center">
                                                <!-- Company Info -->
                                                <div style="margin-bottom: 20px;">
                                                    <h3 style="color: #2c3e50; font-size: 18px; margin: 0 0 10px 0;">PackWorkX</h3>
                                                    <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                                                        Leading CRM solution for corrugated box manufacturers<br>
                                                        Streamline operations, manage customers, boost productivity
                                                    </p>
                                                </div>

                                                <!-- Contact Info -->
                                                <div style="margin-bottom: 20px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td align="center" style="padding: 5px;">
                                                                <a href="mailto:support@packworkx.com" style="color: #e67e22; text-decoration: none; font-size: 14px;">
                                                                    📧 support@packworkx.com
                                                                </a>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td align="center" style="padding: 5px;">
                                                                <a href="tel:+15551234567" style="color: #e67e22; text-decoration: none; font-size: 14px;">
                                                                    📞 +1 (555) 123-4567
                                                                </a>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td align="center" style="padding: 5px;">
                                                                <a href="${process.env.FRONTEND_URL || 'https://packworkx.com'}" style="color: #e67e22; text-decoration: none; font-size: 14px;">
                                                                    🌐 www.packworkx.com
                                                                </a>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </div>

                                                <!-- Social Links -->
                                                <div style="margin-bottom: 20px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                                        <tr>
                                                            <td style="padding: 0 10px;">
                                                                <a href="#" style="color: #e67e22; text-decoration: none; font-size: 16px;">📘</a>
                                                            </td>
                                                            <td style="padding: 0 10px;">
                                                                <a href="#" style="color: #e67e22; text-decoration: none; font-size: 16px;">🐦</a>
                                                            </td>
                                                            <td style="padding: 0 10px;">
                                                                <a href="#" style="color: #e67e22; text-decoration: none; font-size: 16px;">💼</a>
                                                            </td>
                                                            <td style="padding: 0 10px;">
                                                                <a href="#" style="color: #e67e22; text-decoration: none; font-size: 16px;">📺</a>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </div>

                                                <!-- Legal -->
                                                <div>
                                                    <p style="color: #6c757d; font-size: 12px; margin: 0 0 10px 0; line-height: 1.4;">
                                                        © ${new Date().getFullYear()} PackWorkX. All rights reserved.
                                                    </p>
                                                    <p style="color: #6c757d; font-size: 12px; margin: 0; line-height: 1.4;">
                                                        You received this email because you have an account with PackWorkX.<br>
                                                        <a href="#" style="color: #e67e22; text-decoration: none;">Privacy Policy</a> | 
                                                        <a href="#" style="color: #e67e22; text-decoration: none;">Terms of Service</a> | 
                                                        <a href="#" style="color: #e67e22; text-decoration: none;">Unsubscribe</a>
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
};
