'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('production_group', 'allocated_qty', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'group_Qty' // optional: use this if you want to place the column after an existing one (MySQL only)
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('production_group', 'allocated_qty');
  },
};
