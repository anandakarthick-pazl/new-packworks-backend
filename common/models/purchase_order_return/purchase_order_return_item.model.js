import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js"; // If you have this model
import User from "../user.model.js"; // If you have this model
import PurchaseOrder from "../po/purchase_order.model.js";
import GRN from "../grn/grn.model.js"; // If you have this model
import GRNItem from "../grn/grn_item.model.js"; // If you have this model
import ItemMaster from "../item.model.js";
import PurchaseOrderReturn from "./purchase_order_return.model.js";
import { formatDateTime } from '../../utils/dateFormatHelper.js';

const PurchaseOrderReturnItem = sequelize.define('PurchaseOrderReturnItem', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
 
  po_return_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: PurchaseOrderReturn,
      key: "id"
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE"
  },
 
  grn_item_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: GRNItem,
      key: "grn_item_id"
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE"
  },
 
  item_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: ItemMaster,
      key: "item_id"
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE"
  },
  company_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: Company,
      key: "id",
    },
    onUpdate: "CASCADE"
  },
  return_qty: {
    type: DataTypes.FLOAT.UNSIGNED,
    allowNull: false
  },
 
  unit_price: {
    type: DataTypes.FLOAT.UNSIGNED,
    allowNull: true
  },
  cgst: {//
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  cgst_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  sgst: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  sgst_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
  },
  tax_amount: {
    type: DataTypes.DECIMAL(15, 2),
  },
  total_amount: {
    type: DataTypes.DECIMAL(15, 2),
  },//
 
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
 
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
 
  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: User,
      key: "id"
    }
  },
 
  updated_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: User,
      key: "id"
    }
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
    allowNull: true
  }
}, {  
  tableName: 'purchase_order_returns_items',
  timestamps: false
});
 
// // Associations
// PurchaseOrderReturnItem.belongsTo(PurchaseOrder, { foreignKey: "po_id" });
PurchaseOrderReturnItem.belongsTo(Company, { foreignKey: "company_id" });
PurchaseOrderReturnItem.belongsTo(User, { foreignKey: "created_by", as: "creator" });
PurchaseOrderReturnItem.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
PurchaseOrderReturnItem.belongsTo(GRNItem, { foreignKey: "grn_item_id" });
PurchaseOrderReturnItem.belongsTo(PurchaseOrderReturn, {
  foreignKey: 'po_return_id',
  as: 'purchaseOrderReturnId', // ✅ use this in include
});

 
export default PurchaseOrderReturnItem;