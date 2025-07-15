'use strict';

const tables = [
  'allocation_history',
  'attendances',
  'clients',
  'color',
  'company_payment_bill',
  'contact_messages',
  'country',
  'credit_notes',
  'currencies',
  'data_transfers',
  'debit_notes',
  'demo_requests',
  'departments',
  'designations',
  'die',
  'dropdown_names',
  'dropdown_values',
  'email_notification_settings',
  'employee_details',
  'faq_categories',
  'faqs',
  'features',
  'fields',
  'file_storage',
  'file_storage_settings',
  'flutes',
  'footer_menu',
  'front_clients',
  'front_details',
  'front_faqs',
  'front_features',
  'front_menu_buttons',
  'front_widgets',
  'global_currencies',
  'global_invoice_settings',
  'global_invoices',
  'global_payment_gateway_credentials',
  'global_settings',
  'global_subscriptions',
  'grn',
  'grn_items',
  'group_history',
  'html_templates',
  'inventory',
  'invoice_settings',
  'item_master',
  'language_settings',
  'machine_flow',
  'machine_process_fields',
  'machine_process_values',
  'machine_route_process',
  'machineprocess',
  'machines',
  'module_settings',
  'modules',
  'notifications',
  'offline_request',
  'package_settings',
  'package_update_notifies',
  'packages',
  'partial_payment',
  'password_resets',
  'payment_gateway_credentials',
  'payments',
  'permission_role',
  'permission_types',
  'permissions',
  'process_name',
  'product_categories',
  'product_sub_categories',
  'production_group',
  'production_schedule',
  'purchase_order_billings',
  'purchase_order_items',
  'purchase_order_payments',
  'purchase_order_returns',
  'purchase_order_returns_items',
  'purchase_orders',
  'razorpay_invoices',
  'razorpay_subscriptions',
  'role_user',
  'roles',
  'route',
  'sales_order',
  'sales_return_items',
  'sales_returns',
  'sales_sku_details',
  'seo_details',
  'sku',
  'sku_options',
  'sku_type',
  'sku_version',
  'smtp_settings',
  'states',
  'stock_adjustment_items',
  'stock_adjustments',
  'subscription_items',
  'subscriptions',
  'taxes',
  'testimonials',
  'tr_front_details',
  'wallet_history',
  'work_order',
  'work_order_invoice',
  'work_order_status',
  'work_type',
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const table of tables) {
      try {
        await queryInterface.addColumn(table, 'company_branch_id', {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: {
            model: 'company_addresses',
            key: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        });

        // Set default value to 1 for existing records
        await queryInterface.sequelize.query(
          `UPDATE \`${table}\` SET company_branch_id = 1;`
        );
      } catch (error) {
        console.error(`❌ Failed on table ${table}:`, error.message);
        throw error; // Stop migration if any table fails
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    for (const table of tables) {
      try {
        await queryInterface.removeColumn(table, 'company_branch_id');
      } catch (error) {
        console.error(`❌ Rollback failed on table ${table}:`, error.message);
      }
    }
  },
};
