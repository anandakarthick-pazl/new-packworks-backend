require("dotenv").config();

module.exports = {
  apps: [
    {
      name: "Company-Service",
      script: "./services/company/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_COMPANY,
      },
    },
    {
      name: "User-Service",
      script: "./services/user-service/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_USER,
      },
    },
    {
      name: "Client-Service",
      script: "./services/Client/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_CLIENT,
      },
    },
    {
      name: "Sku-Service",
      script: "./services/sku/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_SKU,
      },
    },
    {
      name: "SalesOrder-Service",
      script: "./services/salesOrder/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_SALES_ORDER,
      },
    },
    {
      name: "WorkOrder-Service",
      script: "./services/workOrder/server.js",
      watch: false,
      env: {
        PORT: process.env.PORT_WORK_ORDER,
      },
    },
    {
      name: "machine-Service",
      script: "./services/machine/server.js",
      env: {
        PORT: process.env.PORT_MACHINE,
      },
    },
    {
      name: "common-Service",
      script: "./services/common-service/server.js",
      env: {
        PORT: process.env.PORT_COMMON,
      },
    },
    {
      name: "rbac-Service",
      script: "./services/rbac/server.js",
      env: {
        PORT: process.env.PORT_RBAC,
      },
    },
    {
      name: "department-Service",
      script: "./services/department/server.js",
      env: {
        PORT: process.env.PORT_DEPARTMENT,
      },
    },
    {
      name: "designation-Service",
      script: "./services/designations/server.js",
      env: {
        PORT: process.env.PORT_DESIGNATION,
      },
    },
    {
      name: "role-Service",
      script: "./services/role/server.js",
      env: {
        PORT: process.env.PORT_ROLE,
      },
    },
    {
      name: "storage-Service",
      script: "./services/storage/server.js",
      env: {
        PORT: process.env.PORT_STORAGE,
      },
    },
    {
      name: "company address-Service",
      script: "./services/company-address/server.js",
      env: {
        PORT: process.env.PORT_COMPANY_ADDRESS,
      },
    },
    {
      name: "File View-Service",
      script: "./services/upload-view/server.js",
      env: {
        PORT: process.env.PORT_FILE_VIEW,
      },
    },
    {
      name: "package",
      script: "./services/package/server.js",
      env: {
        PORT: process.env.PORT_PACKAGE,
      },
    },
    {
      name: "billing-Service",
      script: "./services/billing/server.js",
      env: {
        PORT: process.env.PORT_BILLING,
      },
    },
    {
      name: "faqs-Service",
      script: "./services/faqs/server.js",
      env: {
        PORT: process.env.PORT_FAQS,
      },
    },
    {
      name: "faq_categories-Service",
      script: "./services/faq-categories/server.js",
      env: {
        PORT: process.env.PORT_FAQ_CATEGORIES,
      },
    },
    {
      name: "swagger",
      script: "./config/swagger.js",
      env: {
        PORT: process.env.PORT_SWAGGER,
      },
    },
    {
      name: "taxes",
      script: "./services/taxes/server.js",
      env: {
        PORT: process.env.PORT_TAXES,
      },
    },
    {
      name: "item",
      script: "./services/item/server.js",
      env: {
        PORT: process.env.PORT_ITEM,
      },
    },
    {
      name: "purchase",
      script: "./services/purchase-order/server.js",
      env: {
        PORT: process.env.PORT_PURCHASE,
      },
    },
    {
      name: "grn",
      script: "./services/grn/server.js",
      env: {
        PORT: process.env.PORT_GRN,
      },
    },
    {
      name: "inventory",
      script: "./services/inventory/server.js",
      env: {
        PORT: process.env.PORT_INVENTORY,
      },
    },
    {
      name: "attendance-service",
      script: "./services/attendance/server.js",
      env: {
        PORT: process.env.PORT_ATTENDANCE,
      },
    },
    {
      name: "route",
      script: "./services/route/server.js",
      env: {
        PORT: process.env.PORT_ROUTE,
      },
    },
    {
      name: "purchase-return",
      script: "./services/purchase-order-return/server.js",
      env: {
        PORT: process.env.PORT_PURCHASE_RETURN,
      },
    },
    {
      name: "production",
      script: "./services/Production/server.js",
      env: {
        PORT: process.env.PORT_PRODUCTION,
      },
    },
    {
      name: "work-invoice",
      script: "./services/work-invoice/server.js",
      env: {
        PORT: process.env.PORT_WORK_INVOICE,
      },
    },
  ],
};
