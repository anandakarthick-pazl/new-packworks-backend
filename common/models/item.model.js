import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";
import User from "./user.model.js";


const ItemMaster = sequelize.define('ItemMaster', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      item_code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      company_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: Company,
          key: "id",
        },
        onUpdate: "CASCADE",
      },
      item_name: {
        type: DataTypes.STRING(255)
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      hsn_code: {
        type: DataTypes.STRING(20)
      },
      uom: {
        type: DataTypes.STRING(10)
      },
      category: {
        type: DataTypes.STRING(50)
      },
      item_type: {
        type: DataTypes.ENUM('reels', 'glues', 'pins', 'finished-goods', 'semi-finished-goods', 'raw-materials'),
        allowNull: false,
        defaultValue: 'raw-materials'
      },
      specifications: {
        type: DataTypes.TEXT
      },
      manufacturer: {
        type: DataTypes.STRING(100)
      },
      min_stock_level: {
        type: DataTypes.DECIMAL(15, 2)
      },
      reorder_level: {
        type: DataTypes.DECIMAL(15, 2)
      },
      cgst: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      sgst: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      standard_cost: {
        type: DataTypes.DECIMAL(15, 2)
      },
       status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: User,
          key: "id",
        },
      },
      updated_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: User,
          key: "id",
        },
      },
    }, {
      tableName: 'item_master',
      timestamps: false, 
    });
  
    ItemMaster.belongsTo(Company, { foreignKey: "company_id" });
    ItemMaster.belongsTo(User, { foreignKey: "created_by", as: "creator" });
    ItemMaster.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
    
    export default ItemMaster;

  