import { DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";
import User from "./user.model.js";
import BaseModel from "./base.model.js";

class Client extends BaseModel {}

Client.init(
  {
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    client_ui_id: {
      type: DataTypes.INTEGER.UNSIGNED,
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
    },
    client_ref_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gst_status: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: true,
    },
    gst_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    entity_type: {
      type: DataTypes.ENUM("Client", "Vendor"),
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
      allowNull: true,
    },
    opening_balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    payment_terms: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    enable_portal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    },
    portal_language: {
      type: DataTypes.STRING,
      defaultValue: "English",
      allowNull: true,
    },
    documents: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    website_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    department: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    designation: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    twitter: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    skype: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    facebook: {
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
  },
  {
    tableName: "clients",
    timestamps: false,
  }
);

// Define the relationship
Company.hasMany(Client, { foreignKey: "company_id" });
Client.belongsTo(Company, { foreignKey: "company_id" });
// Update the Client model associations
User.hasMany(Client, { foreignKey: "created_by", as: "created_clients" });
User.hasMany(Client, { foreignKey: "updated_by", as: "updated_clients" });
Client.belongsTo(User, { foreignKey: "created_by", as: "creator" });
Client.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default Client;
