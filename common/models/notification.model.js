import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import { not } from "joi";
import Company from "./company.model.js";
import CompanyAddress from "./companyAddress.model.js";

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
    company_branch_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: CompanyAddress,
            key: "id",
          },
          onUpdate: "CASCADE",
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

notification.belongsTo(Company, {
    foreignKey: 'company_id',
    as: 'company',
});
notification.belongsTo(CompanyAddress, {
  foreignKey: "company_branch_id",
});

export default notification;
