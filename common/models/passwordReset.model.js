import { DataTypes } from "sequelize";
import sequelize from "../database/database.js";

const PasswordReset = sequelize.define('PasswordReset', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    email: {
        type: DataTypes.STRING(191),
        allowNull: false,
        validate: {
            isEmail: true,
            notEmpty: true,
        },
    },
    token: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    used: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    ip_address: {
        type: DataTypes.STRING(45), // IPv6 support
        allowNull: true,
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'password_resets',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['email'],
        },
        {
            fields: ['token'],
            unique: true,
        },
        {
            fields: ['expires_at'],
        },
        {
            fields: ['used'],
        },
    ],
});

export default PasswordReset;
