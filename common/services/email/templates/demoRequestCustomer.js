import { BaseEmailTemplate } from './baseTemplate.js';

/**
 * Demo request confirmation email template for customers
 * @param {Object} data - Template data
 * @param {string} data.fullName - Customer's full name
 * @param {string} data.companyName - Company name
 * @param {string} data.email - Customer email
 * @param {string} data.phone - Customer phone
 * @param {string} data.role - Customer role
 * @param {string} data.preferredDemoTime - Preferred demo time
 * @param {string} data.needsDescription - Customer needs description
 * @param {string} data.requestId - Demo request ID
 */
export const DemoRequestCustomerTemplate = (data) => {
    const content = `
        <!-- Welcome Header -->
        <div style=\"text-align: center; margin-bottom: 30px;\">
            <h1 style=\"color: #2c3e50; font-size: 28px; margin: 0 0 10px 0;\">
                🎉 Thank You for Your Interest!
            </h1>
            <p style=\"color: #6c757d; font-size: 16px; margin: 0;\">
                Your demo request has been received and our team will contact you soon
            </p>
        </div>

        <!-- Request Confirmation -->
        <div style=\"background-color: #d4edda; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #28a745; border: 1px solid #c3e6cb;\">
            <h2 style=\"color: #155724; font-size: 20px; margin: 0 0 15px 0;\">
                ✅ Demo Request Confirmed
            </h2>
            <p style=\"color: #155724; font-size: 14px; margin: 0 0 15px 0;\">
                <strong>Request ID:</strong> #${data.requestId || 'DEMO-' + Date.now()}
            </p>
            <p style=\"color: #155724; font-size: 14px; margin: 0;\">
                We've received your demo request and our sales team will reach out to you within <strong>24 hours</strong> to schedule your personalized demonstration.
            </p>
        </div>

        <!-- Request Details -->
        <div style=\"background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #e67e22;\">
            <h2 style=\"color: #2c3e50; font-size: 20px; margin: 0 0 15px 0;\">
                📋 Your Request Details
            </h2>
            <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\">
                <tr>
                    <td style=\"padding: 8px 0; color: #6c757d; font-size: 14px; width: 35%;\">
                        <strong>Company Name:</strong>
                    </td>
                    <td style=\"padding: 8px 0; color: #333; font-size: 14px;\">
                        ${data.companyName}
                    </td>
                </tr>
                <tr>
                    <td style=\"padding: 8px 0; color: #6c757d; font-size: 14px;\">
                        <strong>Contact Person:</strong>
                    </td>
                    <td style=\"padding: 8px 0; color: #333; font-size: 14px;\">
                        ${data.fullName}
                    </td>
                </tr>
                <tr>
                    <td style=\"padding: 8px 0; color: #6c757d; font-size: 14px;\">
                        <strong>Role:</strong>
                    </td>
                    <td style=\"padding: 8px 0; color: #333; font-size: 14px;\">
                        ${data.role}
                    </td>
                </tr>
                <tr>
                    <td style=\"padding: 8px 0; color: #6c757d; font-size: 14px;\">
                        <strong>Email:</strong>
                    </td>
                    <td style=\"padding: 8px 0; color: #333; font-size: 14px;\">
                        ${data.email}
                    </td>
                </tr>
                <tr>
                    <td style=\"padding: 8px 0; color: #6c757d; font-size: 14px;\">
                        <strong>Phone:</strong>
                    </td>
                    <td style=\"padding: 8px 0; color: #333; font-size: 14px;\">
                        ${data.phone}
                    </td>
                </tr>
                <tr>
                    <td style=\"padding: 8px 0; color: #6c757d; font-size: 14px;\">
                        <strong>Preferred Demo Time:</strong>
                    </td>
                    <td style=\"padding: 8px 0; color: #333; font-size: 14px;\">
                        ${data.preferredDemoTime}
                    </td>
                </tr>
                ${data.needsDescription ? `
                <tr>
                    <td style=\"padding: 8px 0; color: #6c757d; font-size: 14px; vertical-align: top;\">
                        <strong>Your Needs:</strong>
                    </td>
                    <td style=\"padding: 8px 0; color: #333; font-size: 14px; line-height: 1.5;\">
                        ${data.needsDescription}
                    </td>
                </tr>
                ` : ''}
            </table>
        </div>

        <!-- What Happens Next -->
        <div style=\"margin-bottom: 30px;\">
            <h2 style=\"color: #2c3e50; font-size: 20px; margin: 0 0 20px 0;\">
                📅 What Happens Next?
            </h2>
            
            <div style=\"margin-bottom: 20px;\">
                <div style=\"background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #e67e22;\">
                    <h3 style=\"color: #e67e22; font-size: 16px; margin: 0 0 8px 0;\">
                        1. 📞 Our Team Will Contact You
                    </h3>
                    <p style=\"color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;\">
                        Within 24 hours, one of our sales representatives will reach out to confirm your requirements and schedule a convenient demo time.
                    </p>
                </div>
                
                <div style=\"background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #e67e22;\">
                    <h3 style=\"color: #e67e22; font-size: 16px; margin: 0 0 8px 0;\">
                        2. 🎯 Personalized Demo Session
                    </h3>
                    <p style=\"color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;\">
                        We'll conduct a live, personalized demonstration focusing on your specific business needs and requirements.
                    </p>
                </div>
                
                <div style=\"background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #e67e22;\">
                    <h3 style=\"color: #e67e22; font-size: 16px; margin: 0 0 8px 0;\">
                        3. 💬 Q&A and Discussion
                    </h3>
                    <p style=\"color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;\">
                        Ask questions, discuss implementation, and learn how PackWorkX can streamline your operations.
                    </p>
                </div>

                <div style=\"background-color: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #e67e22;\">
                    <h3 style=\"color: #e67e22; font-size: 16px; margin: 0 0 8px 0;\">
                        4. 📋 Custom Proposal
                    </h3>
                    <p style=\"color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;\">
                        Receive a tailored proposal with pricing and implementation timeline based on your requirements.
                    </p>
                </div>
            </div>
        </div>

        <!-- Demo Features Preview -->
        <div style=\"background: linear-gradient(135deg, #e67e22 0%, #d35400 100%); padding: 25px; border-radius: 8px; margin: 30px 0; color: white; text-align: center;\">
            <h2 style=\"color: white; font-size: 20px; margin: 0 0 15px 0;\">
                🌟 What You'll See in Your Demo
            </h2>
            <div style=\"display: flex; flex-wrap: wrap; justify-content: center; gap: 20px;\">
                <div style=\"flex: 1; min-width: 200px; text-align: center; margin: 10px 0;\">
                    <div style=\"font-size: 24px; margin-bottom: 8px;\">📦</div>
                    <strong style=\"display: block; margin-bottom: 5px;\">Order Management</strong>
                    <small style=\"opacity: 0.9;\">Complete order lifecycle tracking</small>
                </div>
                <div style=\"flex: 1; min-width: 200px; text-align: center; margin: 10px 0;\">
                    <div style=\"font-size: 24px; margin-bottom: 8px;\">🏭</div>
                    <strong style=\"display: block; margin-bottom: 5px;\">Production Planning</strong>
                    <small style=\"opacity: 0.9;\">Efficient production scheduling</small>
                </div>
                <div style=\"flex: 1; min-width: 200px; text-align: center; margin: 10px 0;\">
                    <div style=\"font-size: 24px; margin-bottom: 8px;\">📊</div>
                    <strong style=\"display: block; margin-bottom: 5px;\">Real-time Analytics</strong>
                    <small style=\"opacity: 0.9;\">Business insights at your fingertips</small>
                </div>
            </div>
        </div>

        <!-- Contact Information -->
        <div style=\"background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;\">
            <h3 style=\"color: #2c3e50; font-size: 18px; margin: 0 0 15px 0;\">
                💬 Have Questions Before Your Demo?
            </h3>
            <p style=\"color: #6c757d; font-size: 14px; margin: 0 0 15px 0; line-height: 1.5;\">
                Feel free to reach out to us anytime. We're here to help!
            </p>
            <div>
                <a href=\"mailto:support@packworkx.com\" style=\"color: #e67e22; text-decoration: none; font-weight: 500;\">
                    📧 support@packworkx.com
                </a>
                <span style=\"color: #6c757d; margin: 0 10px;\">|</span>
                <a href=\"tel:+15551234567\" style=\"color: #e67e22; text-decoration: none; font-weight: 500;\">
                    📞 +1 (555) 123-4567
                </a>
            </div>
        </div>

        <!-- Thank You Message -->
        <div style=\"border-top: 1px solid #e9ecef; padding-top: 25px; text-align: center;\">
            <p style=\"color: #333; font-size: 16px; line-height: 1.6; margin: 0;\">
                Thank you for choosing PackWorkX, <strong>${data.fullName}</strong>! We're excited to show you how 
                our platform can help <strong>${data.companyName}</strong> streamline operations and boost productivity.
            </p>
            <p style=\"color: #6c757d; font-size: 14px; margin: 15px 0 0 0;\">
                Best regards,<br>
                <strong style=\"color: #e67e22;\">The PackWorkX Sales Team</strong>
            </p>
        </div>
    `;

    return BaseEmailTemplate({
        title: `Demo Request Confirmation - ${data.companyName}`,
        content,
        preheader: `Thank you ${data.fullName}! Your demo request for ${data.companyName} has been received.`
    });
};
