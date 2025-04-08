import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../database/database.js';

const faq_categories = sequelize.define('faq_categories', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  
  name: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active',
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
  }
}, {
  tableName: 'faq_categories',
  timestamps: false
});
  
  export default faq_categories;