import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import User from "../user.model.js";
import Company from "../company.model.js";

const MachineRouteProcess = sequelize.define(
  "MachineRouteProcess",
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
    machine_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    machine_route_process: {
      type: DataTypes.JSON,
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
    tableName: "machine_route_process",
    timestamps: false,
    underscored: true,
  }
);

// Associations
Company.hasMany(MachineRouteProcess, { foreignKey: "company_id" });
MachineRouteProcess.belongsTo(Company, { foreignKey: "company_id" });

User.hasMany(MachineRouteProcess, { foreignKey: "created_by" });
User.hasMany(MachineRouteProcess, { foreignKey: "updated_by" });
MachineRouteProcess.belongsTo(User, {
  foreignKey: "created_by",
  as: "mrp_creator",
});
MachineRouteProcess.belongsTo(User, {
  foreignKey: "updated_by",
  as: "mrp_updater",
});

export default MachineRouteProcess;
