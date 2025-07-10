require("dotenv").config();

module.exports = {
  apps: [
    {
      name: "Company-Service-prd",
      script: "./services/company/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_COMPANY,
      },
    },
    {
      name: "User-Service-prd",
      script: "./services/user-service/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_USER,
      },
    },
    {
      name: "Client-Service-prd",
      script: "./services/Client/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_CLIENT,
      },
    },
    {
      name: "Sku-Service-prd",
      script: "./services/sku/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_SKU,
      },
    },
    {
      name: "SalesOrder-Service-prd",
      script: "./services/salesOrder/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_SALES_ORDER,
      },
    },
    {
      name: "WorkOrder-Service-prd",
      script: "./services/workOrder/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_WORK_ORDER,
      },
    },
    {
      name: "machine-Service-prd",
      script: "./services/machine/server.js",
      env: {
        PORT: process.env.PORT_MACHINE,
      },
    },
    {
      name: "common-Service-prd",
      script: "./services/common-service/server.js",
      env: {
        PORT: process.env.PORT_COMMON,
      },
    },
    {
      name: "rbac-Service-prd",
      script: "./services/rbac/server.js",
      env: {
        PORT: process.env.PORT_RBAC,
      },
    },
    {
      name: "department-Service-prd",
      script: "./services/department/server.js",
      env: {
        PORT: process.env.PORT_DEPARTMENT,
      },
    },
    {
      name: "designation-Service-prd",
      script: "./services/designations/server.js",
      env: {
        PORT: process.env.PORT_DESIGNATION,
      },
    },
    {
      name: "role-Service-prd",
      script: "./services/role/server.js",
      env: {
        PORT: process.env.PORT_ROLE,
      },
    },
    {
      name: "storage-Service-prd",
      script: "./services/storage/server.js",
      env: {
        PORT: process.env.PORT_STORAGE,
      },
    },
    {
      name: "company address-Service-prd",
      script: "./services/company-address/server.js",
      env: {
        PORT: process.env.PORT_COMPANY_ADDRESS,
      },
    },
    {
      name: "File View-Service-prd",
      script: "./services/upload-view/server.js",
      env: {
        PORT: process.env.PORT_FILE_VIEW,
      },
    },
    {
      name: "package-prd",
      script: "./services/package/server.js",
      env: {
        PORT: process.env.PORT_PACKAGE,
      },
    },
    {
      name: "billing-Service-prd",
      script: "./services/billing/server.js",
      env: {
        PORT: process.env.PORT_BILLING,
      },
    },
    {
      name: "faqs-Service-prd",
      script: "./services/faqs/server.js",
      env: {
        PORT: process.env.PORT_FAQS,
      },
    },
    {
      name: "faq_categories-Service-prd",
      script: "./services/faq-categories/server.js",
      env: {
        PORT: process.env.PORT_FAQ_CATEGORIES,
      },
    },
    {
      name: "swagger-prd",
      script: "./config/swagger.js",
      env: {
        PORT: process.env.PORT_SWAGGER,
      },
    },
    {
      name: "taxes-prd",
      script: "./services/taxes/server.js",
      env: {
        PORT: process.env.PORT_TAXES,
      },
    },
    {
      name: "item-prd",
      script: "./services/item/server.js",
      env: {
        PORT: process.env.PORT_ITEM,
      },
    },
    {
      name: "purchase-prd",
      script: "./services/purchase-order/server.js",
      env: {
        PORT: process.env.PORT_PURCHASE,
      },
    },
    {
      name: "grn-prd",
      script: "./services/grn/server.js",
      env: {
        PORT: process.env.PORT_GRN,
      },
    },
    {
      name: "inventory-prd",
      script: "./services/inventory/server.js",
      env: {
        PORT: process.env.PORT_INVENTORY,
      },
    },
    {
      name: "attendance-service-prd",
      script: "./services/attendance/server.js",
      env: {
        PORT: process.env.PORT_ATTENDANCE,
      },
    },
    {
      name: "route-prd",
      script: "./services/route/server.js",
      env: {
        PORT: process.env.PORT_ROUTE,
      },
    },
    {
      name: "purchase-return-prd",
      script: "./services/purchase-order-return/server.js",
      env: {
        PORT: process.env.PORT_PURCHASE_RETURN,
      },
    },
    {
      name: "production-prd",
      script: "./services/Production/server.js",
      env: {
        PORT: process.env.PORT_PRODUCTION,
      },
    },
    {
      name: "work-invoice-prd",
      script: "./services/work-invoice/server.js",
      env: {
        PORT: process.env.PORT_WORK_INVOICE,
      },
    },
    {
      name: "Stock-Adjustment-prd",
      script: "./services/stock-adjustment/server.js",
      env: {
        PORT: process.env.PORT_STOCK_ADJUSTMENT,
      },
    },
    
    {
      name: "category-prd",
      script: "./services/category/server.js",
      env: {
        PORT: process.env.PORT_CATEGORY,
      },
    },
    
    {
      name: "subCategory-prd",
      script: "./services/sub-category/server.js",
      env: {
        PORT: process.env.PORT_SUB_CATEGORY,
      },
    },
    
    {
      name: "credit-note-prd",
      script: "./services/credit-note/server.js",
      env: {
        PORT: process.env.PORT_CREDIT_NOTE,
      },
    },
    
    {
      name: "debit-note-prd",
      script: "./services/debit-note/server.js",
      env: {
        PORT: process.env.PORT_DEBIT_NOTE,
      },
    },
    
    {
      name: "dashboard-prd",
      script: "./services/dashboard/server.js",
      env: {
        PORT: process.env.PORT_DASHBOARD,
      },
    },
    
     {
      name: "salesOrderReturn-prd",
      script: "./services/salesOrderReturn/server.js",
      env: {
        PORT: process.env.PORT_SALESORDERRETURN,
      },
    },
    
    {
      name: "report-prd",
      script: "./services/report/server.js",
      env: {
        PORT: process.env.PORT_REPORT,
      },
    },
    
    {
      name: "production-schedule-prd",
      script: "./services/productionSchedule/server.js",
      env: {
        PORT: process.env.PORT_PRODUCTION_SCHEDULE,
      },
    },
    
    {
      name: "data-transfer-prd",
      script: "./services/data-transfer/server.js",
      env: {
        PORT: process.env.PORT_DATA_TRANSFER,
      },
    },
  ],
};
