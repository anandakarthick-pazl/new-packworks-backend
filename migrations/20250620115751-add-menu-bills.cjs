'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Insert module
    await queryInterface.sequelize.query(`
      INSERT INTO modules (module_group, module_name, description, is_superadmin, order_by, created_at, updated_at, status, created_by, updated_by)
      VALUES
      ('Order Management', 'Bills', 'Bills', 0, 1, NOW(), NOW(), 'active', NULL, NULL)
    `);

    // Step 2: Fetch module ID
    const [modules] = await queryInterface.sequelize.query(`
      SELECT id FROM modules
      WHERE module_name = 'Bills'
      LIMIT 1
    `);

    const billsModuleId = modules[0]?.id;
    if (!billsModuleId) throw new Error("Module 'Bills' not found");

    // Step 3: Insert permission
    await queryInterface.sequelize.query(`
      INSERT INTO permissions (name, display_name, module_id, is_custom, allowed_permissions, created_at, updated_at, status, order_by)
      VALUES 
      ('add_bills', 'Add Bills', ${billsModuleId}, 1, '{"all":4, "none":5}', NOW(), NOW(), 'active', 1)
    `);

    // Step 4: Fetch permission ID
    const [permissions] = await queryInterface.sequelize.query(`
      SELECT id FROM permissions
      WHERE name = 'add_bills'
      LIMIT 1
    `);

    const addBillsPermissionId = permissions[0]?.id;
    if (!addBillsPermissionId) throw new Error("Permission 'add_bills' not found");

    // Step 5: Insert into permission_role
    await queryInterface.sequelize.query(`
      INSERT INTO permission_role (permission_id, role_id, permission_type_id, status)
      VALUES 
      (${addBillsPermissionId}, 4, 4, 'active')
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DELETE FROM permission_role
      WHERE permission_id IN (
        SELECT id FROM permissions WHERE name = 'add_bills'
      )
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM permissions WHERE name = 'add_bills'
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM modules WHERE module_name = 'Bills'
    `);
  }
};
