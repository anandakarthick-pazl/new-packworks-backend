'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE TABLE notifications (
  id int(11) NOT NULL AUTO_INCREMENT,
  company_id int(11) NOT NULL,
  item_id int(11) NOT NULL,
  notification_type enum('low_stock','out_of_stock','reorder') DEFAULT 'low_stock',
  message text NOT NULL,
  current_quantity decimal(10,2) DEFAULT 0.00,
  min_stock_level decimal(10,2) DEFAULT 0.00,
  status enum('active','resolved','dismissed') DEFAULT 'active',
  email_sent tinyint(1) DEFAULT 0,
  email_sent_at timestamp NULL DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY item_id (item_id),
  KEY status (status),
  KEY notification_type (notification_type)
);

    `);
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left empty — no rollback
  }
};
