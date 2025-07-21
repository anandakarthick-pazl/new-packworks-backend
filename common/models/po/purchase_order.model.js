import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import { formatDateTime } from '../../utils/dateFormatHelper.js';
import CompanyAddress from "../companyAddress.model.js";


const PurchaseOrder = sequelize.define('PurchaseOrder', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      purchase_generate_id:{
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      po_code: {
        type: DataTypes.STRING(100)
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
      po_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        // get() {
        //   return formatDateTime(this.getDataValue('po_date'));
        // }
      },
      valid_till: {
        type: DataTypes.DATEONLY,
        // get() {
        //   return formatDateTime(this.getDataValue('valid_till'));
        // }
      },
      supplier_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      use_this: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      debit_balance_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      debit_used_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      supplier_name: {
        type: DataTypes.STRING(100)
      },
      billing_address: {
        type: DataTypes.TEXT
      },
      shipping_address: {
        type: DataTypes.TEXT
      },
      supplier_contact: {
        type: DataTypes.STRING(50)
      },
      supplier_email: {
        type: DataTypes.STRING(100)
      },
      payment_terms: {
        type: DataTypes.STRING(50)
      },
      freight_terms: {
        type: DataTypes.STRING(50)
      },
      total_qty: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      cgst_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      sgst_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      tax_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
      po_status: {
        type: DataTypes.ENUM('created', 'partialy-recieved', 'received', 'amended', 'returned'),
        defaultValue: 'created',
      },
      payment_status: {
        type: DataTypes.STRING(100),
        defaultValue: 'pending',
      },
      decision: {
        type: DataTypes.ENUM('approve', 'disapprove'),
        allowNull: false,
        defaultValue: "approve",
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
    }, {
      tableName: 'purchase_orders',
      timestamps: false,
    });

    PurchaseOrder.belongsTo(Company, { foreignKey: "company_id" });
    PurchaseOrder.belongsTo(CompanyAddress, { foreignKey: "company_branch_id", as: "branch" });
    PurchaseOrder.belongsTo(User, { foreignKey: "created_by", as: "creator" });
    PurchaseOrder.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

    // PurchaseOrder.addHook("afterFind", (result) => {
    //   const formatRecordDates = (record) => {
    //     if (!record || !record.getDataValue) return;
    
    //     const createdAt = record.getDataValue("created_at");
    //     const updatedAt = record.getDataValue("updated_at");
    //     const poDate = record.getDataValue("po_date");
    
    //     if (createdAt) {
    //       record.dataValues.created_at = formatDateTime(createdAt);
    //     }
    
    //     if (updatedAt) {
    //       record.dataValues.updated_at = formatDateTime(updatedAt);
    //     }
        
    //     if (poDate) {
    //       record.dataValues.po_date = formatDateTime(poDate);
    //     }
    //   };
    
    //   if (Array.isArray(result)) {
    //     result.forEach(formatRecordDates);
    //   } else if (result) {
    //     formatRecordDates(result);
    //   }
    // });


PurchaseOrder.addHook("afterFind", (result) => {
  const formatRecordDates = (record) => {
    if (!record || !record.getDataValue) return;

    // Format parent dates
    const createdAt = record.getDataValue("created_at");
    const updatedAt = record.getDataValue("updated_at");
    const poDate = record.getDataValue("po_date");
    const validTill = record.getDataValue("valid_till");

    if (createdAt) record.dataValues.created_at = formatDateTime(createdAt);
    if (updatedAt) record.dataValues.updated_at = formatDateTime(updatedAt);
    if (poDate) record.dataValues.po_date = formatDateTime(poDate);
    if (validTill) record.dataValues.valid_till = formatDateTime(validTill);

    // Format included PurchaseOrderItems
      if (record.dataValues.PurchaseOrderItems && Array.isArray(record.dataValues.PurchaseOrderItems)) {
        record.dataValues.PurchaseOrderItems = record.dataValues.PurchaseOrderItems.map(item => {
          if (item.dataValues) {
            if (item.dataValues.created_at) {
              item.dataValues.created_at = formatDateTime(item.dataValues.created_at);
            }
            if (item.dataValues.updated_at) {
              item.dataValues.updated_at = formatDateTime(item.dataValues.updated_at);
            }
            if (item.dataValues.deleted_at) {
              item.dataValues.deleted_at = formatDateTime(item.dataValues.deleted_at);
            }
            return item;
          } else {
            if (item.created_at) {
              item.created_at = formatDateTime(item.created_at);
            }
            if (item.updated_at) {
              item.updated_at = formatDateTime(item.updated_at);
            }
            if (item.deleted_at) {
              item.deleted_at = formatDateTime(item.deleted_at);
            }
            return item;
          }
        });
      } 
  };
  
  if (Array.isArray(result)) {
    result.forEach(formatRecordDates);
  } else if (result) {
    formatRecordDates(result);
  }
});
    
    export default PurchaseOrder;
  
  