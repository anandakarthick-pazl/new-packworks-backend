import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import User from "../user.model.js";
import PurchaseOrderReturn from "../purchase_order_return/purchase_order_return.model.js"; 
import PurchaseOrderReturnItem from "../purchase_order_return/purchase_order_return_item.model.js";
import PurchaseOrder from "../po/purchase_order.model.js";
import InvoiceSetting from "../invoiceSetting.model.js";
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
    defaultValue: DataTypes.NOW
  },

  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
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
DebitNote.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
DebitNote.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });
DebitNote.belongsTo(PurchaseOrderReturn, { foreignKey: 'po_return_id' });






export default DebitNote;
