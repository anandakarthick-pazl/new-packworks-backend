import sequelize from '../database/database.js';
import User from './user.model.js';
import UserAuth from './userAuth.model.js';
import Company from './company.model.js';
import apiLog from './apiLog.model.js';

const db = { sequelize, User, Company,UserAuth,apiLog };

export default db;
