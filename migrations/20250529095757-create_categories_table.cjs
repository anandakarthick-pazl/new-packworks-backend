'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`CREATE TABLE product_categories (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        category_generate_id VARCHAR(200),
        company_id INT UNSIGNED NOT NULL,
        category_name VARCHAR(100) NOT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        isVisible INT NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INT UNSIGNED,
        updated_by INT UNSIGNED,
        PRIMARY KEY (id),
        FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
      );
`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};


