import { DataTypes } from "sequelize";
import BaseModel from "./base.model.js";
import { formatDateTime } from '../utils/dateFormatHelper.js';
import Company from "./company.model.js";
import CompanyAddress from "./companyAddress.model.js";

class DemoRequest extends BaseModel {
  // Override init to bypass company_id requirement since this is for public form
  static init(attributes, options) {
    BaseModel.init.call(this, attributes, options);
  }
}

DemoRequest.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    company_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 255],
      },
    },
    full_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 255],
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [7, 20],
      },
    },
    role: {
      type: DataTypes.ENUM(
        'Business Owner',
        'Operations Manager', 
        'Sales Manager',
        'IT Manager',
        'Other'
      ),
      allowNull: false,
    },
    preferred_demo_time: {
      type: DataTypes.ENUM(
        'Morning (9 AM - 12 PM)',
        'Afternoon (12 PM - 5 PM)',
        'Evening (5 PM - 8 PM)'
      ),
      allowNull: false,
    },
    needs_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'contacted', 'scheduled', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    demo_scheduled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contacted_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    contacted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45), // IPv6 support
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'website_form',
    },
    // Override company_id to make it optional for demo requests
    company_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true, // Allow null for public demo requests
      references: {
        model: "companies",
        key: "id",
      },
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
  },
  {
    tableName: "demo_requests",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["email"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["created_at"],
      },
      {
        fields: ["company_name"],
      },
    ],
  }
);

DemoRequest.belongsTo(Company, {
    foreignKey: 'company_id',
    as: 'company',
});
DemoRequest.belongsTo(CompanyAddress, {
  foreignKey: "company_branch_id",
});

DemoRequest.addHook("afterFind", (result) => {
  const formatRecordDates = (record) => {
    if (!record || !record.getDataValue) return;

    const createdAt = record.getDataValue("created_at");
    const updatedAt = record.getDataValue("updated_at");

    if (createdAt) {
      record.dataValues.created_at = formatDateTime(createdAt);
    }

    if (updatedAt) {
      record.dataValues.updated_at = formatDateTime(updatedAt);
    }
  };

  if (Array.isArray(result)) {
    result.forEach(formatRecordDates);
  } else if (result) {
    formatRecordDates(result);
  }
});

export default DemoRequest;
