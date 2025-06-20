'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE TABLE demo_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_name VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  role ENUM(
    'Business Owner',
    'Operations Manager',
    'Sales Manager',
    'IT Manager',
    'Other'
  ) NOT NULL,
  preferred_demo_time ENUM(
    'Morning (9 AM - 12 PM)',
    'Afternoon (12 PM - 5 PM)',
    'Evening (5 PM - 8 PM)'
  ) NOT NULL,
  needs_description TEXT,
  status ENUM('pending', 'contacted', 'scheduled', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  demo_scheduled_at DATETIME DEFAULT NULL,
  notes TEXT,
  contacted_by INT UNSIGNED DEFAULT NULL,
  contacted_at DATETIME DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT,
  source VARCHAR(100) DEFAULT 'website_form',
  company_id INT UNSIGNED DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_email (email),
  KEY idx_status (status),
  KEY idx_created_at (created_at),
  KEY idx_company_name (company_name),
  CONSTRAINT fk_demo_requests_company_id FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_demo_requests_contacted_by FOREIGN KEY (contacted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};