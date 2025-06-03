import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import GRN from "./grn.model.js";
import PurchaseOrderItem from "../po/purchase_order_item.model.js";
import ItemMaster from "../item.model.js";
import Company from "../company.model.js";
import User from "../user.model.js";

const GRNItem = sequelize.define("GRNItem", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
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
  grn_id: {
    type: DataTypes.INTEGER.UNSIGNED, // Assuming grn_id in GRN is an INTEGER (auto-incremented)
    allowNull: false,
    references: {
      model: GRN,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  },
  po_item_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: PurchaseOrderItem,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  },
  item_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: ItemMaster,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  },
  item_code: {
    type: DataTypes.STRING(50),
  },
  grn_item_name: {
    type: DataTypes.STRING(255),
  },
  description: {
    type: DataTypes.TEXT,
  },
  quantity_ordered: {
    type: DataTypes.DECIMAL(15, 2),
  },
  quantity_received: {
    type: DataTypes.DECIMAL(15, 2),
  },
  accepted_quantity: {
    type: DataTypes.DECIMAL(15, 2),
  },
  rejected_quantity: {
    type: DataTypes.DECIMAL(15, 2),
  },
  batch_no: {
    type: DataTypes.STRING(50),
  },
  notes: {
    type: DataTypes.TEXT,
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
  tableName: "grn_items",
  timestamps: false,
});

GRN.hasMany(GRNItem, { foreignKey: "grn_id" });
GRNItem.belongsTo(GRN, { foreignKey: "grn_id" });

PurchaseOrderItem.hasMany(GRNItem, { foreignKey: "po_item_id" });
GRNItem.belongsTo(PurchaseOrderItem, { foreignKey: "po_item_id" });

ItemMaster.hasMany(GRNItem, { foreignKey: "item_id" });
GRNItem.belongsTo(ItemMaster, { foreignKey: "item_id" });

GRNItem.belongsTo(Company, { foreignKey: "company_id" });
GRNItem.belongsTo(User, { foreignKey: "created_by", as: "creator" });
GRNItem.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
GRNItem.belongsTo(GRN, { foreignKey: 'grn_id', as: 'grn' });

export default GRNItem;
