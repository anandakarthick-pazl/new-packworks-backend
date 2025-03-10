import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import Client from "../client.model.js";

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
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sku_details: {
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
    },
  },
  {
    tableName: "sales_order",
    timestamps: false,
  }
);


export default SalesOrder;
