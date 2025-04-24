import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import PurchaseOrder from "../po/purchase_order.model.js";
import ItemMaster from "../item.model.js";

const PurchaseOrderItem = sequelize.define("PurchaseOrderItem", {
  po_item_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  po_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: PurchaseOrder,
      key: "po_id",
    },
    onUpdate: "CASCADE",
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
  item_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: ItemMaster,
      key: "item_id",
    },
    onUpdate: "CASCADE",
  },
  item_code: {
    type: DataTypes.STRING(50),
  },
  po_item_name: {
    type: DataTypes.STRING(255),
  },
  description: {
    type: DataTypes.TEXT,
  },
  hsn_code: {
    type: DataTypes.STRING(20),
  },
  quantity: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  uom: {
    type: DataTypes.STRING(10),
  },
  unit_price: {
    type: DataTypes.DECIMAL(15, 2),
  },
  cgst: {
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
  },
  status: {
    type: DataTypes.ENUM("active", "inactive"),
    allowNull: false,
    defaultValue: "active",
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
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
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
  updated_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: User,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
}, {
  tableName: "purchase_order_items",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  deletedAt: "deleted_at",
  // paranoid: true,
  underscored: true,
});

// Associations
PurchaseOrder.hasMany(PurchaseOrderItem, { foreignKey: "po_id" });
PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: "po_id" });

ItemMaster.hasMany(PurchaseOrderItem, { foreignKey: "item_id" });
PurchaseOrderItem.belongsTo(ItemMaster, { foreignKey: "item_id" });

PurchaseOrderItem.belongsTo(Company, { foreignKey: "company_id" });
PurchaseOrderItem.belongsTo(User, { foreignKey: "created_by", as: "creator" });
PurchaseOrderItem.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default PurchaseOrderItem;
