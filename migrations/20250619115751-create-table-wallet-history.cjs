'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Insert modules
    await queryInterface.sequelize.query(`
     CREATE TABLE wallet_history (
  id int(11) NOT NULL,
  type enum('debit','credit') NOT NULL DEFAULT 'debit',
  client_id int(11) NOT NULL,
  company_id int(11) NOT NULL,
  refference_number varchar(255) NOT NULL,
  created_by int(11) NOT NULL,
  updated_by int(11) DEFAULT NULL,
  created_at datetime NOT NULL,
  updated_at datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);


    // Step 3: Insert permissions using dynamic module IDs
    await queryInterface.sequelize.query(`
      ALTER TABLE wallet_history
  ADD PRIMARY KEY (id);

    `);


    // Step 5: Insert permission_role using dynamic permission IDs
    await queryInterface.sequelize.query(`
      ALTER TABLE wallet_history
  MODIFY id int(11) NOT NULL AUTO_INCREMENT;
    `);


    await queryInterface.sequelize.query(`
      ALTER TABLE clients CHANGE credit_balance credit_balance DECIMAL(10,2) NULL DEFAULT NULL, CHANGE debit_balance debit_balance DECIMAL(10,2) NULL DEFAULT NULL;
    `);

    await queryInterface.sequelize.query(`
    ALTER TABLE wallet_history ADD amount DECIMAL(10,2) NULL DEFAULT NULL AFTER company_id;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Optional: add delete queries to rollback
  }
};
