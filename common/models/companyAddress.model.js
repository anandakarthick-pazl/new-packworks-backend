import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";
import { formatDateTime } from "../utils/dateFormatHelper.js";

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
      references: {
        model: Company,
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
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
      defaultValue: DataTypes.NOW,
      get() {
        return formatDateTime(this.getDataValue("created_at"));
      },
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      get() {
        return formatDateTime(this.getDataValue("updated_at"));
      },
    },
  },
  {
    tableName: "company_addresses",
    timestamps: false,
  }
);

CompanyAddress.belongsTo(Company, {
  foreignKey: "company_id",
  as: "company_address",
});

export default CompanyAddress;
