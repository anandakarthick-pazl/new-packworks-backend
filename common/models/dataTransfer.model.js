import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";

const DataTransfer = sequelize.define(
  "DataTransfer",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    module_name: {
      type: DataTypes.ENUM(
        'employee',
        'sale_order',
        'work_order',
        'machine',
        'route',
        'client',
        'item',
        'purchase_order',
        'inventory',
        'sku',
        'category',
        'package'
      ),
      allowNull: false,
      comment: "Module for which data transfer is being performed"
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Original name of the uploaded file"
    },
    file_path: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Storage path of the uploaded Excel file"
    },
    file_size: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: "Size of the uploaded file in bytes"
    },
    status: {
      type: DataTypes.ENUM('uploaded', 'pending', 'processing', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'uploaded',
      comment: "Current status of the data transfer process"
    },
    total_records: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: 0,
      comment: "Total number of records in the Excel file"
    },
    processed_records: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: 0,
      comment: "Number of records successfully processed"
    },
    failed_records: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: 0,
      comment: "Number of records that failed to process"
    },
    error_log: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Error details in case of processing failures"
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Timestamp when processing started"
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Timestamp when processing completed"
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Email address to send completion notification"
    },
    email_sent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether completion email has been sent"
    },
    column_mapping: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "JSON mapping of Excel columns to database fields"
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
  },
  {
    tableName: "data_transfers",
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['company_id']
      },
      {
        fields: ['module_name']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      }
    ]
  }
);

export default DataTransfer;
