module.exports = {
  apps: [
    {
      name: "Company-Service",
      script: "node services/company/server.js",
      watch: false,
      env: {
        PORT: 3001,
      },
    },
    {
      name: "User-Service",
      script: "node services/user-service/server.js",
      watch: false,
      env: {
        PORT: 3002,
      },
    },
    {
      name: "Client-Service",
      script: "node services/Client/server.js",
      watch: false,
      env: {
        PORT: 3003,
      },
    },
  ],
};
