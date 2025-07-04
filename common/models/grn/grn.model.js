import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import PurchaseOrder from "../po/purchase_order.model.js";
import Company from "../company.model.js";
import User from "../user.model.js";

const GRN = sequelize.define("GRN", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  grn_generate_id:{
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  po_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: PurchaseOrder,
      key: "id",
    },
    onUpdate: "CASCADE",
  },
  po_bill_id: {
    type: DataTypes.STRING(100),
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
  grn_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  delivery_note_no: {
    type: DataTypes.STRING(50),
  },
  invoice_no: {
    type: DataTypes.STRING(50),
  },
  invoice_date: {
    type: DataTypes.DATEONLY,
  },
  received_by: {
    type: DataTypes.STRING(100),
  },
  notes: {
    type: DataTypes.TEXT,
  },
  total_qty: {
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
  },
  status: {
    type: DataTypes.ENUM("active", "inactive"),
    allowNull: false,
    defaultValue: "active",
  },
  grn_status: {
    type: DataTypes.STRING(100),
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
  tableName: "grn",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  deletedAt: "deleted_at",
  paranoid: true,
  underscored: true,
});

PurchaseOrder.hasMany(GRN, { foreignKey: "po_id" });
GRN.belongsTo(PurchaseOrder, { foreignKey: "po_id", as: 'purchase_order'});

GRN.belongsTo(Company, { foreignKey: "company_id" });

GRN.belongsTo(User, { foreignKey: "created_by", as: "creator" });
GRN.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
    
GRN.belongsTo(User, { foreignKey: "created_by", as: "createdBy" });
GRN.belongsTo(User, { foreignKey: "updated_by", as: "updatedBy" });
export default GRN;
