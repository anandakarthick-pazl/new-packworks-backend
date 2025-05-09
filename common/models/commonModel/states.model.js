import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import User from "../user.model.js";

const States = sequelize.define(
  "States",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    country_code: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: "+91",
    },
    states: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: true,
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
    tableName: "states",
    timestamps: false,
  }
);

// Associations

States.belongsTo(User, { foreignKey: "created_by", as: "creator" });
States.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default States;
