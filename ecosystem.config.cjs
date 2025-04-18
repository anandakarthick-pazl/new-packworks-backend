module.exports = {
  apps: [
    {
      name: "Company-Service",
      script: "./services/company/server.js",
      watch: false,
      env: {
        PORT: 3001,
      },
    },
    {
      name: "User-Service",
      script: "./services/user-service/server.js",
      watch: false,
      env: {
        PORT: 3002,
      },
    },
    {
      name: "Client-Service",
      script: "./services/Client/server.js",
      watch: false,
      env: {
        PORT: 3003,
      },
    },
    {
      name: "Sku-Service",
      script: "./services/sku/server.js",
      watch: false,
      env: {
        PORT: 3004,
      },
    },
    {
      name: "SalesOrder-Service",
      script: "./services/salesOrder/server.js",
      watch: false,
      env: {
        PORT: 3005,
      },
    },
    {
      name: "WorkOrder-Service",
      script: "./services/workOrder/server.js",
      watch: false,
      env: {
        PORT: 3006,
      },
    },
    {
      name: "machine-Service",
      script: "./services/machine/server.js",
      env: {
        PORT: 3007,
      },
    },
    {
      name: "common-Service",
      script: "./services/common-service/server.js",
      env: {
        PORT: 3008,
      },
    },
    {
      name: "rbac-Service",
      script: "./services/rbac/server.js",
      env: {
        PORT: 3009,
      },
    },
    {
      name: "department-Service",
      script: "./services/department/server.js",
      env: {
        PORT: 3010,
      },
    },
    {
      name: "designation-Service",
      script: "./services/designations/server.js",
      env: {
        PORT: 3011,
      },
    },
    {
      name: "role-Service",
      script: "./services/role/server.js",
      env: {
        PORT: 3012,
      },
    },
    {
      name: "storage-Service",
      script: "./services/storage/server.js",
      env: {
        PORT: 3013,
      },
    },
    {
      name: "company address-Service",
      script: "./services/company-address/server.js",
      env: {
        PORT: 3014,
      },
    },
    {
      name: "File View-Service",
      script: "./services/upload-view/server.js",
      env: {
        PORT: 3015,
      },
    },
    {

      name: "package",
      script: "./services/package/server.js",

      env: {
        PORT: 3016,
      },
    },
    {

      name: "billing-Service",
      script: "./services/billing/server.js",

      env: {
        PORT: 3017,
      },
    },
    {
      name: "faqs-Service",
      script: "./services/faqs/server.js",

      env: {
        PORT: 3018,
      },
    },
    {

      name: "faq_categories-Service",
      script: "./services/faq-categories/server.js",

      env: {
        PORT: 3019,
      },
    },
    {
      name: "swagger",
      script: "./config/swagger.js",
      env: {
        PORT: 3020,
      },
    },
    {
      name: "taxes",
      script: "./services/taxes/server.js",
      env: {
        PORT: 3021,
      },
    },
    {
      name: "item",
      script: "./services/item/server.js",
      env: {
        PORT: 3022,
      },
    },
    {
      name: "purchase",
      script: "./services/purchase-order/server.js",
      env: {
        PORT: 3023,
      },
    },
    {
      name: "grn",
      script: "./services/grn/server.js",
      env: {
        PORT: 3024,
      },
    },
    {
      name: "inventory",
      script: "./services/inventory/server.js",
      env: {
        PORT: 3025,
      },
    },


  ],
};
