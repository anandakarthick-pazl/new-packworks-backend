"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("company_payment_bill", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      invoice_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      company: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      package: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      next_payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      transaction_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      payment_gateway: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      payment_status:{
        type: Sequelize.ENUM("pending", "paid", "failed"),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
      created_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      updated_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("company_payment_bill");
  },
};
