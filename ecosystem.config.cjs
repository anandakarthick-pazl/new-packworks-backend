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
    }, {
      name: "rbac-Service",
      script: "./services/rbac/server.js",
      env: {
        PORT: 3009,
      },
    },
  ],
};
