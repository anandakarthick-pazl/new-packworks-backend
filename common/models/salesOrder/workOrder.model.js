import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import SalesOrder from "./salesOrder.model.js";

const WorkOrder = sequelize.define(
  "WorkOrder",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    sales_order_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: SalesOrder,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    manufacture: {
      type: DataTypes.ENUM("inhouse", "outsource", "purchase"),
      allowNull: false,
    },
    sku_name: {
      type: DataTypes.STRING,
      allowNull: true, // Optional field
    },
    sku_version: {
      type: DataTypes.STRING,
      allowNull: true, // Optional field
    },
    qty: {
      type: DataTypes.INTEGER,
      allowNull: true, // Optional field
    },
    edd: {
      type: DataTypes.DATE,
      allowNull: true, // Optional field
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true, // Optional field
    },
    acceptable_excess_units: {
      type: DataTypes.INTEGER,
      allowNull: true, // Optional field
    },
    planned_start_date: {
      type: DataTypes.DATE,
      allowNull: true, // Optional field
    },
    planned_end_date: {
      type: DataTypes.DATE,
      allowNull: true, // Optional field
    },
    outsource_name: {
      type: DataTypes.STRING,
      allowNull: true, // Optional field
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
    tableName: "work_order",
    timestamps: false,
  }
);

SalesOrder.hasMany(WorkOrder, {
  foreignKey: "sales_order_id", as: "workOrders"
});
WorkOrder.belongsTo(SalesOrder, {
  foreignKey: "sales_order_id", as: "salesOrder"
});

export default WorkOrder;
