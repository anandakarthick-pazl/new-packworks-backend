import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import User from "../user.model.js";
import Company from "../company.model.js";

const ProcessName = sequelize.define(
  "ProcessName",
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
    process_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
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
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
  },
  {
    tableName: "process_name",
    timestamps: false,
    underscored: true,
  }
);
// Associations
Company.hasMany(ProcessName, { foreignKey: "company_id" });
ProcessName.belongsTo(Company, { foreignKey: "company_id" });

User.hasMany(ProcessName, { foreignKey: "created_by" });
User.hasMany(ProcessName, { foreignKey: "updated_by" });
ProcessName.belongsTo(User, {
  foreignKey: "created_by",
  as: "process_creator",
});
ProcessName.belongsTo(User, {
  foreignKey: "updated_by",
  as: "process_updater",
});

export default ProcessName;
