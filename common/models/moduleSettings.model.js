import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";

const ModuleSettings = sequelize.define("Module", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  company_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: "Companies", 
      key: "id"
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL"
  },
  module_name: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM("active", "deactive"),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM("admin", "employee", "client"),
    allowNull: false,
    defaultValue: "admin"
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  is_allowed: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 1
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: "module_settings", 
  timestamps: false,
});

export default ModuleSettings;