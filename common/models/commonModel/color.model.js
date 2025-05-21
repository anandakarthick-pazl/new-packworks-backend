import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import User from "../user.model.js";
import Company from "../company.model.js";

const Color = sequelize.define(
  "Color",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: Company,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    color_name: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: "active",
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
      onUpdate: "CASCADE",
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
    tableName: "color",
    timestamps: false,
  }
);

Company.hasMany(Color, { foreignKey: "company_id", as: "colors" });
Color.belongsTo(Company, { foreignKey: "company_id", as: "company" });
User.hasMany(Color, { foreignKey: "created_by", as: "createdColors" });
User.hasMany(Color, { foreignKey: "updated_by", as: "updatedColors" });
Color.belongsTo(User, { foreignKey: "created_by", as: "creator" });
Color.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default Color;