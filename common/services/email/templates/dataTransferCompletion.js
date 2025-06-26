/**
 * Data Transfer Completion Email Template
 */
export const DataTransferCompletionTemplate = ({
    userName,
    moduleName,
    fileName,
    totalRecords,
    processedRecords,
    failedRecords,
    status,
    startedAt,
    completedAt,
    dashboardUrl,
    supportEmail
}) => {
    const isSuccess = status === 'completed' && failedRecords === 0;
    const hasErrors = failedRecords > 0;
    const isFailed = status === 'failed';

    const statusColor = isSuccess ? '#10B981' : hasErrors ? '#F59E0B' : '#EF4444';
    const statusText = isSuccess ? 'Completed Successfully' : hasErrors ? 'Completed with Errors' : 'Failed';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Data Transfer ${statusText}</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px 20px; border-radius: 10px 10px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
            .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; margin: 10px 0; background-color: ${statusColor}; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
            .stat-item { background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; }
            .stat-number { font-size: 24px; font-weight: bold; color: #1e293b; }
            .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 5px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .alert { padding: 15px; border-radius: 6px; margin: 15px 0; }
            .alert-warning { background: #fef3c7; border: 1px solid #fcd34d; color: #92400e; }
            .alert-error { background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; }
            .module-name { text-transform: capitalize; font-weight: bold; color: #6366f1; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📊 Data Transfer Update</h1>
                <p>Your ${moduleName.replace('_', ' ')} data transfer has been processed</p>
            </div>
            
            <div class="content">
                <p>Hello <strong>${userName}</strong>,</p>
                
                <p>We wanted to update you on the status of your recent data transfer request.</p>
                
                <div class="info-box">
                    <h3>📋 Transfer Details</h3>
                    <p><strong>Module:</strong> <span class="module-name">${moduleName.replace('_', ' ')}</span></p>
                    <p><strong>File:</strong> ${fileName}</p>
                    <p><strong>Status:</strong> <span class="status-badge">${statusText}</span></p>
                    <p><strong>Started:</strong> ${new Date(startedAt).toLocaleString()}</p>
                    ${completedAt ? `<p><strong>Completed:</strong> ${new Date(completedAt).toLocaleString()}</p>` : ''}
                </div>

                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-number">${totalRecords || 0}</div>
                        <div class="stat-label">Total Records</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" style="color: #10B981;">${processedRecords || 0}</div>
                        <div class="stat-label">Processed</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" style="color: #EF4444;">${failedRecords || 0}</div>
                        <div class="stat-label">Failed</div>
                    </div>
                </div>

                ${hasErrors ? `
                <div class="alert alert-warning">
                    <strong>⚠️ Attention Required:</strong> Some records failed to process. Please review the error logs in your dashboard for detailed information about the failed records.
                </div>
                ` : ''}

                ${isFailed ? `
                <div class="alert alert-error">
                    <strong>❌ Transfer Failed:</strong> The data transfer could not be completed. Please check your file format and try again, or contact support for assistance.
                </div>
                ` : ''}

                ${isSuccess ? `
                <div class="alert" style="background: #dcfce7; border: 1px solid #86efac; color: #166534;">
                    <strong>✅ Success:</strong> All records have been processed successfully! Your ${moduleName.replace('_', ' ')} data is now available in your system.
                </div>
                ` : ''}

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${dashboardUrl || '#'}" class="button">View Dashboard</a>
                </div>

                <p>If you have any questions about this data transfer or need assistance, please don't hesitate to contact our support team.</p>
            </div>
            
            <div class="footer">
                <p><strong>PackWorkX ERP System</strong></p>
                <p>Need help? Contact us at <a href="mailto:${supportEmail || 'support@packworkx.com'}">${supportEmail || 'support@packworkx.com'}</a></p>
                <p style="font-size: 12px; color: #6b7280; margin-top: 15px;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
};
