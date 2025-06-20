'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        CREATE TABLE \`debit_notes\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`debit_note_number\` VARCHAR(200) NOT NULL UNIQUE,
        \`debit_note_generate_id\` VARCHAR(200),
        \`po_return_id\` INT UNSIGNED NOT NULL,
        \`company_id\` INT UNSIGNED NOT NULL,
        \`reference_id\` VARCHAR(100),
        \`rate\` DECIMAL(10,2),
        \`amount\` DECIMAL(15,2),
        \`sub_total\` DECIMAL(15,2),
        \`adjustment\` DECIMAL(15,2),
        \`supplier_id\` INT NOT NULL,
        \`tax_amount\` DECIMAL(15,2),
        \`total_amount\` DECIMAL(15,2),
        \`reason\` TEXT,
        \`remark\` TEXT,
        \`debit_note_date\` DATE NOT NULL,
        \`status\` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        \`created_by\` INT UNSIGNED,
        \`updated_by\` INT UNSIGNED,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT NULL,
        \`deleted_at\` DATETIME DEFAULT NULL,

        -- Foreign key constraints
        CONSTRAINT \`fk_debit_notes_po_return\` FOREIGN KEY (\`po_return_id\`) REFERENCES \`purchase_order_returns\`(\`id\`) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT \`fk_debit_notes_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON UPDATE CASCADE,
        CONSTRAINT \`fk_debit_notes_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`),
        CONSTRAINT \`fk_debit_notes_updated_by\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};