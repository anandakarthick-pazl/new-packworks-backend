'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // sales_returns
    await queryInterface.createTable('sales_returns', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      sales_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      return_generate_id: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      return_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      // status: {
      //   type: Sequelize.ENUM('pending', 'approved', 'rejected'),
      //   defaultValue: 'approved'
      // },
      // decision: {
      //   type: Sequelize.ENUM('approve', 'disapprove'),
      //   defaultValue: 'approve'
      // },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      total_qty: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      cgst_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      sgst_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      igst_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      tax_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      client_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // sales_return_items
    await queryInterface.createTable('sales_return_items', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      sales_return_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sales_returns',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      sales_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      item_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      return_qty: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      unit_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      cgst: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      cgst_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      sgst: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      sgst_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      igst: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      igst_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      tax_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sales_return_items');
    await queryInterface.dropTable('sales_returns');
  }
};
