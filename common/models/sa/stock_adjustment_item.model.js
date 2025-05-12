import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import StockAdjustment from "./stock_adjustment.model.js";
import ItemMaster from "../item.model.js";
import Company from "../company.model.js";
import User from "../user.model.js";

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
      key: "adjustment_id",
    },
  },
  item_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    references: {
      model: ItemMaster,
      key: "item_id",
    },
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
 
}, {
  tableName: "stock_adjustment_items",
  timestamps: true,
  paranoid: true,
  underscored: true,
});

StockAdjustment.hasMany(StockAdjustmentItem, { foreignKey: "adjustment_id" });
StockAdjustmentItem.belongsTo(StockAdjustment, { foreignKey: "adjustment_id" });


export default StockAdjustmentItem;
