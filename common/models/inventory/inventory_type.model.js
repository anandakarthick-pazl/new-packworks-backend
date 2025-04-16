import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import User from "../user.model.js";

const InventoryType = sequelize.define("InventoryType", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("active", "inactive"),
    allowNull: false,
    defaultValue: "active",
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: User,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
  updated_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: User,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
}, {
  tableName: "inventory_type",
  timestamps: false, 
});

// Associations
InventoryType.belongsTo(User, { foreignKey: "created_by", as: "creator" });
InventoryType.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default InventoryType;
