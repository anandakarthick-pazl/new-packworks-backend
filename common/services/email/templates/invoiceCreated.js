/**
 * Invoice Created Email Template
 * Used when sending invoice notifications to clients
 */

export const InvoiceCreatedTemplate = ({
  clientName,
  clientEmail,
  invoiceNumber,
  invoiceAmount,
  dueDate,
  skuDetails = [],
  companyName = 'PackWorkX',
  invoiceId,
  frontendUrl = 'https://dev-packwork.pazl.info'
}) => {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(invoiceAmount);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Generate SKU details HTML
  const skuDetailsHtml = skuDetails && skuDetails.length > 0 
    ? skuDetails.map((item, index) => `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 12px 8px; text-align: center; font-size: 14px;">${index + 1}</td>
          <td style="padding: 12px 8px; font-size: 14px;">${item.sku || item.item_name || item.name || 'Item'}</td>
          <td style="padding: 12px 8px; text-align: center; font-size: 14px;">${item.quantity_required ||item.quantity || item.quantity_required || item.qty || 0}</td>
          <td style="padding: 12px 8px; text-align: right; font-size: 14px;">₹${parseFloat(item.rate_per_sku || item.unit_price ||  item.price || 0).toFixed(2)}</td>
          <td style="padding: 12px 8px; text-align: right; font-size: 14px;">₹${parseFloat(item.discount || 0).toFixed(2)}</td>
          <td style="padding: 12px 8px; text-align: right; font-size: 14px;">₹${parseFloat(item.gst || 0).toFixed(2)}</td>
          <td style="padding: 12px 8px; text-align: right; font-size: 14px; font-weight: 600;">₹${parseFloat(item.total_incl_gst || item.total_amount ||  0).toFixed(2)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #666; font-style: italic;">No items details available</td></tr>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoiceNumber} - ${companyName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; }
        .header h1 { font-size: 28px; margin-bottom: 8px; font-weight: 600; }
        .header p { font-size: 16px; opacity: 0.9; }
        .content { padding: 30px 20px; }
        .invoice-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 25px; border-left: 4px solid #667eea; }
        .invoice-info h3 { color: #333; margin-bottom: 15px; font-size: 18px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .info-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
        .info-item:last-child { border-bottom: none; }
        .info-label { font-weight: 600; color: #555; }
        .info-value { color: #333; text-align: right; }
        .amount-highlight { background: #e8f5e8; color: #2e7d2e; font-weight: 700; font-size: 18px; padding: 12px; border-radius: 6px; text-align: center; margin: 20px 0; }
        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .items-table th { background: #667eea; color: white; padding: 15px 8px; text-align: left; font-weight: 600; font-size: 14px; }
        .items-table th:nth-child(1), .items-table th:nth-child(3) { text-align: center; }
        .items-table th:nth-child(4), .items-table th:nth-child(5) { text-align: right; }
        .button-container { text-align: center; margin: 30px 0; }
        .btn { display: inline-block; padding: 14px 28px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.3s ease; margin: 0 10px; }
        .btn:hover { background: #5a6fd8; }
        .btn-secondary { background: #6c757d; }
        .btn-secondary:hover { background: #5a6268; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0; }
        .footer p { color: #666; font-size: 14px; margin: 5px 0; }
        .footer .company-info { font-weight: 600; color: #333; }
        @media (max-width: 600px) {
            .container { margin: 10px; border-radius: 0; }
            .content { padding: 20px 15px; }
            .info-grid { grid-template-columns: 1fr; }
            .btn { display: block; margin: 10px 0; }
            .items-table { font-size: 12px; }
            .items-table th, .items-table td { padding: 8px 4px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📄 Invoice Generated</h1>
            <p>Your invoice has been created and is ready for review</p>
        </div>
        
        <div class="content">
            <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>${clientName}</strong>,</p>
            
            <p style="font-size: 15px; margin-bottom: 25px; color: #555;">
                Thank you for your business! We have generated a new invoice for your recent order. 
                Please find the invoice details below and the PDF attachment for your records.
            </p>

            <div class="invoice-info">
                <h3>📋 Invoice Details</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Invoice Number:</span>
                        <span class="info-value"><strong>${invoiceNumber}</strong></span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Issue Date:</span>
                        <span class="info-value">${formatDate(new Date())}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Due Date:</span>
                        <span class="info-value">${formatDate(dueDate)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Client Email:</span>
                        <span class="info-value">${clientEmail}</span>
                    </div>
                </div>
            </div>

            

            ${skuDetails && skuDetails.length > 0 ? `
            <h3 style="margin: 25px 0 15px 0; color: #333;">📦 Order Items</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Item Name</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                         <th>Discount Price</th>
                         <th>Tax Amount</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${skuDetailsHtml}
                </tbody>
            </table>

             <div class="amount-highlight">
                Total Amount: ${formattedAmount}
            </div>

           
            ` : ''}

            {% comment %} <div class="button-container">
                <a href="${frontendUrl}/invoice/${invoiceId || invoiceNumber}" class="btn">
                    📄 View Invoice Online
                </a>
                <a href="${frontendUrl}/invoice" class="btn btn-secondary">
                    📋 View All Invoices
                </a>
            </div> {% endcomment %}

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 25px 0;">
                <p style="color: #856404; margin: 0; font-size: 14px;">
                    <strong>📎 Note:</strong> The invoice PDF is attached to this email for your convenience. 
                    Please save it for your records and future reference.
                </p>
            </div>

            <p style="font-size: 15px; color: #555; margin-top: 25px;">
                If you have any questions about this invoice or need assistance with payment, 
                please don't hesitate to contact our support team.
            </p>

            <p style="font-size: 15px; margin-top: 20px;">
                Thank you for choosing ${companyName}!<br>
                <strong>Best regards,</strong><br>
                <span style="color: #667eea; font-weight: 600;">${companyName} Team</span>
            </p>
        </div>

        <div class="footer">
            <p class="company-info">${companyName}</p>
            <p>📧 Email: support@packworkx.com | 📞 Phone: +91-XXXXX-XXXXX</p>
            <p style="font-size: 12px; color: #888; margin-top: 10px;">
                This is an automated email. Please do not reply directly to this message.
            </p>
        </div>
    </div>
</body>
</html>
  `;
};
