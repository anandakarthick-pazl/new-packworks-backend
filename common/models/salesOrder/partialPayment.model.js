import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import WorkOrderInvoice from "./workOrderInvoice.model.js";

const PartialPayment = sequelize.define(
  "PartialPayment",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    work_order_invoice_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: WorkOrderInvoice,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    payment_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    reference_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    credit_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    remarks: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "completed", "failed"),
      allowNull: false,
      defaultValue: "completed",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "partial_payment",
    timestamps: false,
  }
);

// Association
WorkOrderInvoice.hasMany(PartialPayment, {
  foreignKey: "work_order_invoice_id",
  as: "partial_payments",
});
PartialPayment.belongsTo(WorkOrderInvoice, {
  foreignKey: "work_order_invoice_id",
  as: "invoice",
});

export default PartialPayment;
