'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Insert module
    await queryInterface.sequelize.query(`
      INSERT INTO modules 
        (module_group, module_name, description, is_superadmin, order_by, created_at, updated_at, status, created_by, updated_by)
      VALUES
        ('Order Management', 'production_planning', 'Production Planning', 0, 1, '2025-02-25 05:37:39', '2025-02-25 05:38:52', 'active', NULL, NULL)
    `);
    const [result] = await queryInterface.sequelize.query(`
      SELECT id FROM modules WHERE module_name = 'production_planning'
    `);
    const moduleId = result[0]?.id;

    // Insert permission with unique name
    await queryInterface.sequelize.query(`
      INSERT INTO permissions 
        (name, display_name, module_id, is_custom, allowed_permissions, created_at, updated_at, status, order_by)
      VALUES 
        ('add_production_planning', 'Add Production Planning', ${moduleId}, 1, '{"all":4, "none":5}', '2025-02-25 11:07:41', '2025-02-25 11:07:41', 'active', 1)
    `);

    // Get the inserted permission's ID
    const [results] = await queryInterface.sequelize.query(`
      SELECT id FROM permissions WHERE name = 'add_production_planning' AND module_id = ${moduleId}
    `);
    const permissionId = results[0]?.id;

    // Insert roles only if permission exists
    if (permissionId) {
      await queryInterface.sequelize.query(`
        INSERT INTO permission_role (permission_id, role_id, permission_type_id, status)
        VALUES 
          (${permissionId}, 4, 4, 'active'),
          (${permissionId}, 5, 4, 'active'),
          (${permissionId}, 6, 4, 'active')
      `);
    }
  },

  async down(queryInterface, Sequelize) {
    // Optional: rollback logic
  }
};
