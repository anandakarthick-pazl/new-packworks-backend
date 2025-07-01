import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";

const ProductionGroup = sequelize.define(
  "ProductionGroup",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    production_group_generate_id: {
      type: DataTypes.STRING(200),
      allowNull: true,
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
    group_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    group_value: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    group_Qty: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    allocated_Qty: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      defaultValue: "active",
    },
    group_status: {
      type: DataTypes.ENUM("Pending", "Progress", "Completed", "Cancelled"),
      defaultValue: "Pending",
    },
    temporary_status: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
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
    tableName: "production_group",
    timestamps: false,
  }
);

// Associations
Company.hasMany(ProductionGroup, { foreignKey: "company_id" });
ProductionGroup.belongsTo(Company, { foreignKey: "company_id" });

ProductionGroup.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator_group",
});
ProductionGroup.belongsTo(User, {
  foreignKey: "updated_by",
  as: "updater_group",
});

export default ProductionGroup;
