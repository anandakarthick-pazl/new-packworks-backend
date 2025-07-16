import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../database/database.js';
import { formatDateTime } from '../utils/dateFormatHelper.js';
import Company from './company.model.js';
import CompanyAddress from './companyAddress.model.js';

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
  company_branch_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: CompanyAddress,
      key: "id",
    },
    onUpdate: "CASCADE",
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
    get() {
      return formatDateTime(this.getDataValue('created_at'));
    }
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    get() {
      return formatDateTime(this.getDataValue('updated_at'));
    }
  },
  
}, {
  tableName: 'attendances',
  timestamps: false, // Or true if you want Sequelize to handle createdAt/updatedAt
  
});

Attendance.belongsTo(Company, {
    foreignKey: 'company_id',
    as: 'company',
});
Attendance.belongsTo(CompanyAddress, {
  foreignKey: "company_branch_id",
});
  
  export default Attendance;