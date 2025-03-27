import { DataTypes } from "sequelize";
import sequelize from "../database/database.js";

const GlobalSettings = sequelize.define(
  "GlobalSettings",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    global_app_name: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    logo: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    light_logo: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    login_background: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    logo_background_color: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    header_color: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "#1D82F5",
    },
    sidebar_logo_style: {
      type: DataTypes.STRING(191),
      allowNull: true,
      defaultValue: "square",
    },
    locale: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "en",
    },
    hash: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    purchase_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    supported_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    purchased_on: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_license_verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    google_recaptcha_status: {
      type: DataTypes.ENUM("active", "deactive"),
      allowNull: false,
      defaultValue: "deactive",
    },
    google_recaptcha_v2_status: {
      type: DataTypes.ENUM("active", "deactive"),
      allowNull: false,
      defaultValue: "deactive",
    },
    google_recaptcha_v2_site_key: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    google_recaptcha_v2_secret_key: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    google_recaptcha_v3_status: {
      type: DataTypes.ENUM("active", "deactive"),
      allowNull: false,
      defaultValue: "deactive",
    },
    google_recaptcha_v3_site_key: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    google_recaptcha_v3_secret_key: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    app_debug: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
    },
    currency_converter_key: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    currency_key_version: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "free",
    },
    moment_format: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "DD-MM-YYYY",
    },
    timezone: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: "Asia/Kolkata",
    },
    rtl: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
    },
    license_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    hide_cron_message: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
    },
    system_update: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1,
    },
    show_review_modal: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1,
    },
    last_cron_run: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    favicon: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    auth_theme: {
      type: DataTypes.ENUM("dark", "light"),
      allowNull: false,
      defaultValue: "light",
    },
    auth_theme_text: {
      type: DataTypes.ENUM("dark", "light"),
      allowNull: false,
      defaultValue: "dark",
    },
    session_driver: {
      type: DataTypes.ENUM("file", "database"),
      allowNull: false,
      defaultValue: "file",
    },
    allowed_file_types: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    allowed_file_size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
    },
    allow_max_no_of_files: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
    },
    datatable_row_limit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
    },
    show_update_popup: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1,
    },
    sign_up_terms: {
      type: DataTypes.ENUM("yes", "no"),
      allowNull: false,
      defaultValue: "no",
    },
    terms_link: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    google_calendar_status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "inactive",
    },
    google_client_id: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    google_client_secret: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    google_calendar_verification_status: {
      type: DataTypes.ENUM("verified", "non_verified"),
      allowNull: false,
      defaultValue: "non_verified",
    },
    google_id: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    company_email: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    company_phone: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    currency_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    date_format: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "d-m-Y",
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
      defaultValue: 26.91243360,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false,
      defaultValue: 75.78727090,
    },
    active_theme: {
      type: DataTypes.ENUM("default", "custom"),
      allowNull: false,
      defaultValue: "default",
    },
    last_updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "global_settings",
    timestamps: false,
  }
);

export default GlobalSettings;
