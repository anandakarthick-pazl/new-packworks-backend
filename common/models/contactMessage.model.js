import { DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import { formatDateTime } from '../utils/dateFormatHelper.js';

const ContactMessage = sequelize.define('ContactMessage', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [2, 255],
        },
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            isEmail: true,
            notEmpty: true,
        },
    },
    company: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    subject: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [5, 500],
        },
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [10, 5000],
        },
    },
    status: {
        type: DataTypes.ENUM('new', 'read', 'replied', 'resolved', 'spam'),
        allowNull: false,
        defaultValue: 'new',
    },
    replied_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    replied_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    priority: {
        type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'normal',
    },
    category: {
        type: DataTypes.ENUM('general', 'support', 'sales', 'technical', 'billing', 'demo', 'partnership'),
        allowNull: true,
    },
    ip_address: {
        type: DataTypes.STRING(45), // IPv6 support
        allowNull: true,
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    source: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'website_contact_form',
    },
    admin_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        get() {
            return formatDateTime(this.getDataValue('created_at'));
        }
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        get() {
            return formatDateTime(this.getDataValue('updated_at'));
        }
    },
}, {
    tableName: 'contact_messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['email'],
        },
        {
            fields: ['status'],
        },
        {
            fields: ['priority'],
        },
        {
            fields: ['category'],
        },
        {
            fields: ['created_at'],
        },
        {
            fields: ['name'],
        },
    ],
});

export default ContactMessage;
