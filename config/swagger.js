import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

// ✅ Swagger Configuration
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Packworkx',
            version: '1.0.0',
            description: 'API for managing Packworkx',
            contact: {
                name: 'Selvakumar',
                email: 'selvakumar.m@pazl.info',
            },
        },
        servers: [
            {
                // url: process.env.SERVER_URL || 'http://localhost:3001/api/',                         //company
                // url: process.env.SERVER_URL || 'http://localhost:3002/api/',                         //user-service
                // url: process.env.SERVER_URL || 'http://localhost:3003/api/',                         //client
                // url: process.env.SERVER_URL || 'http://localhost:3004/api/',                         //sku
                // url: process.env.SERVER_URL || 'http://localhost:3005/api/',                         //sales
                // url: process.env.SERVER_URL || 'http://localhost:3006/api/',                         //work
                // url: process.env.SERVER_URL || 'http://localhost:3007/api/',                         //machine
                // url: process.env.SERVER_URL || 'http://localhost:3008/api/',                         //common
                // url: process.env.SERVER_URL || 'http://localhost:3009/api/',                         //rbac
                // url: process.env.SERVER_URL || 'http://localhost:3010/api/',                         //department
                // url: process.env.SERVER_URL || 'http://localhost:3011/api/',                         //designation
                // url: process.env.SERVER_URL || 'http://localhost:3012/api/',                         //role
                // url: process.env.SERVER_URL || 'http://localhost:3013/api/',                         //storage
                // url: process.env.SERVER_URL || 'http://localhost:3014/api/',                         //company-address
                // url: process.env.SERVER_URL || 'http://localhost:3016/api/',                         //package
                // url: process.env.SERVER_URL || 'http://localhost:3017/api/',                         //billing
                // url: process.env.SERVER_URL || 'http://localhost:3021/api/',                         //taxes
                                                                                 
                url: process.env.SERVER_URL || 'https://packworkx.pazl.info/api',                    //live
                description: 'Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    // apis: ['./services/*.js'],
    apis: ['./services/**/*.js'],

};
// console.log("test");

const swaggerSpec = swaggerJSDoc(swaggerOptions);
const PORT = 3020;

export default function setupSwagger(app) {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
 }

const app = express();
setupSwagger(app);
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/api-docs`);
});
