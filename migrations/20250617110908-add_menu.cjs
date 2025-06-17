'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Insert modules
    await queryInterface.sequelize.query(`
      INSERT INTO modules (module_group, module_name, description, is_superadmin, order_by, created_at, updated_at, status, created_by, updated_by)
      VALUES
      ('Order Management', 'Invoice', 'Invoice', 0, 1, '2025-02-25 05:37:39', '2025-02-25 05:38:52', 'active', NULL, NULL),
      ('Order Management', 'CreditNote', 'Credit Note', 0, 1, '2025-02-25 05:37:39', '2025-02-25 05:38:52', 'active', NULL, NULL),
      ('Order Management', 'DebitNote', 'Debit Note', 0, 1, '2025-02-25 05:37:39', '2025-02-25 05:38:52', 'active', NULL, NULL)
    `);

    // Step 2: Fetch module IDs
    const [modules] = await queryInterface.sequelize.query(`
      SELECT id, module_name FROM modules
      WHERE module_name IN ('Invoice', 'CreditNote', 'DebitNote')
    `);

    const moduleMap = {};
    modules.forEach((mod) => {
      moduleMap[mod.module_name] = mod.id;
    });

    // Step 3: Insert permissions using dynamic module IDs
    await queryInterface.sequelize.query(`
      INSERT INTO permissions (name, display_name, module_id, is_custom, allowed_permissions, created_at, updated_at, status, order_by)
      VALUES 
      ('add_invoice', 'Add Invoice', ${moduleMap['Invoice']}, 1, '{"all":4, "none":5}', NOW(), NOW(), 'active', 1),
      ('add_credit_note', 'Add Credit Note', ${moduleMap['CreditNote']}, 1, '{"all":4, "none":5}', NOW(), NOW(), 'active', 1),
      ('add_debit_note', 'Add Debit Note', ${moduleMap['DebitNote']}, 1, '{"all":4, "none":5}', NOW(), NOW(), 'active', 1)
    `);

    // Step 4: Fetch permission IDs
    const [permissions] = await queryInterface.sequelize.query(`
      SELECT id, name FROM permissions
      WHERE name IN ('add_invoice', 'add_credit_note', 'add_debit_note')
    `);

    const permissionMap = {};
    permissions.forEach((perm) => {
      permissionMap[perm.name] = perm.id;
    });

    // Step 5: Insert permission_role using dynamic permission IDs
    await queryInterface.sequelize.query(`
      INSERT INTO permission_role (permission_id, role_id, permission_type_id, status)
      VALUES 
      (${permissionMap['add_invoice']}, 4, 4, 'active'),
      (${permissionMap['add_invoice']}, 5, 4, 'active'),
      (${permissionMap['add_invoice']}, 6, 4, 'active'),

      (${permissionMap['add_credit_note']}, 4, 4, 'active'),
      (${permissionMap['add_credit_note']}, 5, 4, 'active'),
      (${permissionMap['add_credit_note']}, 6, 4, 'active'),

      (${permissionMap['add_debit_note']}, 4, 4, 'active'),
      (${permissionMap['add_debit_note']}, 5, 4, 'active'),
      (${permissionMap['add_debit_note']}, 6, 4, 'active')
    `);
  },

  async down(queryInterface, Sequelize) {
    // Optional: add delete queries to rollback
  }
};
