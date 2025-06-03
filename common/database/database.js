import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import logger from '../helper/logger.js';

dotenv.config();

console.log('🔍 DB Config:');
console.log('  Host:', process.env.DATABASE_HOST);
console.log('  User:', process.env.DATABASE_USERNAME);
console.log('  Database:', process.env.DATABASE_NAME);
console.log('  Port:', process.env.DATABASE_PORT);

const sequelize = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_USERNAME,
  process.env.DATABASE_PASSWORD,
  {
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT || 3306,
    dialect: 'mysql',

    logging: (query) => logger.info(`SQL Query: ${query}`),

    pool: {
      max: 10,           // Max connections
      min: 0,            // Min connections
      acquire: 60000,    // Max time to get a connection before throwing error
      idle: 10000        // Time before releasing idle connection
    },

    dialectOptions: {
      connectTimeout: 60000 // MySQL connection timeout (60s)
    },

    // define: {
    //   timestamps: false // optional: disable timestamps globally
    // }
  }
);

// Test connection
sequelize.authenticate()
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => {
    console.error('❌ Database connection error:', err);
    logger.error('Database connection error:', err);
  });

export default sequelize;
