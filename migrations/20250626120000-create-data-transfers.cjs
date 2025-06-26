'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('data_transfers', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      company_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'companies',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      module_name: {
        type: Sequelize.ENUM(
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
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: "Original name of the uploaded file"
      },
      file_path: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: "Storage path of the uploaded Excel file"
      },
      file_size: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "Size of the uploaded file in bytes"
      },
      status: {
        type: Sequelize.ENUM('uploaded', 'pending', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'uploaded',
        comment: "Current status of the data transfer process"
      },
      total_records: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        defaultValue: 0,
        comment: "Total number of records in the Excel file"
      },
      processed_records: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        defaultValue: 0,
        comment: "Number of records successfully processed"
      },
      failed_records: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        defaultValue: 0,
        comment: "Number of records that failed to process"
      },
      error_log: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Error details in case of processing failures"
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Timestamp when processing started"
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Timestamp when processing completed"
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: "Email address to send completion notification"
      },
      email_sent: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Whether completion email has been sent"
      },
      column_mapping: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "JSON mapping of Excel columns to database fields"
      },
      created_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      updated_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for better performance
    await queryInterface.addIndex('data_transfers', ['company_id'], {
      name: 'idx_data_transfers_company_id'
    });

    await queryInterface.addIndex('data_transfers', ['module_name'], {
      name: 'idx_data_transfers_module_name'
    });

    await queryInterface.addIndex('data_transfers', ['status'], {
      name: 'idx_data_transfers_status'
    });

    await queryInterface.addIndex('data_transfers', ['created_at'], {
      name: 'idx_data_transfers_created_at'
    });

    await queryInterface.addIndex('data_transfers', ['user_id'], {
      name: 'idx_data_transfers_user_id'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('data_transfers');
  }
};
