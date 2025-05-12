import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";

const Company = sequelize.define(
  "Company",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    company_name: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    app_name: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    company_email: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    company_phone: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    logo: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    light_logo: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    favicon: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    auth_theme: {
      type: DataTypes.ENUM("dark", "light"),
      defaultValue: "light",
    },
    auth_theme_text: {
      type: DataTypes.ENUM("dark", "light"),
      defaultValue: "dark",
    },
    sidebar_logo_style: {
      type: DataTypes.ENUM("square", "full"),
      defaultValue: "square",
    },
    login_background: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    currency_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    package_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    package_type: {
      type: DataTypes.ENUM("monthly", "annual"),
      defaultValue: "monthly",
    },
    timezone: {
      type: DataTypes.STRING(191),
      defaultValue: "Asia/Kolkata",
    },
    date_format: {
      type: DataTypes.STRING(20),
      defaultValue: "d-m-Y",
    },
    date_picker_format: {
      type: DataTypes.STRING(191),
      defaultValue: "dd-mm-yyyy",
    },
    year_starts_from: {
      type: DataTypes.STRING(191),
      defaultValue: "1",
    },
    moment_format: {
      type: DataTypes.STRING(191),
      defaultValue: "DD-MM-YYYY",
    },
    time_format: {
      type: DataTypes.STRING(20),
      defaultValue: "h:i a",
    },
    locale: {
      type: DataTypes.STRING(191),
      defaultValue: "en",
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      defaultValue: 26.9124336,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      defaultValue: 75.7872709,
    },
    leaves_start_from: {
      type: DataTypes.ENUM("joining_date", "year_start"),
      defaultValue: "joining_date",
    },
    active_theme: {
      type: DataTypes.ENUM("default", "custom"),
      defaultValue: "default",
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "license_expired"),
      allowNull: true,
      defaultValue: "active",
    },
    last_updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    company_state_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "companies",
    timestamps: false,
  }
);

export default Company;
