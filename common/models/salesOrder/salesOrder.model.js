import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import User from "../user.model.js";
import { formatDateTime } from '../../utils/dateFormatHelper.js';
import CompanyAddress from "../companyAddress.model.js";

// OrderDetails Model
const SalesOrder = sequelize.define(
  "SalesOrder",
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
      onDelete: "CASCADE",
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
    
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: Client,
        key: "client_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    sales_ui_id:{
      type: DataTypes.STRING,
      allowNull: true,
    },
    sales_generate_id:{
      type: DataTypes.STRING,
      allowNull: true,
    },
    estimated: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    client: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    credit_period: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    freight_paid: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    confirmation: {
      type: DataTypes.ENUM("Email", "Oral"),
      allowNull: false,
    },
    sales_status:{
      type: DataTypes.ENUM('Pending','In-progress','Completed','Rejected'),
      allowNull: false,
      defaultValue: "Pending",
    },
    confirmation_email:{
      type: DataTypes.STRING,
      allowNull: true,
    },
    confirmation_name:{
      type: DataTypes.STRING,
      allowNull: true,
    },
    confirmation_mobile:{
      type: DataTypes.NUMBER,
      allowNull: true,
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    sgst: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    cgst: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    igst: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    total_incl_gst: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      // get() {
      //   return formatDateTime(this.getDataValue('created_at'));
      // }
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      // get() {
      //   return formatDateTime(this.getDataValue('updated_at'));
      // }
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
  },
  {
    tableName: "sales_order",
    timestamps: false,
  }
);

Company.hasMany(SalesOrder, { foreignKey: "company_id" });
SalesOrder.belongsTo(Company, { foreignKey: "company_id" });

CompanyAddress.hasMany(SalesOrder, { foreignKey: "company_branch_id", as: "salesOrders" });
SalesOrder.belongsTo(CompanyAddress, { foreignKey: "company_branch_id", as: "branch" });

Client.hasMany(SalesOrder, { foreignKey: "client_id" });
SalesOrder.belongsTo(Client, { foreignKey: "client_id" });

// User.hasMany(SalesOrder, { foreignKey: "created_by" });
// User.hasMany(SalesOrder, { foreignKey: "updated_by" });
SalesOrder.belongsTo(User, { foreignKey: "created_by", as: "creator_sales" });
SalesOrder.belongsTo(User, { foreignKey: "updated_by", as: "updater_sales" });

SalesOrder.addHook("afterFind", (result) => {
  const formatRecordDates = (record) => {
    if (!record || !record.getDataValue) return;

    const createdAt = record.getDataValue("created_at");
    const updatedAt = record.getDataValue("updated_at");
    const estimatedDate = record.getDataValue("estimated");
    
    if (createdAt) {
      record.dataValues.created_at = formatDateTime(createdAt);
    }

    if (updatedAt) {
      record.dataValues.updated_at = formatDateTime(updatedAt);
    }

    if (estimatedDate) {
      record.dataValues.estimated = formatDateTime(estimatedDate);
    }
  };

  if (Array.isArray(result)) {
    result.forEach(formatRecordDates);
  } else if (result) {
    formatRecordDates(result);
  }
});




export default SalesOrder;
