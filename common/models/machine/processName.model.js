import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Machine from "./machine.model.js";
import User from "../user.model.js";

const MachineProcessName = sequelize.define(
  "MachineProcessName",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    machine_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: Machine,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    process_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
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
    tableName: "machine_process_name",
    timestamps: false,
  }
);

Machine.hasMany(MachineProcessName, {
  foreignKey: "machine_id",
});
MachineProcessName.belongsTo(Machine, {
  foreignKey: "machine_id",
});

User.hasMany(MachineProcessName, { foreignKey: "created_by" });
User.hasMany(MachineProcessName, { foreignKey: "updated_by" });
MachineProcessName.belongsTo(User, { foreignKey: "created_by" });
MachineProcessName.belongsTo(User, { foreignKey: "updated_by" });

export default MachineProcessName;
