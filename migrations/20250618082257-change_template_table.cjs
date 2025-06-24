'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      RENAME TABLE purchaseordertemplate TO pdf_templates;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE pdf_templates
      DROP COLUMN po_template_id;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE pdf_templates
      ADD COLUMN template TEXT AFTER company_id;
    `);

    await queryInterface.sequelize.query(`
      UPDATE pdf_templates SET template = 'purchase_order' WHERE id = 1;
    `);

    await queryInterface.sequelize.query(`
      UPDATE pdf_templates SET template = 'purchase_order' WHERE id = 2;
    `);

    await queryInterface.sequelize.query(`
      UPDATE pdf_templates SET template = 'purchase_order' WHERE id = 3;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};