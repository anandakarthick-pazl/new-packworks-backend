import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import Sku from "./sku.model.js";
import SkuVersion from "./skuVersion.js";

const SkuOptions = sequelize.define(
  "SkuOptions",
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
    sku_version_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: SkuVersion,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    field_path: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Path to the field (e.g., "sku_values.0.gsm")',
    },
    field_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Name of the field (e.g., "gsm")',
    },
    field_value: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Value of the field (e.g., "210")',
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
    tableName: "sku_options",
    timestamps: false,
  }
);


Company.hasMany(SkuOptions, { foreignKey: "company_id" });
SkuOptions.belongsTo(Company, { foreignKey: "company_id" });

Sku.hasMany(SkuOptions, { foreignKey: "sku_id" });
SkuOptions.belongsTo(Sku, { foreignKey: "sku_id" });

SkuVersion.hasMany(SkuOptions, { foreignKey: "sku_version_id" });
SkuOptions.belongsTo(SkuVersion, { foreignKey: "sku_version_id" });

SkuOptions.belongsTo(User, { foreignKey: "created_by", as: "options_creator" });
SkuOptions.belongsTo(User, { foreignKey: "updated_by", as: "options_updater" });

export default SkuOptions;