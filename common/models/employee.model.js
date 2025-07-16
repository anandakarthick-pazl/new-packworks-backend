import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import { formatDateTime } from '../utils/dateFormatHelper.js';

const Employee = sequelize.define(
  "Employee",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    employee_id: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    skills: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    hourly_rate: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    slack_username: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    department_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    designation_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    joining_date: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    last_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    added_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    last_updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    attendance_reminder: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    date_of_birth: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    contract_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    internship_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    employment_type: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    marital_status: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "single",
    },
    notice_period_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notice_period_start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    probation_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    user_source: {
      type: Sequelize.ENUM('web', 'mobile', 'both'),
      allowNull: false,
      defaultValue: 'both',
    },
    about_me:{
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      // get() {
      //   return formatDateTime(this.getDataValue('created_at'));
      // }
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      // get() {
      //   return formatDateTime(this.getDataValue('updated_at'));
      // }
    },
    company_address_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    overtime_hourly_rate: {
      type: DataTypes.DOUBLE(16, 2),
      allowNull: true,
      comment: "This field is only for overtime calculation",
    },
  },
  {
    tableName: "employee_details",
    timestamps: false, // ✅ Disable automatic timestamps
  }
);

Employee.addHook("afterFind", (result) => {
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

export default Employee;
