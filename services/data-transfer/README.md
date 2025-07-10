# Data Transfer Service API Documentation

## Overview
The Data Transfer Service provides APIs for uploading and processing Excel files to import data into various modules of the PackWorkX ERP system. It supports module-based data processing with email notifications upon completion.

## Supported Modules
- `employee` - Employee data
- `sale_order` - Sales Order data  
- `work_order` - Work Order data
- `machine` - Machine data
- `route` - Route data
- `client` - Client data
- `item` - Item Master data
- `purchase_order` - Purchase Order data
- `inventory` - Inventory data
- `sku` - SKU data
- `category` - Category data
- `package` - Package data

## API Endpoints

### 1. Get Available Modules
**GET** `/api/data/transfer/modules`

Returns list of available modules for data transfer.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "value": "employee",
      "label": "Employee",
      "description": "Import employee data"
    }
  ],
  "message": "Available modules retrieved successfully"
}
```

### 2. Upload Excel File
**POST** `/api/data/transfer/upload`

Uploads an Excel file for data transfer processing.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file` (file) - Excel file (.xlsx, .xls, .csv)
- `module_name` (string) - Module name (e.g., 'employee', 'sale_order')
- `email` (string) - Email address for completion notification

**Response:**
```json
{
  "success": true,
  "data": {
    "transfer_id": 123,
    "file_name": "employees.xlsx",
    "file_size": 15360,
    "module_name": "employee",
    "status": "pending"
  },
  "message": "File uploaded successfully. Processing started."
}
```

### 3. Get Transfer Status
**GET** `/api/data/transfer/status/:transfer_id`

