import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";

// Define Notification model (if not already defined)
const notification = sequelize.define('notification', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    notification_type: {
        type: DataTypes.ENUM('low_stock', 'out_of_stock', 'reorder'),
        defaultValue: 'low_stock'
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    current_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    min_stock_level: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    status: {
        type: DataTypes.ENUM('active', 'resolved', 'dismissed'),
        defaultValue: 'active'
    },
    email_sent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    email_sent_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default notification;
