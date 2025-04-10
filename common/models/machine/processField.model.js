import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import MachineProcessName from "./processName.model.js";
import User from "../user.model.js";
import Company from "../company.model.js";
import ProcessName from "./processName.model.js";

const MachineProcessField = sequelize.define(
  "MachineProcessField",
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
    process_name_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: ProcessName,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    label: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    field_type: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    required: {
      type: DataTypes.TINYINT(1),
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
      onUpdate: DataTypes.NOW,
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
    tableName: "machine_process_fields",
    timestamps: false,
  }
);

Company.hasMany(MachineProcessField, { foreignKey: "company_id" });
MachineProcessField.belongsTo(Company, { foreignKey: "company_id" });

MachineProcessField.belongsTo(MachineProcessName, {
  foreignKey: "process_name_id",
});
MachineProcessName.hasMany(MachineProcessField, {
  foreignKey: "process_name_id",
});

User.hasMany(MachineProcessField, { foreignKey: "created_by" });
User.hasMany(MachineProcessField, { foreignKey: "updated_by" });
MachineProcessField.belongsTo(User, { foreignKey: "created_by" , as: "creator" });
MachineProcessField.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default MachineProcessField;
