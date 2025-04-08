import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../database/database.js';

const GlobalInvoices = sequelize.define('GlobalInvoices', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  company_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true
  },
  currency_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },
  package_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },
  global_subscription_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true
  },
  offline_method_id : {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true
  },
  m_payment_id: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  pf_payment_id: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  payfast_plan: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  signature: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  token: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  transaction_id: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  package_type: {
    type: DataTypes.ENUM('large', 'annual'),
    defaultValue: 'default',
   

  },
  sub_total: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  total: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  billing_frequency: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  billing_interval: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  recurring: {
    type: DataTypes.ENUM('yes', 'no'),
    allowNull: false,
    defaultValue: 'yes'
  },
  plan_id: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  event_id: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  order_id: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  subscription_id: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  invoice_id: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  amount: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },

  stripe_invoice_number : {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  pay_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
  },
  next_pay_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
  },
  gateway_name : {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'inacive'),
    allowNull: false,
    defaultValue: 'active'
  },
  
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'global_invoices',
  timestamps: false
});

  
export default GlobalInvoices;