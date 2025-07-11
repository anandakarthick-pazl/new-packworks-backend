"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("companies", "version", {
      type: Sequelize.ENUM("trial", "paid"),
      defaultValue: "trial",
      allowNull: false,
      after: "package_type", 
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("companies", "version");
  },
};
