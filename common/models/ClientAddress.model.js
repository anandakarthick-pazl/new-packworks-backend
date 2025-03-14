import { DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Client from "./client.model.js";
import User from "./user.model.js";

const Address = sequelize.define(
  "Address",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
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
    attention: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    street1: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    street2: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pinCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    faxNumber: {
      type: DataTypes.STRING,
      allowNull: true,
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
    tableName: "addresses",
    timestamps: true,
  }
);
// Define the relationship
Client.hasMany(Address, { foreignKey: "client_id", as: "addresses" });
Address.belongsTo(Client, { foreignKey: "client_id", as: "clients" });

User.hasMany(Address, { foreignKey: "created_by", as: "address_creater" });
Address.belongsTo(User, { foreignKey: "created_by", as: "creater" }); 
              
User.hasMany(Address, { foreignKey: "updated_by", as: "address_updater" });
Address.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default Address;
