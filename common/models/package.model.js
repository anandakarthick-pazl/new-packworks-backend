import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Currency from "./currency.model.js"; // 👈 Ensure this import exists

const Package = sequelize.define(
  "packages",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    currency_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    max_storage_size: {
      type: DataTypes.INTEGER(11),
      allowNull: true,
    },
    max_file_size: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    annual_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
    },
    monthly_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
    },
    billing_cycle: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    max_employees: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    sort: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    module_in_package: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },
    stripe_annual_plan_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    stripe_monthly_plan_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    razorpay_annual_plan_id: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    razorpay_monthly_plan_id: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    default: {
      type: DataTypes.ENUM('yes', 'no', 'trial'),
      allowNull: false,
      defaultValue: 'no',
    },
    paystack_monthly_plan_id: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    paystack_annual_plan_id: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    is_private: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    storage_unit: {
      type: DataTypes.ENUM("gb", "mb"),
      allowNull: false,
      defaultValue: "mb",
    },
    is_recommended: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_free: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_auto_renew: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    monthly_status: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "1",
    },
    annual_status: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "1",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    created_by: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
    },
    updated_by: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
    },
  },
  {
    tableName: "packages",
    timestamps: false,
  }
);

// ✅ Define the association AFTER the model is created
Package.belongsTo(Currency, {
  foreignKey: "currency_id",
  as: "currency",
});

export default Package;
