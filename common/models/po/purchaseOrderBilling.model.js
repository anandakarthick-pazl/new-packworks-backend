import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import PurchaseOrder from "./purchase_order.model.js";
import { formatDateTime } from '../../utils/dateFormatHelper.js';


const PurchaseOrderBilling = sequelize.define(
  "PurchaseOrderBilling",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    bill_generate_id: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    company_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: Company,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    purchase_order_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: PurchaseOrder, 
        key: "id",
      },
    },
    bill_reference_number: {
      type: DataTypes.STRING(200),
    },
    bill_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      get() {
        return formatDateTime(this.getDataValue('created_at'));
      }
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      get() {
        return formatDateTime(this.getDataValue('updated_at'));
      }
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
    tableName: "purchase_order_billings",
    timestamps: false,
  }
);

// In PurchaseOrderBilling model
PurchaseOrderBilling.belongsTo(PurchaseOrder, { foreignKey: 'purchase_order_id', as: 'purchaseOrder' });
PurchaseOrderBilling.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });
PurchaseOrderBilling.belongsTo(User, { foreignKey: 'updated_by', as: 'updatedBy' });
PurchaseOrderBilling.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

export default PurchaseOrderBilling;
