import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import ItemMaster from "../item.model.js";
import GRN from "../grn/grn.model.js"
import GRNItem from "../grn/grn_item.model.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import Sub_categories from "../category/sub_category.model.js";
import Categories from "../category/category.model.js";
import Sku from "../skuModel/sku.model.js";
import { formatDateTime } from '../../utils/dateFormatHelper.js';
const Inventory = sequelize.define("Inventory", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  inventory_generate_id:{
    type: DataTypes.STRING(200),
    allowNull: true,
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
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  sku_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  sku_generate_id:{
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  sales_return_id:{
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  item_code: {
    type: DataTypes.STRING(50),
  },
  grn_id: {
    type: DataTypes.INTEGER.UNSIGNED, // adjust to STRING(20) if grn_id is varchar
    references: {
      model: GRN,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
  grn_item_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    references: {
      model: GRNItem,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
  // inventory_type: {
  //   type: DataTypes.STRING(255),
  // },
  category: {
      type: DataTypes.INTEGER(11),
    },
    sub_category: {
      type: DataTypes.INTEGER(11),
      allowNull: true,
    },
  work_order_id: {
    type: DataTypes.STRING(255),
  },
  po_id: {
    type: DataTypes.INTEGER(12),
  },
  po_return_id: {
    type: DataTypes.INTEGER(12),
  },
  po_item_id: {
    type: DataTypes.INTEGER(12),
  },
  credit_note_id: {
    type: DataTypes.INTEGER(12),
  },
  debit_note_id: {
    type: DataTypes.INTEGER(12),
  },
  adjustment_id: {
    type: DataTypes.INTEGER(12),
  },
  
  description: {
    type: DataTypes.TEXT,
  },
  quantity_available: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  quantity_blocked: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  rate: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  total_amount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  batch_no: {
    type: DataTypes.STRING(50),
  },
  location: {
    type: DataTypes.STRING(100),
  },
  status: {
    type: DataTypes.ENUM("active", "inactive"),
    allowNull: false,
    defaultValue: "active",
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    // get() {
    //   return formatDateTime(this.getDataValue('created_at'));
    // }
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    // get() {
    //   return formatDateTime(this.getDataValue('updated_at'));
    // }
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
  qr_code_url: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  stock_status: {
    type: DataTypes.ENUM('in_stock', 'low_stock', 'out_of_stock'),
    allowNull: false,
    defaultValue: 'out_of_stock'
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
  tableName: "inventory",
  timestamps: false,
});

// ItemMaster.hasMany(Inventory, { foreignKey: "item_id" });
// Inventory.belongsTo(ItemMaster, { foreignKey: "item_id" , as: 'item'  });

GRN.hasMany(Inventory, { foreignKey: "grn_id" });
Inventory.belongsTo(GRN, { foreignKey: "grn_id" });

GRNItem.hasMany(Inventory, { foreignKey: "grn_item_id" });
Inventory.belongsTo(GRNItem, { foreignKey: "grn_item_id" });

Inventory.belongsTo(Company, { foreignKey: "company_id" });
Inventory.belongsTo(User, { foreignKey: "created_by", as: "creator" });
Inventory.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

Inventory.belongsTo(Categories, {foreignKey: 'category', as: 'category_info' });
Inventory.belongsTo(Sub_categories, {foreignKey: 'sub_category', as: 'sub_category_info' });
Inventory.belongsTo(ItemMaster, { as: 'item_info', foreignKey: 'item_id' });
Inventory.belongsTo(Sku, {
  foreignKey: 'item_id',         // or the correct foreign key that links to SKU
  as: 'sku_info'
});


Inventory.addHook("afterFind", (result) => {
  const formatRecordDates = (record) => {
    if (!record || !record.getDataValue) return;

    const createdAt = record.getDataValue("created_at");
    const updatedAt = record.getDataValue("updated_at");

    if (createdAt) {
      record.dataValues.created_at = formatDateTime(createdAt);
    }

    if (updatedAt) {
      record.dataValues.updated_at = formatDateTime(updatedAt);
    }
  };

  if (Array.isArray(result)) {
    result.forEach(formatRecordDates);
  } else if (result) {
    formatRecordDates(result);
  }
});
export default Inventory;
