import { DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";

const Client = sequelize.define(
  "Client",
  {
    client_id: {
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
      onDelete: "CASCADE",
    },
    client_ref_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    customer_type: {
      type: DataTypes.ENUM("Business", "Individual"),
      allowNull: false,
    },
    salutation: {
      type: DataTypes.STRING,
    },
    first_name: {
      type: DataTypes.STRING,
    },
    last_name: {
      type: DataTypes.STRING,
    },
    display_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    company_name: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    work_phone: {
      type: DataTypes.STRING,
    },
    mobile: {
      type: DataTypes.STRING,
    },
    PAN: {
      type: DataTypes.STRING,
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: "INR Indian Rupee",
    },
    opening_balance: {
      type: DataTypes.DECIMAL(10, 2),
    },
    payment_terms: {
      type: DataTypes.STRING,
    },
    enable_portal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    portal_language: {
      type: DataTypes.STRING,
      defaultValue: "English",
    },
    documents: {
      type: DataTypes.JSON,
    },
    website_url: {
      type: DataTypes.STRING,
    },
    department: {
      type: DataTypes.STRING,
    },
    designation: {
      type: DataTypes.STRING,
    },
    twitter: {
      type: DataTypes.STRING,
    },
    skype: {
      type: DataTypes.STRING,
    },
    facebook: {
      type: DataTypes.STRING,
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
    tableName: "clients",
    timestamps: false,
  }
);

// Define the relationship
Company.hasMany(Client, { foreignKey: "company_id" });
Client.belongsTo(Company, { foreignKey: "company_id" });

export default Client;
