import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";
import User from "./user.model.js";
import CompanyAddress from "./companyAddress.model.js";

const Flute = sequelize.define('Flute',{
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
  company_branch_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: CompanyAddress,
            key: "id",
          },
          onUpdate: "CASCADE",
    },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  flute_height: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  number_of_flutes_per_meter: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  take_up_factor: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  glue_consumption: {
    type: DataTypes.STRING,
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
  tableName: 'flutes',
  timestamps: false,
});


Flute.belongsTo(Company, { foreignKey: "company_id" });
Flute.belongsTo(User, { foreignKey: "created_by", as: "creator" });
Flute.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

Flute.belongsTo(CompanyAddress, {
  foreignKey: "company_branch_id",
});
export default Flute;