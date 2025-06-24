import { BaseEmailTemplate } from './baseTemplate.js';

/**
 * Payment Link Email Template
 * @param {Object} data - Template data
 * @param {string} data.clientName - Client name
 * @param {string} data.clientEmail - Client email
 * @param {string} data.invoiceNumber - Invoice number
 * @param {number} data.invoiceAmount - Invoice total amount
 * @param {Array} data.skuDetails - SKU details array
 * @param {string} data.paymentLink - Razorpay payment link URL
 * @param {string} data.dueDate - Invoice due date
 * @param {string} data.companyName - Company name (optional)
 */
export const PaymentLinkTemplate = ({
    clientName,
    clientEmail,
    invoiceNumber,
    invoiceAmount,
    skuDetails = [],
    paymentLink,
    dueDate,
    companyName = "PackWorkX"
}) => {
    const content = `
        <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            
            <!-- Greeting -->
            <h2 style="color: #2c3e50; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">
                Hello ${clientName},
            </h2>
            
            <!-- Main Message -->
            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                We hope this email finds you well. Please find below the payment details for your recent invoice.
            </p>

            <!-- Invoice Summary Card -->
            <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #e67e22;">
                <h3 style="color: #2c3e50; font-size: 20px; margin: 0 0 15px 0; font-weight: 600;">
                    📋 Invoice Summary
                </h3>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #6c757d; font-weight: 500; width: 40%;">Invoice Number:</td>
                        <td style="padding: 8px 0; color: #2c3e50; font-weight: 600;">${invoiceNumber}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Client Email:</td>
                        <td style="padding: 8px 0; color: #2c3e50; font-weight: 600;">${clientEmail}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Total Amount:</td>
                        <td style="padding: 8px 0; color: #e67e22; font-weight: 700; font-size: 18px;">₹${parseFloat(invoiceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    ${dueDate ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Due Date:</td>
                        <td style="padding: 8px 0; color: #dc3545; font-weight: 600;">${dueDate}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>

            ${skuDetails && skuDetails.length > 0 ? `
            <!-- SKU Details -->
            <div style="margin: 25px 0;">
                <h3 style="color: #2c3e50; font-size: 18px; margin: 0 0 15px 0; font-weight: 600;">
                    📦 Order Details
                </h3>
                
                <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="padding: 12px; text-align: left; color: #2c3e50; font-weight: 600; border-bottom: 1px solid #e9ecef;">Item</th>
                                <th style="padding: 12px; text-align: center; color: #2c3e50; font-weight: 600; border-bottom: 1px solid #e9ecef;">Qty</th>
                                <th style="padding: 12px; text-align: right; color: #2c3e50; font-weight: 600; border-bottom: 1px solid #e9ecef;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${skuDetails.map((item, index) => `
                                <tr style="${index % 2 === 0 ? 'background-color: #fafafa;' : 'background-color: white;'}">
                                    <td style="padding: 12px; color: #333333; border-bottom: 1px solid #f0f0f0;">
                                        ${item.sku || item.item_name || item.name || 'N/A'}
                                    </td>
                                    <td style="padding: 12px; text-align: center; color: #333333; border-bottom: 1px solid #f0f0f0;">
                                        ${item.quantity_required || item.quantity || item.qty || 'N/A'}
                                    </td>
                                    <td style="padding: 12px; text-align: right; color: #333333; border-bottom: 1px solid #f0f0f0;">
                                        ₹${parseFloat(item.total_incl_gst || item.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}

            <!-- Payment Instructions -->
            <div style="background: linear-gradient(135deg, #e8f5e8 0%, #f0f8f0 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #28a745;">
                <h3 style="color: #155724; font-size: 20px; margin: 0 0 15px 0; font-weight: 600;">
                    💳 Payment Instructions
                </h3>
                <p style="color: #155724; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    To complete your payment, please click the secure payment button below. You'll be redirected to our trusted payment gateway where you can pay using:
                </p>
                
                <ul style="color: #155724; font-size: 14px; line-height: 1.6; margin: 0 0 20px 20px; padding: 0;">
                    <li style="margin-bottom: 8px;">💳 Credit/Debit Cards (Visa, MasterCard, RuPay)</li>
                    <li style="margin-bottom: 8px;">🏦 Net Banking (All major banks supported)</li>
                    <li style="margin-bottom: 8px;">📱 UPI (GPay, PhonePe, Paytm, etc.)</li>
                    <li style="margin-bottom: 8px;">💰 Digital Wallets</li>
                </ul>
            </div>

            <!-- Payment Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${paymentLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #e67e22 0%, #d35400 100%); text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 18px; box-shadow: 0 4px 12px rgba(230, 126, 34, 0.3); transition: all 0.3s ease;">
                    💳 Pay Now - ₹${parseFloat(invoiceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </a>
            </div>

            <!-- Security Notice -->
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <div style="display: flex; align-items: flex-start;">
                    <div style="color: #856404; font-size: 18px; margin-right: 10px;">🔒</div>
                    <div>
                        <h4 style="color: #856404; font-size: 16px; margin: 0 0 8px 0; font-weight: 600;">Secure Payment</h4>
                        <p style="color: #856404; font-size: 14px; margin: 0; line-height: 1.5;">
                            This payment link is secure and encrypted. Your payment information is protected with industry-standard security measures.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Footer Message -->
            <div style="margin: 30px 0;">
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
                    If you have any questions regarding this invoice or need assistance with payment, please don't hesitate to contact us.
                </p>
                
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;">
                    Thank you for your business!
                </p>
                
                <p style="color: #e67e22; font-size: 16px; font-weight: 600; margin: 15px 0 0 0;">
                    Best regards,<br>
                    The ${companyName} Team
                </p>
            </div>

            <!-- Important Notes -->
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h4 style="color: #6c757d; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">Important Notes:</h4>
                <ul style="color: #6c757d; font-size: 13px; line-height: 1.5; margin: 0; padding-left: 20px;">
                    <li style="margin-bottom: 5px;">This payment link is valid for 30 days from the date of this email</li>
                    <li style="margin-bottom: 5px;">Please ensure you pay the exact amount mentioned above</li>
                    <li style="margin-bottom: 5px;">You will receive a payment confirmation once the transaction is completed</li>
                    <li>For any payment issues, please contact our support team immediately</li>
                </ul>
            </div>
        </div>
    `;

    return BaseEmailTemplate({
        title: `Payment Request - Invoice ${invoiceNumber}`,
        content,
        preheader: `Payment request for invoice ${invoiceNumber} - Amount: ₹${parseFloat(invoiceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    });
};
