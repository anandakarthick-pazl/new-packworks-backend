import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import ItemMaster from "../item.model.js";
import GRN from "../grn/grn.model.js"
import GRNItem from "../grn/grn_item.model.js";
import Company from "../company.model.js";
import User from "../user.model.js";

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
  work_order_no: {
    type: DataTypes.STRING(255),
  },
  po_id: {
    type: DataTypes.INTEGER(12),
  },
  description: {
    type: DataTypes.TEXT,
  },
  quantity_available: {
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
  tableName: "inventory",
  timestamps: false,
});

ItemMaster.hasMany(Inventory, { foreignKey: "item_id" });
Inventory.belongsTo(ItemMaster, { foreignKey: "item_id" });

GRN.hasMany(Inventory, { foreignKey: "grn_id" });
Inventory.belongsTo(GRN, { foreignKey: "grn_id" });

GRNItem.hasMany(Inventory, { foreignKey: "grn_item_id" });
Inventory.belongsTo(GRNItem, { foreignKey: "grn_item_id" });

Inventory.belongsTo(Company, { foreignKey: "company_id" });
Inventory.belongsTo(User, { foreignKey: "created_by", as: "creator" });
Inventory.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default Inventory;
