import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import User from "./user.model.js";  

const Module = sequelize.define("Module", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  module_group: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  module_name: {
    type: DataTypes.STRING(191),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(191),
    allowNull: true,
  },
  is_superadmin: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  order_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  created_at: {
    type: DataTypes.DATE, 
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE, 
    defaultValue: DataTypes.NOW,
  },
  status: {
    type: DataTypes.ENUM("active", "inactive"),
    allowNull: false,
    defaultValue: "active",
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: "id",
    },
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: "id",
    },
  },
}, {
  tableName: "modules",
  timestamps: false,
});

// Define Relationships
Module.belongsTo(User, { foreignKey: "created_by", as: "creator" });
Module.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default Module;
