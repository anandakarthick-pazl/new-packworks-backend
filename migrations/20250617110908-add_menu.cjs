'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      INSERT INTO modules (id, module_group, module_name, description, is_superadmin, order_by, created_at, updated_at, status, created_by, updated_by) VALUES
      (38, 'Order Management', 'Invoice', 'Invoice', 0, 1, '2025-02-25 05:37:39', '2025-02-25 05:38:52', 'active', NULL, NULL),
      (39, 'Order Management', 'CreditNote', 'Credit Note', 0, 1, '2025-02-25 05:37:39', '2025-02-25 05:38:52', 'active', NULL, NULL),
      (40, 'Order Management', 'DebitNote', 'Debit Note', 0, 1, '2025-02-25 05:37:39', '2025-02-25 05:38:52', 'active', NULL, NULL)
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO permissions (name, display_name, module_id, is_custom, allowed_permissions, created_at, updated_at, status, order_by)
      VALUES 
      ('add_invoice', 'Add Invoice', '38', '1', '{"all":4, "none":5}', '2025-02-25 11:07:41', '2025-02-25 11:07:41', 'active', '1'),
      ('add_credit_note', 'Add credit Note', '39', '1', '{"all":4, "none":5}', '2025-02-25 11:07:41', '2025-02-25 11:07:41', 'active', '1'),
      ('add_debit_note', 'Add debit Note', '40', '1', '{"all":4, "none":5}', '2025-02-25 11:07:41', '2025-02-25 11:07:41', 'active', '1')
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO permission_role (permission_id, role_id, permission_type_id, status)
      VALUES 
      (345, 4, 4, 'active'),
      (345, 5, 4, 'active'),
      (345, 6, 4, 'active'),
      (346, 4, 4, 'active'),
      (346, 5, 4, 'active'),
      (346, 6, 4, 'active'),
      (347, 4, 4, 'active'),
      (347, 5, 4, 'active'),
      (347, 6, 4, 'active')
    `);
  },

  async down(queryInterface, Sequelize) {
    // Optional: Add delete queries to rollback changes
  }
};
