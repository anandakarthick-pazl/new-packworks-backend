import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import User from "../user.model.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import WorkOrderInvoice from "../salesOrder/workOrderInvoice.model.js";

const DebitNote = sequelize.define(
  "DebitNote",
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
    debit_generate_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    debit_reference_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    invoice_total_amount: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    debit_total_amount: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      defaultValue: "active",
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "debit_notes",
    timestamps: false,
  }
);

// Associations
Company.hasMany(DebitNote, { foreignKey: "company_id", as: "debitNotes" });
DebitNote.belongsTo(Company, { foreignKey: "company_id", as: "company" });

Client.hasMany(DebitNote, { foreignKey: "client_id", as: "debitNotes" });
DebitNote.belongsTo(Client, { foreignKey: "client_id", as: "client" });

WorkOrderInvoice.hasMany(DebitNote, { foreignKey: "work_order_invoice_id", as: "debitNotes" });
DebitNote.belongsTo(WorkOrderInvoice, { foreignKey: "work_order_invoice_id", as: "workOrderInvoice" });

User.hasMany(DebitNote, { foreignKey: "created_by", as: "createdDebitNotes" });
User.hasMany(DebitNote, { foreignKey: "updated_by", as: "updatedDebitNotes" });
DebitNote.belongsTo(User, { foreignKey: "created_by", as: "creator" });
DebitNote.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default DebitNote;
