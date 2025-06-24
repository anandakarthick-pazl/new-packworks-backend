'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('work_order_invoice', 'received_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
    });

    await queryInterface.addColumn('work_order_invoice', 'credit_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
    });

    await queryInterface.addColumn('work_order_invoice', 'rate_per_qty', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
    });

    await queryInterface.addColumn('work_order_invoice', 'invoice_pdf', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('work_order_invoice', 'invoice_pdf');
    await queryInterface.removeColumn('work_order_invoice', 'rate_per_qty');
    await queryInterface.removeColumn('work_order_invoice', 'credit_amount');
    await queryInterface.removeColumn('work_order_invoice', 'received_amount');
  },
};
