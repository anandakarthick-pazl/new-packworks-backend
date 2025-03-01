import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../database/database.js';
import e from 'express';

const apiLog = sequelize.define('api_logs', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    method: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    url: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    statusCode: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    requestBody: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    requestHeaders: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    responseBody: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    errorMessage: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    stackTrace: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
    }
}, {
    tableName: 'api_logs',
    timestamps: true, // Assumes createdAt and updatedAt are present
});

export default apiLog;
