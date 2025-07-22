import { DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";
import User from "./user.model.js";
import BaseModel from "./base.model.js";
import { formatDateTime } from '../utils/dateFormatHelper.js';
import CompanyAddress from "./companyAddress.model.js";

class Client extends BaseModel { }

Client.init(
  {
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    client_ui_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
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
      allowNull: false,
      references: {
        model: CompanyAddress,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    client_ref_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gst_status: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: true,
    },
    gst_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    entity_type: {
      type: DataTypes.ENUM("Client", "Vendor"),
      allowNull: false,
    },
    customer_type: {
      type: DataTypes.ENUM("Business", "Individual"),
      allowNull: false,
    },
    salutation: {
      type: DataTypes.STRING,
    },
    first_name: {
      type: DataTypes.STRING,
    },
    last_name: {
      type: DataTypes.STRING,
    },
    display_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    company_name: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    work_phone: {
      type: DataTypes.STRING,
    },
    mobile: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    PAN: {
      type: DataTypes.STRING,
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: "INR Indian Rupee",
      allowNull: true,
    },
    opening_balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
    },
    payment_terms: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    enable_portal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    },
    portal_language: {
      type: DataTypes.STRING,
      defaultValue: "English",
      allowNull: true,
    },
    documents: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    website_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    department: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    designation: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    twitter: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    skype: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    facebook: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    credit_balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    }
    ,
    debit_balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      // get() {
      //   return formatDateTime(this.getDataValue('created_at'));
      // }
    },
    updated_at: {
      type: DataTypes.DATE,
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
  },
  {
    tableName: "clients",
    timestamps: false,
  }
);

// Define the relationship
Company.hasMany(Client, { foreignKey: "company_id" });
Client.belongsTo(Company, { foreignKey: "company_id" });

CompanyAddress.hasMany(Client, { foreignKey: "company_branch_id", as: "clients" });
Client.belongsTo(CompanyAddress, { foreignKey: "company_branch_id", as: "company_address" });
// Update the Client model associations
User.hasMany(Client, { foreignKey: "created_by", as: "created_clients" });
User.hasMany(Client, { foreignKey: "updated_by", as: "updated_clients" });
Client.belongsTo(User, { foreignKey: "created_by", as: "creator" });
Client.belongsTo(User, { foreignKey: "updated_by", as: "updater" });


// Client.addHook("afterFind", (result) => {
//   const formatRecordDates = (record) => {
//     if (!record || !record.getDataValue) return;

//     const createdAt = record.getDataValue("created_at");
//     const updatedAt = record.getDataValue("updated_at");

//     if (createdAt) {
//       record.dataValues.created_at = formatDateTime(createdAt);
//     }

//     if (updatedAt) {
//       record.dataValues.updated_at = formatDateTime(updatedAt);
//     }
//   };

//   if (Array.isArray(result)) {
//     result.forEach(formatRecordDates);
//   } else if (result) {
//     formatRecordDates(result);
//   }
// });


Client.addHook("afterFind", (result) => {
  const formatRecordDates = (record) => {
    if (!record) return;

    // Debug: Check what we're receiving
    console.log('Processing client record:', record.client_ui_id);

    // Format main client dates (handles both Sequelize instances and plain objects)
    const dateFields = ['created_at', 'updated_at'];
    dateFields.forEach(field => {
      if (record.dataValues?.[field]) {
        record.dataValues[field] = formatDateTime(record.dataValues[field]);
      } else if (record[field]) {
        record[field] = formatDateTime(record[field]);
      }
    });

    console.log(record,"record");
    
    // Format nested addresses if included
     const addresses = record.addresses || (record.dataValues && record.dataValues.addresses);
    if (Array.isArray(addresses)) {
      addresses.forEach(address => {
        const addressData = address.dataValues || address;
        if (addressData.created_at) {
          addressData.created_at = formatDateTime(addressData.created_at);
        }
        if (addressData.updated_at) {
          addressData.updated_at = formatDateTime(addressData.updated_at);
        }
      });
    }
  };

  try {
    if (Array.isArray(result)) {
      console.log(`Formatting ${result.length} client records`);
      result.forEach(formatRecordDates);
    } else if (result) {
      console.log('Formatting single client record');
      formatRecordDates(result);
    }
  } catch (error) {
    console.error('Error in Client afterFind hook:', error);
  }
});

export default Client;
