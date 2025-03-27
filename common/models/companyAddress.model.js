import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";

const CompanyAddress = sequelize.define(
  "CompanyAddress",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    country_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_default: {
      type: DataTypes.TINYINT(1),
      allowNull: false,
      defaultValue: 0,
    },
    tax_number: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    tax_name: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    },
  },
  {
    tableName: "company_addresses",
    timestamps: false, // ✅ Disable auto timestamps
  }
);

export default CompanyAddress;
