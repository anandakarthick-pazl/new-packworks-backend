import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";
import User from "./user.model.js";

const Die = sequelize.define('Die',{
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
  },
  die_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  client: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  board_size: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  board_width: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  board_length: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ups: {
    type: DataTypes.STRING,
    allowNull: true,
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
}, {
  tableName: 'die',
  timestamps: false,
});


Die.belongsTo(Company, { foreignKey: "company_id" });
Die.belongsTo(User, { foreignKey: "created_by", as: "creator" });
Die.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
export default Die;