import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import PurchaseOrder from "./purchase_order.model.js";


const PurchaseOrderPayment = sequelize.define('PurchaseOrderPayment', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    po_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    purchase_payment_generate_id: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    payment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
    },
    amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.0
    },
    payment_mode: {
    type: DataTypes.STRING(50),
    allowNull: true
    },
    status: {
    type: DataTypes.ENUM('paid', 'pending', 'failed'),
    defaultValue: 'paid'
    },
    remark: {
    type: DataTypes.TEXT,
    allowNull: true
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
   created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
    },
    updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'purchase_order_payments',
    timestamps: false, 
});
    

    PurchaseOrderPayment.belongsTo(Company, { foreignKey: "company_id" });
    PurchaseOrderPayment.belongsTo(User, { foreignKey: "created_by", as: "creator" });
    PurchaseOrderPayment.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
    PurchaseOrderPayment.belongsTo(PurchaseOrder, { foreignKey: 'po_id', as: 'purchase_order' });

  
    
    export default PurchaseOrderPayment;
  
  