import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";

const WalletHistory = sequelize.define("WalletHistory", {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    type: {
        type: DataTypes.ENUM("debit", "credit"),
        allowNull: false,
        defaultValue: "debit",
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    client_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    company_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,

    },
    refference_number: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    created_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    updated_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: "wallet_history",
    timestamps: false,
});


export default WalletHistory;
