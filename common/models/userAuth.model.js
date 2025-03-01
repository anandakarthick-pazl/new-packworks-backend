import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../database/database.js';

const UserAuth = sequelize.define('UserAuth', {
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    email: {
        type: DataTypes.STRING(191),
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING(191),
        allowNull: false,
    },
    remember_token: {
        type: DataTypes.STRING(191),
        allowNull: true,
    },
    two_factor_secret: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    two_factor_recovery_codes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    two_factor_confirmed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    two_factor_email_confirmed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    two_fa_verify_via: {
        type: DataTypes.ENUM("email", "google_authenticator", "both"),
        allowNull: true,
    },
    two_factor_code: {
        type: DataTypes.STRING(191),
        allowNull: true,
        comment: "Used when authenticator is email",
    },
    two_factor_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    email_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    email_verification_code: {
        type: DataTypes.STRING(191),
        allowNull: true,
    },
    email_code_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'user_auths',
    timestamps: false,
});

export default UserAuth;
