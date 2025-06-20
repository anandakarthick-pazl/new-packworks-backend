import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";

const SalesReturn = sequelize.define("SalesReturn", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  sales_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  return_generate_id: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  return_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  total_qty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  cgst_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  sgst_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  igst_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  tax_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  client_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'sales_returns',
  timestamps: false
});

export default SalesReturn;
