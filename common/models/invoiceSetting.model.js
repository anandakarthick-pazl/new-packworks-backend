import { DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";

const InvoiceSetting = sequelize.define(
  "SKU",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: Company,
        key: "id",
      },
      onUpdate: "CASCADE",
    },
    invoice_prefix: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    invoice_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "#",
    },
    invoice_digit: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 3,
    },
    estimate_prefix: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "EST",
    },
    estimate_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "#",
    },
    estimate_digit: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 3,
    },
    credit_note_prefix: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "CN",
    },
    credit_note_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "#",
    },
    credit_note_digit: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 3,
    },
    contract_prefix: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "CONT",
    },
    contract_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "#",
    },
    contract_digit: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 3,
    },
    estimate_request_prefix: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "ESTRQ",
    },
    estimate_request_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "#",
    },
    estimate_request_digit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    order_prefix: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "ODR",
    },
    order_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "#",
    },
    order_digit: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 3,
    },
    proposal_prefix: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "Proposal",
    },
    proposal_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "#",
    },
    proposal_digit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    template: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    due_after: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    invoice_terms: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    other_info: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    estimate_terms: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    gst_number: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    show_gst: {
      type: DataTypes.ENUM("yes", "no"),
      allowNull: true,
      defaultValue: "no",
    },
    logo: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    hsn_sac_code_show: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    locale: {
      type: DataTypes.STRING(191),
      allowNull: true,
      defaultValue: "en",
    },
    send_reminder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    reminder: {
      type: DataTypes.ENUM("after", "every"),
      allowNull: true,
    },
    send_reminder_after: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    tax_calculation_msg: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    show_status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 1,
    },
    authorised_signatory: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    authorised_signatory_signature: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    show_project: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    show_client_name: {
      type: DataTypes.ENUM("yes", "no"),
      allowNull: true,
      defaultValue: "no",
    },
    show_client_email: {
      type: DataTypes.ENUM("yes", "no"),
      allowNull: true,
      defaultValue: "no",
    },
    show_client_phone: {
      type: DataTypes.ENUM("yes", "no"),
      allowNull: true,
      defaultValue: "no",
    },
    show_client_company_address: {
      type: DataTypes.ENUM("yes", "no"),
      allowNull: true,
      defaultValue: "no",
    },
    show_client_company_name: {
      type: DataTypes.ENUM("yes", "no"),
      allowNull: true,
      defaultValue: "no",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    client_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    client_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    client_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    vendor_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    vendor_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    vendor_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sku_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    sku_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    sku_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sale_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    sale_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    sale_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    work_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    work_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    work_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    machine_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    machine_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    machine_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    employee_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    employee_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    employee_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    process_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    process_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    process_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    route_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    route_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    route_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    item_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    item_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    item_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    purchase_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    purchase_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    purchase_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    grn_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    grn_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    grn_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    inventory_prefix: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    inventory_number_separator: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    inventory_digit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "invoice_settings",
    timestamps: false,
  }
);

// Define the relationship
Company.hasOne(InvoiceSetting, { foreignKey: "company_id" });
InvoiceSetting.belongsTo(Company, { foreignKey: "company_id" });

export default InvoiceSetting;
