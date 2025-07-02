"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      "production_group",
      "production_group_generate_id",
      {
        type: Sequelize.STRING(200),
        allowNull: true,
        after: "id",
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn(
      "production_group",
      "production_group_generate_id"
    );
  },
};
