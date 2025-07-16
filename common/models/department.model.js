import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../database/database.js';
import Company from './company.model.js';
import CompanyAddress from './companyAddress.model.js';

const Department = sequelize.define('Department', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    company_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      indexes: [{ unique: false }]
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
    department_name: {
      type: DataTypes.STRING(191),
      allowNull: false
    },
    parent_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: null,
    },
    added_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      indexes: [{ unique: false }]
    },
    last_updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      indexes: [{ unique: false }]
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'departments',
    timestamps: false
  });

  Department.belongsTo(Company, {
    foreignKey: 'company_id'
});
Department.belongsTo(CompanyAddress, {
  foreignKey: "company_branch_id",
});
  
  export default Department;