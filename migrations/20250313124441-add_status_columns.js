import { DataTypes, QueryInterface } from "sequelize";

export default {
  async up(queryInterface) {
    const tables = [
      "addresses", "api_logs", "clients", "companies", "currencies",
      "email_notification_settings", "fields", "global_currencies", "global_invoice_settings",
      "global_invoices", "global_payment_gateway_credentials", "global_settings",
      "global_subscriptions", "language_settings", "machine_process_fields",
      "machine_process_name", "machines", "module_settings", "modules",
      "package_settings", "package_update_notifies", "packages", "payment_gateway_credentials",
      "payments", "permission_role", "permission_types", "permissions",
      "process_fields", "razorpay_invoices", "razorpay_subscriptions", "role_user",
      "roles", "sales_order", "sku", "sku_type", "subscription_items",
      "subscriptions", "user_auths", "user_permissions", "users", "work_order"
    ];

    for (const table of tables) {
      const tableDesc = await queryInterface.describeTable(table);

      if (!tableDesc.status) {
        await queryInterface.addColumn(table, "status", {
          type: DataTypes.ENUM("active", "inactive"),
          allowNull: false,
          defaultValue: "active",
        });
      }
      if (!tableDesc.created_by) {
        await queryInterface.addColumn(table, "created_by", {
          type: DataTypes.INTEGER,
          allowNull: true,
        });
      }
      if (!tableDesc.updated_by) {
        await queryInterface.addColumn(table, "updated_by", {
          type: DataTypes.INTEGER,
          allowNull: true,
        });
      }
      if (!tableDesc.created_at) {
        await queryInterface.addColumn(table, "created_at", {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: DataTypes.NOW,
        });
      }
      if (!tableDesc.updated_at) {
        await queryInterface.addColumn(table, "updated_at", {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: DataTypes.NOW,
        });
      }
    }
  },

  async down(queryInterface) {
    const tables = [
      "addresses", "api_logs", "clients", "companies", "currencies",
      "email_notification_settings", "fields", "global_currencies", "global_invoice_settings",
      "global_invoices", "global_payment_gateway_credentials", "global_settings",
      "global_subscriptions", "language_settings", "machine_process_fields",
      "machine_process_name", "machines", "module_settings", "modules",
      "package_settings", "package_update_notifies", "packages", "payment_gateway_credentials",
      "payments", "permission_role", "permission_types", "permissions",
      "process_fields", "razorpay_invoices", "razorpay_subscriptions", "role_user",
      "roles", "sales_order", "sku", "sku_type", "subscription_items",
      "subscriptions", "user_auths", "user_permissions", "users", "work_order"
    ];

    for (const table of tables) {
      await queryInterface.removeColumn(table, "status");
      await queryInterface.removeColumn(table, "created_by");
      await queryInterface.removeColumn(table, "updated_by");
      await queryInterface.removeColumn(table, "created_at");
      await queryInterface.removeColumn(table, "updated_at");
    }
  },
};