Returns the current status of a data transfer.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "module_name": "employee",
    "file_name": "employees.xlsx",
    "status": "completed",
    "total_records": 100,
    "processed_records": 95,
    "failed_records": 5,
    "started_at": "2025-06-26T10:00:00Z",
    "completed_at": "2025-06-26T10:05:00Z",
    "error_log": "Row 5: Missing required field...",
    "email_sent": true
  },
  "message": "Data transfer status retrieved successfully"
}
```

### 4. Get Transfer History
**GET** `/api/data/transfer/history`

Returns paginated list of data transfers for the company.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (number) - Page number (default: 1)
- `limit` (number) - Records per page (default: 10)
- `status` (string) - Filter by status (pending, processing, completed, failed)
- `module_name` (string) - Filter by module name

**Response:**
```json
{
  "success": true,
  "data": {
    "transfers": [
      {
        "id": 123,
        "module_name": "employee",
        "file_name": "employees.xlsx",
        "status": "completed",
        "total_records": 100,
        "processed_records": 95,
        "failed_records": 5,
        "created_at": "2025-06-26T10:00:00Z",
        "creator": {
          "id": 1,
          "name": "John Doe",
          "email": "john@example.com"
        }
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "total_pages": 5
    }
  },
  "message": "Data transfer history retrieved successfully"
}
```

### 5. Download Excel Template
**GET** `/api/data/transfer/template/:module_name`

Downloads an Excel template for the specified module.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
Excel file download with appropriate headers and sample data.

### 6. Dashboard Summary
**GET** `/api/data/transfer/dashboard`

Returns data transfer statistics and recent transfers.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `from_date` (string) - Start date (YYYY-MM-DD)
- `to_date` (string) - End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_transfers": 150,
      "status_breakdown": {
        "completed": 120,
        "failed": 20,
        "processing": 5,
        "pending": 5
      },
      "module_breakdown": [
        {
          "module": "employee",
          "count": 50
        },
        {
          "module": "client",
          "count": 30
        }
      ]
    },
    "recent_transfers": [
      {
        "id": 123,
        "module_name": "employee",
        "file_name": "employees.xlsx",
        "status": "completed",
        "created_at": "2025-06-26T10:00:00Z"
      }
    ]
  },
  "message": "Dashboard data retrieved successfully"
}
```

## Excel File Format Requirements

### General Guidelines
1. First row must contain column headers
2. Data starts from row 2
3. Supported formats: .xlsx, .xls, .csv
4. Maximum file size: 50MB
5. Empty rows will be skipped

### Module-Specific Templates

#### Employee Template
| S.No | Employee ID | Address | Skills | Hourly Rate | Department ID | Designation ID | Joining Date | Employment Type |
|------|-------------|---------|--------|-------------|---------------|----------------|--------------|----------------|
| 1 | EMP001 | 123 Main St | JavaScript, Node.js | 25.50 | 1 | 1 | 2024-01-15 | Full-time |

#### Sales Order Template
| S.No | Client ID | Order Number | Order Date | Delivery Date | Total Amount | Status |
|------|-----------|--------------|------------|---------------|--------------|--------|
| 1 | 1 | SO001 | 2024-06-01 | 2024-06-15 | 1500.00 | pending |

#### Work Order Template
| S.No | Work Order Number | Sales Order ID | Start Date | End Date | Status | Priority |
|------|-------------------|----------------|------------|----------|--------|---------|
| 1 | WO001 | 1 | 2024-06-01 | 2024-06-10 | pending | high |

#### Machine Template
| S.No | Machine Name | Machine Code | Machine Type | Capacity | Location | Status |
|------|--------------|--------------|--------------|----------|----------|--------|
| 1 | Printing Machine 1 | PM001 | Printing | 1000 | Floor 1 | active |

#### Client Template
| S.No | Client Name | Email | Phone | Address | City | State | Country | Status |
|------|-------------|-------|-------|---------|------|-------|---------|--------|
| 1 | ABC Corp | contact@abc.com | +1234567890 | 123 Business St | New York | NY | USA | active |

## Status Values

### Transfer Status
- `pending` - Transfer is queued for processing
- `processing` - Transfer is currently being processed
- `completed` - Transfer completed successfully
- `failed` - Transfer failed completely

### Record Status
- `processed_records` - Number of records successfully imported
- `failed_records` - Number of records that failed to import
- `total_records` - Total number of records in the file

## Error Handling

### Common Error Responses

**400 Bad Request**
```json
{
  "success": false,
  "message": "Invalid module name"
}
```

**401 Unauthorized**
```json
{
  "success": false,
  "message": "Authentication required"
}
```

**404 Not Found**
```json
{
  "success": false,
  "message": "Data transfer not found"
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "message": "Failed to process request",
  "error": "Detailed error message"
}
```

## Email Notifications

The system automatically sends email notifications when data transfer processing is completed. The email includes:

- Transfer status (Success/Failed/Partial)
- Processing statistics (total, processed, failed records)
- Error details (if any)
- Link to dashboard

## Usage Examples

### JavaScript/Node.js Example

```javascript
// Upload Excel file for employee data transfer
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('module_name', 'employee');
formData.append('email', 'user@company.com');

const response = await fetch('/api/data/transfer/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();
console.log('Transfer ID:', result.data.transfer_id);

// Check transfer status
const statusResponse = await fetch(`/api/data/transfer/status/${result.data.transfer_id}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const status = await statusResponse.json();
console.log('Status:', status.data.status);
```

### cURL Example

```bash
# Upload file
curl -X POST \
  http://localhost:3020/api/data/transfer/upload \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -F 'file=@employees.xlsx' \
  -F 'module_name=employee' \
  -F 'email=user@company.com'

# Check status
curl -X GET \
  http://localhost:3020/api/data/transfer/status/123 \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'

# Download template
curl -X GET \
  http://localhost:3020/api/data/transfer/template/employee \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -O -J
```

## Configuration

### Environment Variables

```env
# Service Port
PORT_DATA_TRANSFER=3020

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_NAME=PackWorkX
FROM_EMAIL=noreply@packworkx.com
SUPPORT_EMAIL=support@packworkx.com

# Frontend URLs
FRONTEND_URL=http://localhost:3000
ADMIN_PANEL_URL=http://localhost:3000/admin
```

### File Upload Configuration

- **Upload Directory:** `uploads/data-transfer/`
- **Max File Size:** 50MB
- **Allowed File Types:** .xlsx, .xls, .csv
- **File Naming:** `{company_id}-{module_name}-{timestamp}-{original_name}`

## Monitoring and Logging

### Health Check
**GET** `/health`

Returns service health status and supported modules.

```json
{
  "status": "Data Transfer Service is running",
  "timestamp": "2025-06-26T10:00:00Z",
  "modules_supported": ["employee", "sale_order", "work_order", ...]
}
```

### Logs

The service logs all operations including:
- File uploads
- Processing progress
- Email notifications
- Errors and exceptions

Logs are available in the `/logs` directory with daily rotation.

## Migration

To set up the database table, run the migration:

```bash
npm run migrate
```

This will create the `data_transfers` table with all necessary indexes.

## Security Considerations

1. **Authentication:** All endpoints require valid JWT token
2. **File Validation:** Only Excel/CSV files are accepted
3. **File Size Limits:** 50MB maximum file size
4. **Company Isolation:** Users can only access their company's data transfers
5. **File Storage:** Uploaded files are stored securely with unique naming
6. **Input Validation:** All data is validated before processing

## Performance Considerations

1. **Async Processing:** Large files are processed asynchronously
2. **Batch Updates:** Progress is updated in batches to reduce database load
3. **Memory Management:** Excel files are processed row by row to minimize memory usage
4. **Indexing:** Database indexes on frequently queried columns
5. **File Cleanup:** Old files can be cleaned up periodically

## Troubleshooting

### Common Issues

1. **File Upload Fails**
   - Check file size (max 50MB)
   - Verify file format (.xlsx, .xls, .csv)
   - Ensure proper authentication

2. **Processing Fails**
   - Check Excel file format and headers
   - Verify data types match expected format
   - Review error logs for specific issues

3. **Email Not Sent**
   - Check SMTP configuration
   - Verify email address format
   - Check email service logs

4. **Database Errors**
   - Ensure migration is run
   - Check foreign key constraints
   - Verify user permissions

### Support

For technical support, contact the development team or check the logs for detailed error messages.
