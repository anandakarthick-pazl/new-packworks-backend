import { DataTypes, Sequelize } from "sequelize";
import sequelize from "../../database/database.js";
import SalesOrder from "./salesOrder.model.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import User from "../user.model.js";
import SkuVersion from "../skuModel/skuVersion.js";
import Sku from "../skuModel/sku.model.js";

const WorkOrder = sequelize.define(
  "WorkOrder",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    work_generate_id: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    sales_order_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: SalesOrder,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
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
    manufacture: {
      type: DataTypes.ENUM("inhouse", "outsource", "purchase"),
      allowNull: false,
    },
    sku_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: Sku,
        key: "id",
      },
    },
    sku_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sku_version: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: SkuVersion,
        key: "id",
      },
    },
    work_order_sku_values: {
      type: Sequelize.JSON,
      allowNull: true,
    },
    qty: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    pending_invoice_qty: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    edd: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    acceptable_excess_units: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    planned_start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    planned_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    outsource_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    priority: {
      type: DataTypes.ENUM("High", "Medium", "Low"),
      allowNull: false,
      defaultValue: "low",
    },
    production: {
      type: DataTypes.ENUM(
        "created",
        "in_production",
        "removed_from_production"
      ),
      allowNull: true,
      defaultValue: "created",
    },
    progress: {
      type: DataTypes.ENUM(
        "Pending",
        "Raw Material Allocation",
        "Production Planned",
        "Board Stage",
        "Finish Stage",
        "Completed",
        "Invoiced"
      ),
      allowNull: false,
      defaultValue: "Pending",
    },
    excess_qty: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    pending_qty: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    manufactured_qty: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    stage: {
      type: DataTypes.STRING(200),
      allowNull: true,
      defaultValue: "Production",
    },
    qr_code_url: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "URL to access the QR code for this work order",
    },
    select_plant: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    temporary_status: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
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
    tableName: "work_order",
    timestamps: false,
  }
);

SalesOrder.hasMany(WorkOrder, {
  foreignKey: "sales_order_id",
  as: "workOrders",
});
WorkOrder.belongsTo(SalesOrder, {
  foreignKey: "sales_order_id",
  as: "salesOrder",
});

WorkOrder.belongsTo(SkuVersion, {
  foreignKey: "sku_version",
  as: "skuVersion",
});
SkuVersion.hasMany(WorkOrder, {
  foreignKey: "sku_version",
  as: "workOrders",
});

Sku.hasMany(WorkOrder, { foreignKey: "sku_id" });
WorkOrder.belongsTo(Sku, { foreignKey: "sku_id" });

Company.hasMany(WorkOrder, { foreignKey: "company_id" });
WorkOrder.belongsTo(Company, { foreignKey: "company_id" });

Client.hasMany(WorkOrder, { foreignKey: "client_id" });
WorkOrder.belongsTo(Client, { foreignKey: "client_id" });

// User.hasMany(WorkOrder, { foreignKey: "created_by" });
// User.hasMany(WorkOrder, { foreignKey: "updated_by" });
WorkOrder.belongsTo(User, { foreignKey: "created_by", as: "creator_work" });
WorkOrder.belongsTo(User, { foreignKey: "updated_by", as: "updater_work" });

export default WorkOrder;
