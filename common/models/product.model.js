import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";
import User from "./user.model.js";
import { formatDateTime } from '../utils/dateFormatHelper.js';


const Product = sequelize.define('ItemMaster', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
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
      product_generate_id:{
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      product_type:{
        type: DataTypes.ENUM("goods", "service"),
        allowNull: false,
        defaultValue: "goods",
      },
      product_code: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      product_name: {
        type: DataTypes.STRING(255)
      },
      uom: {
        type: DataTypes.STRING(10)
      },
      sales_information: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
      selling_price:{
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      selling_account: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      selling_description: {
        type: DataTypes.TEXT,
        allowNull: true
      },


      purchase_information: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
      purchase_price:{
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      purchase_account: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      purchase_description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      preferred_vendor:{
        type: DataTypes.TEXT,
        allowNull: true
      },      
    //   hsn_code: {
    //     type: DataTypes.STRING(20)
    //   },
    //   category: {
    //     type: DataTypes.STRING(50)
    //   },
    //   item_type: {
    //     type: DataTypes.ENUM('reels', 'glues', 'pins', 'finished-goods', 'semi-finished-goods', 'raw-materials'),
    //     allowNull: false,
    //     defaultValue: 'raw-materials'
    //   },
    //   specifications: {
    //     type: DataTypes.TEXT
    //   },
    //   manufacturer: {
    //     type: DataTypes.STRING(100)
    //   },
    //   min_stock_level: {
    //     type: DataTypes.DECIMAL(15, 2)
    //   },
    //   reorder_level: {
    //     type: DataTypes.DECIMAL(15, 2)
    //   },
    //   cgst: {
    //     type: DataTypes.DECIMAL(10, 2),
    //     allowNull: true,
    //   },
    //   sgst: {
    //     type: DataTypes.DECIMAL(10, 2),
    //     allowNull: true,
    //   },
    //   standard_cost: {
    //     type: DataTypes.DECIMAL(15, 2)
    //   },
       status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        get() {
          return formatDateTime(this.getDataValue('created_at'));
        }
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        get() {
          return formatDateTime(this.getDataValue('updated_at'));
        }
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
      tableName: 'product',
      timestamps: false, 
    });
  
    Product.belongsTo(Company, { foreignKey: "company_id" });
    Product.belongsTo(User, { foreignKey: "created_by", as: "creator" });
    Product.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
    
    export default Product;

  