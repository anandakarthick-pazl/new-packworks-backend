import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import User from "../user.model.js";
 
const Production = sequelize.define(
  "Production",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    sales_order_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: SalesOrder,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
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
   
    sku_name: {
      type: DataTypes.STRING,
      allowNull: true,
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
    tableName: "production",
    timestamps: false,
  }
);


Company.hasMany(Production, { foreignKey: "company_id" });
Production.belongsTo(Company, { foreignKey: "company_id" });

Client.hasMany(Production, { foreignKey: "client_id" });
Production.belongsTo(Client, { foreignKey: "client_id" });

// User.hasMany(Production, { foreignKey: "created_by" });
// User.hasMany(Production, { foreignKey: "updated_by" });
Production.belongsTo(User, { foreignKey: "created_by", as: "creator_work" });
Production.belongsTo(User, { foreignKey: "updated_by", as: "updater_work" });

export default Production;
