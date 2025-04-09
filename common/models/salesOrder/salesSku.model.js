import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import SalesOrder from "./salesOrder.model.js";
import User from "../user.model.js";

const SalesSkuDetails = sequelize.define(
  "SalesSkuDetails",
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
    sales_order_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: SalesOrder,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    sku: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    quantity_required: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    rate_per_sku: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    acceptable_sku_units: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    total_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    sgst: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    sgst_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    cgst: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    cgst_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    total_incl__gst: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
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
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
    },
  },
  {
    tableName: "sales_sku_details",
    timestamps: false,
  }
);

// Associations
Company.hasMany(SalesSkuDetails, { foreignKey: "company_id" });
SalesSkuDetails.belongsTo(Company, { foreignKey: "company_id" });

Client.hasMany(SalesSkuDetails, { foreignKey: "client_id" });
SalesSkuDetails.belongsTo(Client, { foreignKey: "client_id" });

SalesOrder.hasMany(SalesSkuDetails, { foreignKey: "sales_order_id" });
SalesSkuDetails.belongsTo(SalesOrder, { foreignKey: "sales_order_id" });

SalesSkuDetails.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator_sod",
});
SalesSkuDetails.belongsTo(User, {
  foreignKey: "updated_by",
  as: "updater_sod",
});

export default SalesSkuDetails;
