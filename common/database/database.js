import { Sequelize } from 'sequelize';
import dotenv from "dotenv";
dotenv.config();
import logger from '../helper/logger.js';  
import mysql2 from 'mysql2';

console.log("🔍 DB Config:");
console.log("  Host:", process.env.DATABASE_HOST);
console.log("  User:", process.env.DATABASE_USERNAME);
console.log("  Database:", process.env.DATABASE_NAME);
console.log("  Port:", process.env.DATABASE_PORT);

const sequelize = new Sequelize(process.env.DATABASE_NAME, process.env.DATABASE_USERNAME, process.env.DATABASE_PASSWORD, {
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT || 3306,
    dialect: 'mysql',
    dialectModule: mysql2,
    logging: (query) => logger.info(`SQL Query: ${query}`), // ✅ Logs all queries to file

});

sequelize.authenticate()
    .then(() => console.log('Database connected'))
    .catch(err => console.error('Database connection error:', err));

export default sequelize;