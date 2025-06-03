import { DataTypes, Sequelize } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import ProcessName from "./processName.model.js";

const Machine = sequelize.define(
  "Machine",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    machine_generate_id: {
      type: DataTypes.STRING(200),
      allowNull: true,
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
    machine_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    machine_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    model_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    serial_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    manufacturer: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    purchase_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    installation_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    machine_status: {
      type: DataTypes.ENUM("Active", "Inactive", "Under Maintenance"),
      allowNull: false,
      defaultValue: "Active",
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_maintenance: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    next_maintenance_due: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    assigned_operator: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    power_rating: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    connectivity_status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    ip_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    warranty_expiry: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    remarks_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    machine_process: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue("machine_process");
        return value ? JSON.parse(value) : [];
      },
      set(value) {
        this.setDataValue("machine_process", JSON.stringify(value));
      },
    },
    machine_route: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue("machine_route");
        return value ? JSON.parse(value) : [];
      },
      set(value) {
        this.setDataValue("machine_route", JSON.stringify(value));
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
    tableName: "machines",
    timestamps: false,
  }
);

Company.hasMany(Machine, {
  foreignKey: "company_id",
});
Machine.belongsTo(Company, {
  foreignKey: "company_id",
});
Machine.belongsToMany(ProcessName, {
  through: 'MachineProcess',
  as: 'processes',
  foreignKey: 'machine_id',
  otherKey: 'process_id'
});

ProcessName.belongsToMany(Machine, {
  through: 'MachineProcess',
  as: 'machines',
  foreignKey: 'process_id',
  otherKey: 'machine_id'
});

User.hasMany(Machine, {
  foreignKey: "created_by",
});
User.hasMany(Machine, {
  foreignKey: "updated_by",
});
Machine.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator_machine",
});
Machine.belongsTo(User, {
  foreignKey: "updated_by",
  as: "updater_machine",
});

export default Machine;
