import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import User from "../user.model.js";

const CompanyPaymentBill = sequelize.define(
  "CompanyPaymentBill",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    invoice_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    company: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    package: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    next_payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    transaction_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    payment_gateway: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    payment_status: {
      type: DataTypes.ENUM("pending", "paid", "failed"),
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
    tableName: "company_payment_bill",
    timestamps: false,
  }
);

// Associations
User.hasMany(CompanyPaymentBill, {
  foreignKey: "created_by",
  as: "createdCompanyPaymentBills",
});
User.hasMany(CompanyPaymentBill, {
  foreignKey: "updated_by",
  as: "updatedCompanyPaymentBills",
});
CompanyPaymentBill.belongsTo(User, { foreignKey: "created_by", as: "creator" });
CompanyPaymentBill.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

export default CompanyPaymentBill;
