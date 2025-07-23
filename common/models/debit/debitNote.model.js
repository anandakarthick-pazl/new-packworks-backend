import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import User from "../user.model.js";
import PurchaseOrderReturn from "../purchase_order_return/purchase_order_return.model.js"; 
import PurchaseOrderReturnItem from "../purchase_order_return/purchase_order_return_item.model.js";
import PurchaseOrder from "../po/purchase_order.model.js";
import InvoiceSetting from "../invoiceSetting.model.js";
import { formatDateTime } from '../../utils/dateFormatHelper.js';
import CompanyAddress from "../companyAddress.model.js";
const DebitNote = sequelize.define('DebitNote', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },

  // debit_note_number: {
  //   type: DataTypes.STRING(200),
  //   allowNull: false,
  //   unique: true
  // },
  debit_note_generate_id:{
        type: DataTypes.STRING(200),
        allowNull: true,
      },
  po_return_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: PurchaseOrderReturn,
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },

  company_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: Company,
      key: 'id'
    },
    onUpdate: 'CASCADE'
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

  reference_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },


 
  // rate: {
  //   type: DataTypes.DECIMAL(10, 2),
  //   allowNull: true
  // },

 
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },

  // sub_total: {
  //   type: DataTypes.DECIMAL(15, 2),
  //   allowNull: true
  // },

  // adjustment: {
  //   type: DataTypes.DECIMAL(15, 2),
  //   allowNull: true
  // },
   supplier_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },

  tax_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },

  total_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },

  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  remark: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  debit_note_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },

   status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },

  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    }
  },

  updated_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    }
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
    allowNull: true,
    defaultValue: null,
    // get() {
    //   return formatDateTime(this.getDataValue('updated_at'));
    // }
  },

  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'debit_notes',
  timestamps: false
});
DebitNote.belongsTo(Company, { foreignKey: 'company_id' });
DebitNote.belongsTo(CompanyAddress, { foreignKey: 'company_branch_id' });
DebitNote.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
DebitNote.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });
DebitNote.belongsTo(PurchaseOrderReturn, { foreignKey: 'po_return_id' });

DebitNote.addHook("afterFind", (result) => {
  const formatRecordDates = (record) => {
    if (!record || !record.getDataValue) return;

    const createdAt = record.getDataValue("created_at");
    const updatedAt = record.getDataValue("updated_at");
    const debitNoteDate = record.getDataValue("debit_note_date");

    if (createdAt) {
      record.dataValues.created_at = formatDateTime(createdAt);
    }

    if (updatedAt) {
      record.dataValues.updated_at = formatDateTime(updatedAt);
    }
    
    if (debitNoteDate) {
      record.dataValues.debit_note_date = formatDateTime(debitNoteDate);
    }
  };

  if (Array.isArray(result)) {
    result.forEach(formatRecordDates);
  } else if (result) {
    formatRecordDates(result);
  }
});


// Date formatting hook
// DebitNote.addHook("afterFind", (result) => {
//   const formatRecordDates = (record) => {
//     if (!record || !record.dataValues) return;

//     console.log("Formatting DebitNote record:", record);

//     // Format DebitNote dates
//     const formatDates = (obj) => {
//       if (obj.debit_note_date) obj.debit_note_date = formatDateTime(obj.debit_note_date);
//       if (obj.created_at) obj.created_at = formatDateTime(obj.created_at);
//       if (obj.updated_at) obj.updated_at = formatDateTime(obj.updated_at);
//       if (obj.deleted_at) obj.deleted_at = formatDateTime(obj.deleted_at);
//     };

//     // Format current record's dates
//     formatDates(record.dataValues);

//     // Format PurchaseOrderReturn dates if present
//     if (record.dataValues.PurchaseOrderReturn) {
//       const poReturn = record.dataValues.PurchaseOrderReturn;
      
//       // Format PurchaseOrderReturn dates
//       if (poReturn.return_date) poReturn.return_date = formatDateTime(poReturn.return_date);
//       if (poReturn.created_at) poReturn.created_at = formatDateTime(poReturn.created_at);
//       if (poReturn.updated_at) poReturn.updated_at = formatDateTime(poReturn.updated_at);
//       if (poReturn.deleted_at) poReturn.deleted_at = formatDateTime(poReturn.deleted_at);

//       // Format PurchaseOrder dates if present
//       if (poReturn.PurchaseOrder) {
//         const po = poReturn.PurchaseOrder;
//         if (po.po_date) po.po_date = formatDateTime(po.po_date);
//         if (po.valid_till) po.valid_till = formatDateTime(po.valid_till);
//         if (po.created_at) po.created_at = formatDateTime(po.created_at);
//         if (po.updated_at) po.updated_at = formatDateTime(po.updated_at);
//       }

//       // Format items dates if present
//       if (poReturn.items && Array.isArray(poReturn.items)) {
//         poReturn.items.forEach(item => {
//           if (item.created_at) item.created_at = formatDateTime(item.created_at);
//           if (item.updated_at) item.updated_at = formatDateTime(item.updated_at);
//           if (item.deleted_at) item.deleted_at = formatDateTime(item.deleted_at);
//         });
//       }
//     }
//   };

//   if (Array.isArray(result)) {
//     result.forEach(record => {
//       if (record) formatRecordDates(record);
//     });
//   } else if (result) {
//     formatRecordDates(result);
//   }
// });






export default DebitNote;
