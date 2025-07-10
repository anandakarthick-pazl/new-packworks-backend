'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('invoice_settings', 'production_group_prefix', {
      type: Sequelize.STRING(191),
      allowNull: false,
    });

    await queryInterface.addColumn('invoice_settings', 'production_group_number_separator', {
      type: Sequelize.STRING(191),
      allowNull: false,
    });

    await queryInterface.addColumn('invoice_settings', 'production_group_digit', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 3,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('invoice_settings', 'production_group_digit');
    await queryInterface.removeColumn('invoice_settings', 'production_group_number_separator');
    await queryInterface.removeColumn('invoice_settings', 'production_group_prefix');
  }
};
