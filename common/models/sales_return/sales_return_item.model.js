import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import { formatDateTime } from '../../utils/dateFormatHelper.js';
import CompanyAddress from "../companyAddress.model.js";

const SalesReturnItem = sequelize.define("SalesReturnItem", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    sales_return_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    sales_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    item_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    return_qty: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    unit_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    cgst: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    cgst_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    sgst: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    sgst_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    igst: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    igst_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    tax_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    company_id: {
        type: DataTypes.INTEGER,
        allowNull: false
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
        allowNull: false
    },
    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        // get() {
        //     return formatDateTime(this.getDataValue('created_at'));
        // }
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        // get() {
        //     return formatDateTime(this.getDataValue('updated_at'));
        // }
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'sales_return_items',
    timestamps: false
});

CompanyAddress.hasMany(SalesReturnItem, { foreignKey: "company_branch_id", as: "salesReturnItems" });
SalesReturnItem.belongsTo(CompanyAddress, { foreignKey: "company_branch_id", as: "branch" });

SalesReturnItem.belongsTo(sequelize.models.SalesReturn, { foreignKey: "sales_return_id", as: "salesReturn" });
SalesReturnItem.belongsTo(sequelize.models.ItemMaster, { foreignKey: "item_id", as: "itemInfo" });
SalesReturnItem.belongsTo(sequelize.models.User, { foreignKey: "created_by", as: "creator" });
SalesReturnItem.belongsTo(sequelize.models.User, { foreignKey: "updated_by", as: "updater" });


SalesReturnItem.addHook("afterFind", (result) => {
  const formatRecordDates = (record) => {
    if (!record || !record.getDataValue) return;

    const createdAt = record.getDataValue("created_at");
    const updatedAt = record.getDataValue("updated_at");
    const billDate = record.getDataValue("bill_date");

    if (createdAt) {
      record.dataValues.created_at = formatDateTime(createdAt);
    }

    if (updatedAt) {
      record.dataValues.updated_at = formatDateTime(updatedAt);
    }
    
    if (billDate) {
      record.dataValues.bill_date = formatDateTime(billDate);
    }
  };

  if (Array.isArray(result)) {
    result.forEach(formatRecordDates);
  } else if (result) {
    formatRecordDates(result);
  }
});

export default SalesReturnItem;
