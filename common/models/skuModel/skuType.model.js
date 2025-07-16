import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import CompanyAddress from "../companyAddress.model.js";

const SkuType = sequelize.define(
  "SkuType",
  {
    id: {
      type: DataTypes.INTEGER,
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
    company_branch_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: CompanyAddress,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    sku_type: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
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
    tableName: "sku_type",
    timestamps: false,
  }
);

// Correcting the association
Company.hasMany(SkuType, { foreignKey: "company_id" });
SkuType.belongsTo(Company, { foreignKey: "company_id" });

SkuType.belongsTo(CompanyAddress, {
  foreignKey: "company_branch_id",
  as: "branch", 
});

// Better naming for associations to prevent conflicts
User.hasMany(SkuType, { foreignKey: "created_by", as: "creator_sku_types" });
User.hasMany(SkuType, { foreignKey: "updated_by", as: "updater_sku_types" });
SkuType.belongsTo(User, { foreignKey: "created_by", as: "creator_sku_types" });
SkuType.belongsTo(User, { foreignKey: "updated_by", as: "updater_sku_types" });

export default SkuType;
