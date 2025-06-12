import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import Inventory from "../inventory/inventory.model.js";
import ProductionGroup from "./productionGroup.model.js";

const AllocationHistory = sequelize.define(
  "AllocationHistory",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: Company,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    inventory_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: Inventory,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    group_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: ProductionGroup,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    allocated_Qty: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      defaultValue: "active",
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "production_group",
    timestamps: false,
  }
);

// Associations
Company.hasMany(AllocationHistory, { foreignKey: "company_id" });
AllocationHistory.belongsTo(Company, { foreignKey: "company_id" });
ProductionGroup.hasMany(AllocationHistory, { foreignKey: "group_id" });
AllocationHistory.belongsTo(ProductionGroup, { foreignKey: "group_id" });
Inventory.hasMany(AllocationHistory, { foreignKey: "inventory_id" });
AllocationHistory.belongsTo(Inventory, { foreignKey: "inventory_id" });

AllocationHistory.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator_group",
});
AllocationHistory.belongsTo(User, {
  foreignKey: "updated_by",
  as: "updater_group",
});

export default AllocationHistory;
