import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";

const Machine = sequelize.define(
  "Machine",
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
      allowNull: false,
    },
    installation_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
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
      validate: {
        isIP: true,
      },
    },
    warranty_expiry: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    remarks_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
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

User.hasMany(Machine, {
  foreignKey: "created_by",
});
User.hasMany(Machine, {
  foreignKey: "updated_by",
});
Machine.belongsTo(User, {
  foreignKey: "created_by",
});
Machine.belongsTo(User, {
  foreignKey: "updated_by",
});

export default Machine;
