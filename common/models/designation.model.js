import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../database/database.js';

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
    name: {
      type: DataTypes.STRING(191),
      allowNull: false
    },
    parent_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
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
  
  export default Designation;