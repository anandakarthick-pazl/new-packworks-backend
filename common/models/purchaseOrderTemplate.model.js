import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";
import User from "./user.model.js";


const PurchaseOrderTemplate = sequelize.define('PurchaseOrderTemplate', {
    id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
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
    po_template_id:{
        type: DataTypes.INTEGER,
        allowNull:true
    },
    html_template: {
    type: DataTypes.TEXT('long'), // For large HTML content
    allowNull: false
  },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
    },
    updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    }
    }, {
      tableName: 'purchaseordertemplate',
      timestamps: false, 
    });
  
    PurchaseOrderTemplate.belongsTo(Company, { foreignKey: "company_id" });

    export default PurchaseOrderTemplate;

  