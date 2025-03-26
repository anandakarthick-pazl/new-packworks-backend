import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../database/database.js';
import Department from './department.model.js';
import Designation from './designation.model.js';
import User from './user.model.js';

const Employee = sequelize.define('Employee', {

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
  employee_id: {
    type: DataTypes.STRING(191),
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  hourly_rate: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  slack_username: {
    type: DataTypes.STRING(191),
    allowNull: true
  },
  department_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true
  },
  designation_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  joining_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
  },
  last_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  added_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true
  },
  last_updated_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true
  },
  attendance_reminder: {
    type: DataTypes.DATE,
    allowNull: true
  },
  date_of_birth: {
    type: DataTypes.DATE,
    allowNull: true
  },
  calendar_view: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  about_me: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reporting_to: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true
  },
  contract_end_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  internship_end_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  employment_type: {
    type: DataTypes.STRING(191),
    allowNull: true
  },
  marriage_anniversary_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  marital_status: {
    type: DataTypes.STRING(191),
    allowNull: false,
    defaultValue: 'single'
  },
  notice_period_end_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notice_period_start_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  probation_end_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  company_address_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  overtime_hourly_rate: {
    type: DataTypes.DOUBLE(16, 2),
    allowNull: true,
    comment: 'This field is only for overtime calculation'
  }
}, {
  tableName: 'employee_details',
  timestamps: false
});



export default Employee;
