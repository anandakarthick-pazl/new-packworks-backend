import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import User from "../user.model.js";
import MachineProcessName from "./processName.model.js";

const MachineProcessValue = sequelize.define(
  "MachineProcessValue",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    process_name_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: MachineProcessName,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    process_value: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    // created_at: {
    //   type: DataTypes.DATE,
    //   allowNull: false,
    //   defaultValue: DataTypes.NOW,
    // },
    // updated_at: {
    //   type: DataTypes.DATE,
    //   allowNull: false,
    //   defaultValue: DataTypes.NOW,
    //   onUpdate: DataTypes.NOW, 
    // },
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
    timestamps: true,
  }
);


MachineProcessName.hasMany(MachineProcessValue, {
  foreignKey: "process_name_id",
});
MachineProcessValue.belongsTo(MachineProcessName, {
  foreignKey: "process_name_id",
});

User.hasMany(MachineProcessValue, { foreignKey: "created_by" });
User.hasMany(MachineProcessValue, { foreignKey: "updated_by" });
MachineProcessValue.belongsTo(User, { foreignKey: "created_by" });
MachineProcessValue.belongsTo(User, { foreignKey: "updated_by" });

export default MachineProcessValue;
