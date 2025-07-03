import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";

const GroupHistory = sequelize.define(
  "GroupHistory",
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
    group_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    total_quantity: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    used_quantity: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    balanced_quantity: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      defaultValue: "active",
    },
    employee_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    machine_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
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
    tableName: "group_history",
    timestamps: false,
  }
);

Company.hasMany(GroupHistory, { foreignKey: "company_id" });
GroupHistory.belongsTo(Company, { foreignKey: "company_id" });

GroupHistory.belongsTo(User, {foreignKey: "created_by", as: "creator"});
GroupHistory.belongsTo(User, { foreignKey: "updated_by", as: "updater"});

export default GroupHistory;
