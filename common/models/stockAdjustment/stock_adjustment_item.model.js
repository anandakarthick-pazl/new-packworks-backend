import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import StockAdjustment from "./stock_adjustment.model.js";
import ItemMaster from "../item.model.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import { Sequelize } from "sequelize";
import { formatDateTime } from '../../utils/dateFormatHelper.js';


const StockAdjustmentItem = sequelize.define("StockAdjustmentItem", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  adjustment_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    references: {
      model: StockAdjustment,
      key: "id",
    },
  },
  po_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  inventory_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  grn_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  item_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    references: {
      model: ItemMaster,
      key: "id",
    },
  },
  reason:{
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  previous_quantity: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM("increase", "decrease"),
    allowNull: true,
  },
  adjustment_quantity: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  },
  difference: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  company_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: Company,
      key: "id",
    },
    
  },
  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    references: {
      model: User,
      key: "id",
    },
  },
  updated_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    references: {
      model: User,
      key: "id",
    },
  },
   created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      get() {
        return formatDateTime(this.getDataValue('created_at'));
      }
    },
  updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue:null,
      get() {
        return formatDateTime(this.getDataValue('updated_at'));
      }
    },


   deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  }
}, {
  tableName: "stock_adjustment_items",
  timestamps: false,
});

StockAdjustment.hasMany(StockAdjustmentItem, { foreignKey: "adjustment_id" });
StockAdjustmentItem.belongsTo(StockAdjustment, { foreignKey: "adjustment_id", as: "adjustment" });


export default StockAdjustmentItem;
