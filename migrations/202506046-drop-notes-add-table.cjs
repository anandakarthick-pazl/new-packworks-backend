'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('credit_notes', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
      },
      company_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      client_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      client_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      work_order_invoice_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      work_order_invoice_number: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      credit_generate_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      credit_reference_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      subject: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      invoice_total_amout: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      credit_total_amount: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        defaultValue: 'active',
      },
      created_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },
      updated_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
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
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('credit_notes');
  }
};
