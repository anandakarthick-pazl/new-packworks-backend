import { DataTypes, Sequelize } from "sequelize";
import sequelize from "../../database/database.js";
import SalesOrder from "./salesOrder.model.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import User from "../user.model.js";
import Sku from "../skuModel/sku.model.js";
import WorkOrder from "./workOrder.model.js";
import SkuVersion from "../skuModel/skuVersion.js";

const WorkOrderInvoice = sequelize.define(
  "WorkOrderInvoice",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: Company,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: Client,
        key: "client_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    // sku_id: {
    //   type: DataTypes.INTEGER.UNSIGNED,
    //   allowNull: true,
    //   references: {
    //     model: Sku,
    //     key: "id",
    //   },
    // },
     sku_version_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: SkuVersion,
        key: "id",
      },
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    invoice_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    sale_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: SalesOrder,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    work_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: WorkOrder,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
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
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    payment_expected_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    transaction_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    discount_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    discount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    total_tax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    payment_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    quantity: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    sku_details: {
      type: Sequelize.JSON,
      allowNull: true,
    },
    client_name: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    client_email: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    client_phone: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "work_order_invoice",
    timestamps: false,
  }
);

// Define associations
Company.hasMany(WorkOrderInvoice, { foreignKey: "company_id" });
WorkOrderInvoice.belongsTo(Company, { foreignKey: "company_id" });

Client.hasMany(WorkOrderInvoice, { foreignKey: "client_id" });
WorkOrderInvoice.belongsTo(Client, { foreignKey: "client_id" });

// Sku.hasMany(WorkOrderInvoice, { foreignKey: "sku_id" });
// WorkOrderInvoice.belongsTo(Sku, { foreignKey: "sku_id" });

SkuVersion.hasMany(WorkOrderInvoice, { foreignKey: "sku_version_id" });
WorkOrderInvoice.belongsTo(SkuVersion, { foreignKey: "sku_version_id" }); 

SalesOrder.hasMany(WorkOrderInvoice, {
  foreignKey: "sale_id",
  as: "workOrderInvoices",
});
WorkOrderInvoice.belongsTo(SalesOrder, {
  foreignKey: "sale_id",
  as: "salesOrder",
});

WorkOrder.hasMany(WorkOrderInvoice, {
  foreignKey: "work_id",
  as: "invoices",
});
WorkOrderInvoice.belongsTo(WorkOrder, {
  foreignKey: "work_id",
  as: "workOrder",
});

WorkOrderInvoice.belongsTo(User, { foreignKey: "created_by", as: "creator_invoice" });
WorkOrderInvoice.belongsTo(User, { foreignKey: "updated_by", as: "updater_invoice" });

export default WorkOrderInvoice;