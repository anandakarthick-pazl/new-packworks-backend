import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";
import { formatDateTime } from '../../utils/dateFormatHelper.js';
import CompanyAddress from "../companyAddress.model.js";
// import { addDateFormatterHook } from '../../utils/dateFormatterHook.js';

const ProductionSchedule = sequelize.define("ProductionSchedule", {
    id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  production_schedule_generate_id: {
    type: DataTypes.STRING(200),
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
      allowNull: true,
      references: {
        model: CompanyAddress,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
  employee_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  machine_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  group_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  task_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  production_status: {
    type: DataTypes.ENUM("in_progress", "completed"),
    defaultValue: "in_progress"
  },
  status: {
    type: DataTypes.ENUM("active", "inactive"),
    defaultValue: "active",
  },
  notes: {
    type: DataTypes.TEXT,
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
 
  group_manufactured_quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
 
  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: User,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
  updated_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: User,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
}, {
  tableName: "production_schedule",
  timestamps: false,
});

ProductionSchedule.belongsTo(Company, { foreignKey: "company_id" });
ProductionSchedule.belongsTo(CompanyAddress, { foreignKey: "company_branch_id", as: "branch" });
ProductionSchedule.belongsTo(User, { foreignKey: "created_by", as: "creator" });
ProductionSchedule.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

// ProductionSchedule.addHook("afterFind", (result) => {
//   const formatRecordDates = (record) => {
//     if (!record) return;

//     // Check if it's a raw query result (plain object) or Sequelize instance
//     const isRawResult = !record.getDataValue;
    
//     if (isRawResult) {
//       // Handle raw query results (plain objects)
//       if (record.created_at) {
//         record.created_at = formatDateTime(record.created_at);
//       }
//       if (record.updated_at) {
//         record.updated_at = formatDateTime(record.updated_at);
//       }
//       if (record.start_time) {
//         record.start_time = formatDateTime(record.start_time);
//       }
//       if (record.end_time) {
//         record.end_time = formatDateTime(record.end_time);
//       }
//       if (record.date) {
//         record.date = formatDateTime(record.date);
//       }
//     } else {
//       // Handle Sequelize model instances
//       const dataValues = record.dataValues || {};
      
//       // Only format fields that exist in the dataValues
//       if ('created_at' in dataValues && dataValues.created_at) {
//         record.dataValues.created_at = formatDateTime(dataValues.created_at);
//       }
//       if ('updated_at' in dataValues && dataValues.updated_at) {
//         record.dataValues.updated_at = formatDateTime(dataValues.updated_at);
//       }
//       if ('start_time' in dataValues && dataValues.start_time) {
//         record.dataValues.start_time = formatDateTime(dataValues.start_time);
//       }
//       if ('end_time' in dataValues && dataValues.end_time) {
//         record.dataValues.end_time = formatDateTime(dataValues.end_time);
//       }
//       if ('date' in dataValues && dataValues.date) {
//         record.dataValues.date = formatDateTime(dataValues.date);
//       }
//     }
//   };

//   if (Array.isArray(result)) {
//     result.forEach(formatRecordDates);
//   } else if (result) {
//     formatRecordDates(result);
//   }
// });


// After defining your model
// addDateFormatterHook(ProductionSchedule, ['created_at', 'updated_at', 'start_time', 'end_time']);






export default ProductionSchedule;
