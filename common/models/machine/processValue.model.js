import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import User from "../user.model.js";
import ProcessName from "./processName.model.js";
import Company from "../company.model.js";

const MachineProcessValue = sequelize.define(
  "MachineProcessValue",
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
    process_name_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: ProcessName,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    process_value: {
      type: DataTypes.JSON,
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
      onUpdate: DataTypes.NOW,
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
    tableName: "machine_process_values",
    timestamps: false,
  }
);

Company.hasMany(MachineProcessValue, {
  foreignKey: "company_id",
});
MachineProcessValue.belongsTo(Company, {
  foreignKey: "company_id",
});
ProcessName.hasMany(MachineProcessValue, {
  foreignKey: "process_name_id",
});
MachineProcessValue.belongsTo(ProcessName, {
  foreignKey: "process_name_id",
});

User.hasMany(MachineProcessValue, { foreignKey: "created_by" });
User.hasMany(MachineProcessValue, { foreignKey: "updated_by" });
MachineProcessValue.belongsTo(User, { foreignKey: "created_by" });
MachineProcessValue.belongsTo(User, { foreignKey: "updated_by" });

export default MachineProcessValue;
