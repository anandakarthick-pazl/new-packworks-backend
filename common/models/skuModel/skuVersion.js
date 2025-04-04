import { DataTypes, Sequelize } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import User from "../user.model.js";
import Sku from "./sku.model.js"; 

const SkuVersion = sequelize.define(
  "SkuVersion",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
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
    sku_version: {
      type: DataTypes.STRING(100),
      allowNull: true,
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
    sku_values: {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "active",
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
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "sku_version",
    timestamps: false,
  }
);

// Associations
Company.hasMany(SkuVersion, { foreignKey: "company_id" });
SkuVersion.belongsTo(Company, { foreignKey: "company_id" });

Client.hasMany(SkuVersion, { foreignKey: "client_id" });
SkuVersion.belongsTo(Client, { foreignKey: "client_id" });

Sku.hasMany(SkuVersion, { foreignKey: "sku_id" });
SkuVersion.belongsTo(Sku, { foreignKey: "sku_id" });

SkuVersion.belongsTo(User, { foreignKey: "created_by", as: "version_creator" });
SkuVersion.belongsTo(User, { foreignKey: "updated_by", as: "version_updater" });

export default SkuVersion;
