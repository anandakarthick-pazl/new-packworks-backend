import sequelize from '../database/database.js';
import User from './user.model.js';
import UserAuth from './userAuth.model.js';
import Company from './company.model.js';
import apiLog from './apiLog.model.js';
import Client from './client.model.js';
import ClientAddress from './ClientAddress.model.js';
import SkuType from './skuModel/skuType.model.js';
import Sku from './skuModel/sku.model.js';
import SalesOrder from './salesOrder/salesOrder.model.js';
import WorkOrder from './salesOrder/workOrder.model.js';


const db = { sequelize, User, Company,UserAuth,apiLog,Client,ClientAddress,SkuType,Sku,SalesOrder,WorkOrder };

export default db;
