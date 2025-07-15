import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import User from "../user.model.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import WorkOrderInvoice from "../salesOrder/workOrderInvoice.model.js";
import { formatDateTime } from '../../utils/dateFormatHelper.js';

const CreditNote = sequelize.define(
  "CreditNote",
  {
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
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: Client,
        key: "client_id",
      },
      onUpdate: "CASCADE",
    },
    client_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    work_order_invoice_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: WorkOrderInvoice,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    work_order_invoice_number: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    credit_generate_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    credit_reference_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    invoice_total_amout: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    credit_total_amount: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active',
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: 'id',
      },
      onUpdate: 'CASCADE',
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: 'id',
      },
      onUpdate: 'CASCADE',
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
  },
  {
    tableName: "credit_notes",
    timestamps: false,
  }
);

// Associations
Company.hasMany(CreditNote, { foreignKey: "company_id", as: "creditNotes" });
CreditNote.belongsTo(Company, { foreignKey: "company_id", as: "company" });

Client.hasMany(CreditNote, { foreignKey: "client_id", as: "creditNotes" });
CreditNote.belongsTo(Client, { foreignKey: "client_id", as: "client" });

WorkOrderInvoice.hasMany(CreditNote, { foreignKey: "work_order_invoice_id", as: "creditNotes" });
CreditNote.belongsTo(WorkOrderInvoice, { foreignKey: "work_order_invoice_id", as: "workOrderInvoice" });


User.hasMany(CreditNote, { foreignKey: "created_by", as: "createdCreditNotes" });
User.hasMany(CreditNote, { foreignKey: "updated_by", as: "updatedCreditNotes" });
CreditNote.belongsTo(User, { foreignKey: "created_by", as: "creator" });
CreditNote.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default CreditNote;
