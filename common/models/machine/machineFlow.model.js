import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import Machine from "./machine.model.js"; // Adjust the path as needed
import ProcessName from "./processName.model.js";

const MachineFlow = sequelize.define(
  "MachineFlow",
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
    machine_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: Machine,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    machine_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    process_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: ProcessName,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    process_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
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
    tableName: "machine_flow",
    timestamps: false,
  }
);

// Associations
Company.hasMany(MachineFlow, {
  foreignKey: "company_id",
});
MachineFlow.belongsTo(Company, {
  foreignKey: "company_id",
});

Machine.hasMany(MachineFlow, {
  foreignKey: "machine_id",
});
MachineFlow.belongsTo(Machine, {
  foreignKey: "machine_id",
});

ProcessName.hasMany(MachineFlow, {
  foreignKey: "process_id",
});
MachineFlow.belongsTo(ProcessName, {
  foreignKey: "process_id",
});

User.hasMany(MachineFlow, {
  foreignKey: "created_by",
});
User.hasMany(MachineFlow, {
  foreignKey: "updated_by",
});
MachineFlow.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator_machine_flow",
});
MachineFlow.belongsTo(User, {
  foreignKey: "updated_by",
  as: "updater_machine_flow",
});

export default MachineFlow;
