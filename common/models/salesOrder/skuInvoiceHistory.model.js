import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import User from "../user.model.js";
import Sku from "../skuModel/sku.model.js";

const SkuInvoiceHistory = sequelize.define(
  "Invoice",
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
      sku_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: Sku,
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
    invoice_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    rate_per_sku: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    cost: {
      type: DataTypes.DECIMAL(10, 2),
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
    tableName: "sku_invoice_history",
    timestamps: false,
  }
);



// Associations
Sku.hasMany(SkuInvoiceHistory, { foreignKey: "sku_id" });
SkuInvoiceHistory.belongsTo(Sku, { foreignKey: "sku_id" });             

Company.hasMany(SkuInvoiceHistory, { foreignKey: "company_id" });
SkuInvoiceHistory.belongsTo(Company, { foreignKey: "company_id" });

Client.hasMany(SkuInvoiceHistory, { foreignKey: "client_id" });
SkuInvoiceHistory.belongsTo(Client, { foreignKey: "client_id" });

SkuInvoiceHistory.belongsTo(User, { foreignKey: "created_by", as: "creator_SkuInvoiceHistory" });
SkuInvoiceHistory.belongsTo(User, { foreignKey: "updated_by", as: "updater_invoice" });

export default SkuInvoiceHistory;
