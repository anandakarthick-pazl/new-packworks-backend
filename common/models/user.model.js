import { DataTypes } from 'sequelize';
import  sequelize from '../database/database.js';
import Company from './company.model.js';

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    company_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
            model: Company,
            key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    },
    user_auth_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
    },
    is_superadmin: {
        type: DataTypes.TINYINT(1),
        defaultValue: 0,
    },
    customised_permissions: {
        type: DataTypes.TINYINT(1),
        defaultValue: 0,
    },
    name: {
        type: DataTypes.STRING(191),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(191),
        allowNull: true,
        unique: 'email_company_unique',
    },
    image: {
        type: DataTypes.STRING(191),
        allowNull: true,
    },
    country_phonecode: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    mobile: {
        type: DataTypes.STRING(191),
        allowNull: true,
    },
    gender: {
        type: DataTypes.ENUM('male', 'female', 'others'),
        defaultValue: 'male',
    },
    salutation: {
        type: DataTypes.ENUM('mr', 'mrs', 'miss', 'dr', 'sir', 'madam'),
        allowNull: true,
    },
    locale: {
        type: DataTypes.STRING(191),
        defaultValue: 'en',
    },
    status: {
        type: DataTypes.ENUM('active', 'deactive'),
        defaultValue: 'active',
    },
    login: {
        type: DataTypes.ENUM('enable', 'disable'),
        defaultValue: 'enable',
    },
    last_login: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    email_notifications: {
        type: DataTypes.TINYINT(1),
        defaultValue: 1,
    },
    dark_theme: {
        type: DataTypes.TINYINT(1),
        allowNull: true,
    },
    rtl: {
        type: DataTypes.TINYINT(1),
        allowNull: true,
    },
    admin_approval: {
        type: DataTypes.TINYINT(1),
        defaultValue: 1,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    tableName: 'users',
    timestamps: false,
});

export default User;
