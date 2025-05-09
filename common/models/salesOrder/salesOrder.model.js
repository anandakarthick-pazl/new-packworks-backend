import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import User from "../user.model.js";

// OrderDetails Model
const SalesOrder = sequelize.define(
  "SalesOrder",
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
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: Client,
        key: "client_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    sales_ui_id:{
      type: DataTypes.STRING,
      allowNull: true,
    },
    sales_generate_id:{
      type: DataTypes.STRING,
      allowNull: true,
    },
    estimated: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    client: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    credit_period: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    freight_paid: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    confirmation: {
      type: DataTypes.ENUM("Email", "Oral"),
      allowNull: false,
    },
    sales_status:{
      type: DataTypes.ENUM('Pending','In-progress','Completed','Rejected'),
      allowNull: false,
      defaultValue: "Pending",
    },
    confirmation_email:{
      type: DataTypes.STRING,
      allowNull: true,
    },
    confirmation_name:{
      type: DataTypes.STRING,
      allowNull: true,
    },
    confirmation_mobile:{
      type: DataTypes.NUMBER,
      allowNull: true,
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    sgst: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    cgst: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    igst: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    total_incl_gst: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
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
    tableName: "sales_order",
    timestamps: false,
  }
);

Company.hasMany(SalesOrder, { foreignKey: "company_id" });
SalesOrder.belongsTo(Company, { foreignKey: "company_id" });

Client.hasMany(SalesOrder, { foreignKey: "client_id" });
SalesOrder.belongsTo(Client, { foreignKey: "client_id" });

// User.hasMany(SalesOrder, { foreignKey: "created_by" });
// User.hasMany(SalesOrder, { foreignKey: "updated_by" });
SalesOrder.belongsTo(User, { foreignKey: "created_by", as: "creator_sales" });
SalesOrder.belongsTo(User, { foreignKey: "updated_by", as: "updater_sales" });

export default SalesOrder;
