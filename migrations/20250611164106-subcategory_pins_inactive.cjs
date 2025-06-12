'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
     UPDATE product_sub_categories
SET status = 'inactive'
WHERE category_id = 1
  AND sub_category_name = 'pins';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};
