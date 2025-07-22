import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import PurchaseOrder from "../po/purchase_order.model.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import CompanyAddress from "../companyAddress.model.js";
import { formatDateTime } from "../../utils/dateFormatHelper.js";

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
  company_branch_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: CompanyAddress,
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
GRN.belongsTo(CompanyAddress, { foreignKey: "company_branch_id", as: "branch" });

GRN.belongsTo(User, { foreignKey: "created_by", as: "creator" });
GRN.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
    
GRN.belongsTo(User, { foreignKey: "created_by", as: "createdBy" });
GRN.belongsTo(User, { foreignKey: "updated_by", as: "updatedBy" });

// GRN.addHook("afterFind", (result) => {
//   const formatRecordDates = (record) => {
//     if (!record || !record.getDataValue) return;

//     const createdAt = record.getDataValue("created_at");
//     const updatedAt = record.getDataValue("updated_at");
//     const grnDate = record.getDataValue("grn_date");
//     const invoiceDate = record.getDataValue("invoice_date");

//     if (createdAt) {
//       record.dataValues.created_at = formatDateTime(createdAt);
//     }

//     if (updatedAt) {
//       record.dataValues.updated_at = formatDateTime(updatedAt);
//     }
    
//     if (grnDate) {
//       record.dataValues.grn_date = formatDateTime(grnDate);
//     }

//     if (invoiceDate) {
//       record.dataValues.invoice_date = formatDateTime(invoiceDate);
//     }

//   };

//   if (Array.isArray(result)) {
//     result.forEach(formatRecordDates);
//   } else if (result) {
//     formatRecordDates(result);
//   }
// });

// Add this hook to your GRN model
GRN.addHook("afterFind", (result) => {
  const formatRecordDates = (record) => {
    if (!record || !record.getDataValue) return;

    // Format main GRN dates
    const dateFields = {
      created_at: record.getDataValue("created_at"),
      updated_at: record.getDataValue("updated_at"),
      grn_date: record.getDataValue("grn_date"),
      invoice_date: record.getDataValue("invoice_date"),
      deleted_at: record.getDataValue("deleted_at")
    };

    Object.entries(dateFields).forEach(([field, value]) => {
      if (value) {
        record.dataValues[field] = formatDateTime(value);
      }
    });

    // Format nested GRNItems
    if (record.dataValues.GRNItems && Array.isArray(record.dataValues.GRNItems)) {
      record.dataValues.GRNItems = record.dataValues.GRNItems.map(item => {
        const itemDates = {
          created_at: item.dataValues?.created_at || item.created_at,
          updated_at: item.dataValues?.updated_at || item.updated_at,
          deleted_at: item.dataValues?.deleted_at || item.deleted_at
        };

        Object.entries(itemDates).forEach(([field, value]) => {
          if (value) {
            if (item.dataValues) {
              item.dataValues[field] = formatDateTime(value);
            } else {
              item[field] = formatDateTime(value);
            }
          }
        });

        return item;
      });
    }

    // Format nested purchase_order dates if they exist
    if (record.dataValues.purchase_order) {
      const poDates = {
        created_at: record.dataValues.purchase_order.created_at,
        updated_at: record.dataValues.purchase_order.updated_at,
        po_date: record.dataValues.purchase_order.po_date,
        valid_till: record.dataValues.purchase_order.valid_till
      };

      Object.entries(poDates).forEach(([field, value]) => {
        if (value) {
          record.dataValues.purchase_order[field] = formatDateTime(value);
        }
      });
    }
  };

  if (Array.isArray(result)) {
    result.forEach(formatRecordDates);
  } else if (result) {
    formatRecordDates(result);
  }
});
export default GRN;
