'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        CREATE TABLE production_schedule (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        production_schedule_generate_id VARCHAR(200),
        company_id INT UNSIGNED NOT NULL,
        employee_id INT NOT NULL,
        machine_id INT NOT NULL,
        group_id INT NOT NULL,
        task_name VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        status ENUM('Scheduled', 'In Progress', 'Completed') DEFAULT 'Scheduled',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT UNSIGNED,
        updated_by INT UNSIGNED,
        CONSTRAINT fk_schedule_company FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT fk_schedule_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        CONSTRAINT fk_schedule_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};