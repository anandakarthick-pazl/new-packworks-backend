import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import User from "../user.model.js";
import Company from "../company.model.js";

const WorkOrderStatus = sequelize.define(
  "WorkOrderStatus",
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
    },
    company_branch_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: CompanyAddress,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    work_order_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: "active",
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "work_order_status",
    timestamps: false,
  }
);

Company.hasMany(WorkOrderStatus, { foreignKey: "company_id", as: "workOrderStatus" });
WorkOrderStatus.belongsTo(Company, { foreignKey: "company_id", as: "company" });

WorkOrderStatus.belongsTo(CompanyAddress, { foreignKey: "company_branch_id", as: "companyBranch" });

User.hasMany(WorkOrderStatus, { foreignKey: "created_by", as: "createdWorkOrderStatus" });
User.hasMany(WorkOrderStatus, { foreignKey: "updated_by", as: "updatedWorkOrderStatus" });
WorkOrderStatus.belongsTo(User, { foreignKey: "created_by", as: "creator" });
WorkOrderStatus.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default WorkOrderStatus;