import { DataTypes, Sequelize } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import User from "../user.model.js";

const Sku = sequelize.define(
  "SKU",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: Company,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: Client,
        key: "client_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    sku_ui_id: { type: DataTypes.STRING, allowNull: true },
    sku_name: { type: DataTypes.STRING, allowNull: false },
    client: { type: DataTypes.STRING, allowNull: false },
    ply: { type: DataTypes.INTEGER, allowNull: true },
    length: { type: DataTypes.FLOAT, allowNull: true },
    width: { type: DataTypes.FLOAT, allowNull: true },
    height: { type: DataTypes.FLOAT, allowNull: true },
    lwh: { type: DataTypes.STRING, allowNull: true },
    unit: { type: DataTypes.STRING, allowNull: true },
    joints: { type: DataTypes.INTEGER, allowNull: true },
    ups: { type: DataTypes.INTEGER, allowNull: true },
    select_dies: { type: DataTypes.STRING, allowNull: true },
    inner_outer_dimension: {
      type: DataTypes.ENUM("Inner", "Outer"),
      allowNull: true,
    },
    flap_width: { type: DataTypes.FLOAT, allowNull: true },
    flap_tolerance: { type: DataTypes.FLOAT, allowNull: true },
    length_trimming_tolerance: { type: DataTypes.FLOAT, allowNull: true },
    width_trimming_tolerance: { type: DataTypes.FLOAT, allowNull: true },
    strict_adherence: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    customer_reference: { type: DataTypes.STRING, allowNull: true },
    reference_number: { type: DataTypes.STRING, allowNull: true },
    internal_id: { type: DataTypes.STRING, allowNull: true },
    length_board_size_cm2: { type: DataTypes.STRING, allowNull: true },
    width_board_size_cm2: { type: DataTypes.STRING, allowNull: true },
    board_size_cm2: { type: DataTypes.STRING, allowNull: true },
    deckle_size: { type: DataTypes.FLOAT, allowNull: true },
    minimum_order_level: { type: DataTypes.INTEGER, allowNull: true },
    gst_percentage: { type: DataTypes.INTEGER, allowNull: true },

    estimate_composite_item: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.STRING, allowNull: true },
    default_sku_details: { type: DataTypes.STRING, allowNull: true },
    tags: { type: DataTypes.JSON, allowNull: true },

    sku_type: { type: DataTypes.STRING, allowNull: true },
    sku_values: {
      type: Sequelize.JSON,
      allowNull: true,
    },

    sku_version_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    composite_type: {
      type: DataTypes.ENUM("Partition", "Panel"),
      allowNull: true,
    },
    part_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    part_value: {
      type: Sequelize.JSON,
      allowNull: true,
    },
    route: {
      type: Sequelize.JSON,
      allowNull: true,
    },
    print_type: {
      type: DataTypes.ENUM("None", "Offset", "Flexo"),
      allowNull: true,
    },
    documents: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    total_weight: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    total_bursting_strength: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
    },
  },
  {
    tableName: "sku",
    timestamps: false,
  }
);

Company.hasMany(Sku, { foreignKey: "company_id" });
Sku.belongsTo(Company, { foreignKey: "company_id" });

Client.hasMany(Sku, { foreignKey: "client_id" });
Sku.belongsTo(Client, { foreignKey: "client_id" });

Sku.belongsTo(User, { foreignKey: "created_by", as: "sku_creator" });
Sku.belongsTo(User, { foreignKey: "updated_by", as: "sku_updater" });

export default Sku;
