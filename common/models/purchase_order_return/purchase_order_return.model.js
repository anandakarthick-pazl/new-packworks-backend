import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js"; // Adjust the import based on your project structure
import Company from "../company.model.js"; // If you have this model
import User from "../user.model.js"; // If you have this model
import PurchaseOrder from "../po/purchase_order.model.js"; // If you have this model
import GRN from "../grn/grn.model.js"; // If you have this model
import GRNItem from "../grn/grn_item.model.js"; // If you have this model
import ItemMaster from "../item.model.js";
import { formatDateTime } from '../../utils/dateFormatHelper.js';

 
const PurchaseOrderReturn = sequelize.define('PurchaseOrderReturn', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  purchase_return_generate_id:{
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  grn_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: GRN,    
      key: "grn_id"      
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL"
  },
  po_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: PurchaseOrder,
      key: "po_id",
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
  total_qty: {//
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  cgst_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  sgst_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  tax_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },//
  return_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  payment_terms: {
    type: DataTypes.STRING(50)
  },
  notes: {
    type: DataTypes.TEXT,
  },
  status: {
    type: DataTypes.ENUM('initiated', 'processed', 'cancelled'),
    allowNull: false,
    defaultValue: 'initiated'
  },
  decision: {
    type: DataTypes.ENUM('approve', 'disapprove'),
    allowNull: false,
    defaultValue: 'approve'
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
  }
}, {
  tableName: 'purchase_order_returns',
  timestamps: false
});
 
// Associations
PurchaseOrderReturn.belongsTo(PurchaseOrder, { foreignKey: "po_id", as: "PurchaseOrder"  });
PurchaseOrderReturn.belongsTo(Company, { foreignKey: "company_id" });
PurchaseOrderReturn.belongsTo(User, { foreignKey: "created_by", as: "creator" });
PurchaseOrderReturn.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
PurchaseOrderReturn.belongsTo(GRN, { foreignKey: "grn_id" });

 
 
 
export default PurchaseOrderReturn;