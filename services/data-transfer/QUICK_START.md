# Quick Start Guide - Data Transfer API

## ⚠️ Current Status: Basic Mode
The API is currently running in **basic mode** without column mapping feature. You need to update the database first to enable full functionality.

## 🚀 Quick Start Steps

### 1. Update Database Schema
Run this SQL command in your MySQL database:

```sql
-- Add column_mapping column to data_transfers table
ALTER TABLE data_transfers 
ADD COLUMN column_mapping TEXT NULL 
COMMENT 'JSON mapping of Excel columns to database fields';

-- Update status enum to include 'uploaded' status  
ALTER TABLE data_transfers 
MODIFY COLUMN status ENUM('uploaded', 'pending', 'processing', 'completed', 'failed') 
NOT NULL DEFAULT 'uploaded' 
COMMENT 'Current status of the data transfer process';
```

### 2. Test Working Endpoints

**✅ Working Endpoints (No database changes needed):**

1. **Health Check**
   ```bash
   GET http://localhost:3020/health
   ```

2. **Get Available Modules**
   ```bash
   GET http://localhost:3020/api/data/transfer/modules
   Headers: Authorization: Bearer YOUR_JWT_TOKEN
   ```

3. **Get Transfer History**
   ```bash
   GET http://localhost:3020/api/data/transfer/history
   Headers: Authorization: Bearer YOUR_JWT_TOKEN
   ```

4. **Get Transfer History (Simple)**
   ```bash
   GET http://localhost:3020/api/data/transfer/history-simple
   Headers: Authorization: Bearer YOUR_JWT_TOKEN
   ```

5. **Download Template**
   ```bash
   GET http://localhost:3020/api/data/transfer/template/employee
   Headers: Authorization: Bearer YOUR_JWT_TOKEN
   ```

6. **Dashboard Summary**
   ```bash
   GET http://localhost:3020/api/data/transfer/dashboard
   Headers: Authorization: Bearer YOUR_JWT_TOKEN
   ```

### 3. Test in Postman

1. **Import Collection:** Use the `Data_Transfer_API.postman_collection.json`
2. **Set Variables:**
   - `base_url`: http://localhost:3020
   - `jwt_token`: Your actual JWT token
3. **Test endpoints in this order:**
   - Health Check
   - Get Available Modules
   - Get Transfer History
   - Download Template

## 🔧 After Database Update

Once you run the SQL commands above, these additional endpoints will work:

1. **Upload Excel File**
   ```bash
   POST http://localhost:3020/api/data/transfer/upload
   ```

2. **Column Mapping**
   ```bash
   POST http://localhost:3020/api/data/transfer/map-columns/{id}
   ```

3. **Get Preview**
   ```bash
   GET http://localhost:3020/api/data/transfer/preview/{id}
   ```

## 📋 Sample Test Data

You can test with this sample employee Excel file structure:

| Employee ID | Name | Address | Skills | Hourly Rate |
|-------------|------|---------|---------|-------------|
| EMP001 | John Doe | 123 Main St | JavaScript | 25.50 |
| EMP002 | Jane Smith | 456 Oak Ave | Python | 30.00 |

## 🛠️ Troubleshooting

**Issue:** "User is not associated to DataTransfer!"
**Solution:** ✅ Fixed! Use the simplified endpoints.

**Issue:** "Unknown column 'column_mapping'"
**Solution:** Run the SQL commands above.

**Issue:** Authentication errors
**Solution:** Check your JWT token in Postman variables.

## 📞 Support

If you encounter any issues:
1. Check the console logs for detailed error messages
2. Verify your JWT token is valid
3. Ensure the service is running on port 3020
4. Test with the simple endpoints first

## 🎯 Next Steps

1. ✅ Test basic endpoints
2. 🔄 Update database schema
3. 🚀 Test full column mapping functionality
4. 📊 Integrate with your React frontend
