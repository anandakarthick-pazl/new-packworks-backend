module.exports = {
    apps: [
        {
            name: "Company-Service",
            script: "./services/company/server.js",  // ✅ Corrected path
            watch: false,
            env: {
                PORT: 3001
            },
        },
        {
            name: "User-Service",
            script: "./services/user-service/server.js",  // ✅ Corrected path
            watch: false,
            env: {
                PORT: 3002
            },
        }
    ]
};
