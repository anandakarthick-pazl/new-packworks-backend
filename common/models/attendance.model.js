import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../database/database.js';

const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  company_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false
  },
  location_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  clock_in_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  clock_out_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  department_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    
  },
  
  clock_in_ip: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  clock_out_ip: {
    type: DataTypes.STRING(191),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active',
},
created_by: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
  updated_by: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,

  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  
}, {
  tableName: 'attendances',
  timestamps: false, // Or true if you want Sequelize to handle createdAt/updatedAt
  
});
  
  export default Attendance;