"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("company_addresses", "id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      // DO NOT reassign autoIncrement or primaryKey if already set
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("company_addresses", "id", {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: false,
    });
  },
};
