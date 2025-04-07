import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../database/database.js';

const faqs = sequelize.define('faqs', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  image: {
    type: DataTypes.STRING, // or DataTypes.TEXT if it's a long URL
    allowNull: true
  },
  faq_category_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
   
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
  tableName: 'faqs',
  timestamps: false
});
  
  export default faqs;