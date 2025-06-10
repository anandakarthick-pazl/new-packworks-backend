'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('production_group', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      company_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false
      },
      group_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      group_value: {
        type: Sequelize.JSON,
        allowNull: true
      },
      group_Qty: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        defaultValue: 'active'
      },
      created_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },
      updated_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('production_group');
  }
};
