module.exports = {
  apps: [
    {
      name: "Company-Service",
      script: "./services/company/server.js", // ✅ Corrected path
      watch: false,
      env: {
        PORT: 3001,
      },
    },
    {
      name: "User-Service",
      script: "./services/user-service/server.js", // ✅ Corrected path
      watch: false,
      env: {
        PORT: 3002,
      },
    },
    {
      name: "Client-Service",
      script: "./services/client/server.js", // ✅ Corrected path
      watch: false,
      env: {
        PORT: 3002,
      },
    },
    {
      name: "Sku-Service",
      script: "./services/sku/server.js", // ✅ Corrected path
      watch: false,
      env: {
        PORT: 3003,
      },
    },
    {
      name: "SalesOrder-Service",
      script: "./services/salesOrder/server.js", // ✅ Corrected path
      watch: false,
      env: {
        PORT: 3004,
      },
    },
  ],
};
