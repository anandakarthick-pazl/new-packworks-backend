import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";


const PurchaseOrder = sequelize.define('PurchaseOrder', {
      po_id: {
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
      po_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      valid_till: {
        type: DataTypes.DATEONLY
      },
      supplier_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      supplier_name: {
        type: DataTypes.STRING(100)
      },
      supplier_address: {
        type: DataTypes.TEXT
      },
      supplier_contact: {
        type: DataTypes.STRING(50)
      },
      supplier_email: {
        type: DataTypes.STRING(100)
      },
      payment_terms: {
        type: DataTypes.STRING(50)
      },
      freight_terms: {
        type: DataTypes.STRING(50)
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
      decision: {
        type: DataTypes.ENUM('approve', 'disapprove'),
        allowNull: false,
        defaultValue: "approve",
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
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
      tableName: 'purchase_orders',
      timestamps: false,
    });

    PurchaseOrder.belongsTo(Company, { foreignKey: "company_id" });
    PurchaseOrder.belongsTo(User, { foreignKey: "created_by", as: "creator" });
    PurchaseOrder.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
    
    export default PurchaseOrder;
  
  