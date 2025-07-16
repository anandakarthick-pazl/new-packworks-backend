import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../database/database.js';
import Company from './company.model.js';
import CompanyAddress from './companyAddress.model.js';

const Role = sequelize.define('Role', {
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
  name: {
    type: DataTypes.STRING(191),
    allowNull: false
  },
  display_name: {
    type: DataTypes.STRING(191),
    allowNull: true
  },
  description: {
    type: DataTypes.STRING(191),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true
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
  tableName: 'roles',
  timestamps: false
});

Role.belongsTo(Company, {
    foreignKey: 'company_id',
    as: 'company',
});
Role.belongsTo(CompanyAddress, {
  foreignKey: "company_branch_id",
});
  
  export default Role;