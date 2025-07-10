require("dotenv").config();

module.exports = {
  apps: [
    {
      name: "Company-Service-dev",
      script: "./services/company/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_COMPANY,
      },
    },
    {
      name: "User-Service-dev",
      script: "./services/user-service/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_USER,
      },
    },
    {
      name: "Client-Service-dev",
      script: "./services/Client/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_CLIENT,
      },
    },
    {
      name: "Sku-Service-dev",
      script: "./services/sku/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_SKU,
      },
    },
    {
      name: "SalesOrder-Service-dev",
      script: "./services/salesOrder/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_SALES_ORDER,
      },
    },
    {
      name: "WorkOrder-Service-dev",
      script: "./services/workOrder/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_WORK_ORDER,
      },
    },
    {
      name: "machine-Service-dev",
      script: "./services/machine/server.js",
      env: {
        PORT: process.env.PORT_MACHINE,
      },
    },
    {
      name: "common-Service-dev",
      script: "./services/common-service/server.js",
      env: {
        PORT: process.env.PORT_COMMON,
      },
    },
    {
      name: "rbac-Service-dev",
      script: "./services/rbac/server.js",
      env: {
        PORT: process.env.PORT_RBAC,
      },
    },
    {
      name: "department-Service-dev",
      script: "./services/department/server.js",
      env: {
        PORT: process.env.PORT_DEPARTMENT,
      },
    },
    {
      name: "designation-Service-dev",
      script: "./services/designations/server.js",
      env: {
        PORT: process.env.PORT_DESIGNATION,
      },
    },
    {
      name: "role-Service-dev",
      script: "./services/role/server.js",
      env: {
        PORT: process.env.PORT_ROLE,
      },
    },
    {
      name: "storage-Service-dev",
      script: "./services/storage/server.js",
      env: {
        PORT: process.env.PORT_STORAGE,
      },
    },
    {
      name: "company address-Service-dev",
      script: "./services/company-address/server.js",
      env: {
        PORT: process.env.PORT_COMPANY_ADDRESS,
      },
    },
    {
      name: "File View-Service-dev",
      script: "./services/upload-view/server.js",
      env: {
        PORT: process.env.PORT_FILE_VIEW,
      },
    },
    {
      name: "package-dev",
      script: "./services/package/server.js",
      env: {
        PORT: process.env.PORT_PACKAGE,
      },
    },
    {
      name: "billing-Service-dev",
      script: "./services/billing/server.js",
      env: {
        PORT: process.env.PORT_BILLING,
      },
    },
    {
      name: "faqs-Service-dev",
      script: "./services/faqs/server.js",
      env: {
        PORT: process.env.PORT_FAQS,
      },
    },
    {
      name: "faq_categories-Service-dev",
      script: "./services/faq-categories/server.js",
      env: {
        PORT: process.env.PORT_FAQ_CATEGORIES,
      },
    },
    {
      name: "swagger-dev",
      script: "./config/swagger.js",
      env: {
        PORT: process.env.PORT_SWAGGER,
      },
    },
    {
      name: "taxes-dev",
      script: "./services/taxes/server.js",
      env: {
        PORT: process.env.PORT_TAXES,
      },
    },
    {
      name: "item-dev",
      script: "./services/item/server.js",
      env: {
        PORT: process.env.PORT_ITEM,
      },
    },
    {
      name: "purchase-dev",
      script: "./services/purchase-order/server.js",
      env: {
        PORT: process.env.PORT_PURCHASE,
      },
    },
    {
      name: "grn-dev",
      script: "./services/grn/server.js",
      env: {
        PORT: process.env.PORT_GRN,
      },
    },
    {
      name: "inventory-dev",
      script: "./services/inventory/server.js",
      env: {
        PORT: process.env.PORT_INVENTORY,
      },
    },
    {
      name: "attendance-service-dev",
      script: "./services/attendance/server.js",
      env: {
        PORT: process.env.PORT_ATTENDANCE,
      },
    },
    {
      name: "route-dev",
      script: "./services/route/server.js",
      env: {
        PORT: process.env.PORT_ROUTE,
      },
    },
    {
      name: "purchase-return-dev",
      script: "./services/purchase-order-return/server.js",
      env: {
        PORT: process.env.PORT_PURCHASE_RETURN,
      },
    },
    {
      name: "production-dev",
      script: "./services/Production/server.js",
      env: {
        PORT: process.env.PORT_PRODUCTION,
      },
    },
    {
      name: "work-invoice-dev",
      script: "./services/work-invoice/server.js",
      env: {
        PORT: process.env.PORT_WORK_INVOICE,
      },
    },
    {
      name: "Stock-Adjustment-dev",
      script: "./services/stock-adjustment/server.js",
      env: {
        PORT: process.env.PORT_STOCK_ADJUSTMENT,
      },
    },
    
    {
      name: "category - dev",
      script: "./services/category/server.js",
      env: {
        PORT: process.env.PORT_CATEGORY,
      },
    },
    
    {
      name: "subCategory - dev",
      script: "./services/sub-category/server.js",
      env: {
        PORT: process.env.PORT_SUB_CATEGORY,
      },
    },
    
    {
      name: "credit-note - dev",
      script: "./services/credit-note/server.js",
      env: {
        PORT: process.env.PORT_CREDIT_NOTE,
      },
    },
    
    {
      name: "debit-note - dev",
      script: "./services/debit-note/server.js",
      env: {
        PORT: process.env.PORT_DEBIT_NOTE,
      },
    },
    
    {
      name: "dashboard - dev",
      script: "./services/dashboard/server.js",
      env: {
        PORT: process.env.PORT_DASHBOARD,
      },
    },
    
     {
      name: "salesOrderReturn - dev",
      script: "./services/salesOrderReturn/server.js",
      env: {
        PORT: process.env.PORT_SALESORDERRETURN,
      },
    },
    
    {
      name: "report - dev",
      script: "./services/report/server.js",
      env: {
        PORT: process.env.PORT_REPORT,
      },
    },
    
    {
      name: "production-schedule - dev",
      script: "./services/productionSchedule/server.js",
      env: {
        PORT: process.env.PORT_PRODUCTION_SCHEDULE,
      },
    },
    
    {
      name: "data-transfer - dev",
      script: "./services/data-transfer/server.js",
      env: {
        PORT: process.env.PORT_DATA_TRANSFER,
      },
    },
  ],
};
