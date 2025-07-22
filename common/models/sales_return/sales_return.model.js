import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import CompanyAddress from "../companyAddress.model.js";
import Company from "../company.model.js";
import { formatDateTime } from "../../utils/dateFormatHelper.js";


const SalesReturn = sequelize.define(
  "SalesReturn",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sales_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    return_generate_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    return_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    total_qty: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    cgst_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    sgst_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    igst_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    tax_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "sales_returns",
    timestamps: false,
  }
);

SalesReturn.belongsTo(Company, { foreignKey: "company_id", as: "company" });
SalesReturn.belongsTo(CompanyAddress, {
  foreignKey: "company_branch_id",          
  as: "branch",
});


SalesReturn.addHook("afterFind", (result) => {
  const formatRecordDates = (record) => {
    if (!record || !record.getDataValue) return;

    const createdAt = record.getDataValue("created_at");
    const updatedAt = record.getDataValue("updated_at");
    const returnDate = record.getDataValue("return_date");

    if (createdAt) {
      record.dataValues.created_at = formatDateTime(createdAt);
    }

    if (updatedAt) {
      record.dataValues.updated_at = formatDateTime(updatedAt);
    }
    
    if (returnDate) {
      record.dataValues.return_date = formatDateTime(returnDate);
    }
    
  };

  if (Array.isArray(result)) {
    result.forEach(formatRecordDates);
  } else if (result) {
    formatRecordDates(result);
  }
});

export default SalesReturn;
