import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../database/database.js';
import Company from './company.model.js';
import CompanyAddress from './companyAddress.model.js';

const Designation = sequelize.define('Designation', {
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
    name: {
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
    tableName: 'designations',
    timestamps: false
  });

  Designation.belongsTo(Company, {
    foreignKey: 'company_id'
});
Designation.belongsTo(CompanyAddress, {
  foreignKey: "company_branch_id",
});
  
  export default Designation;