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
      allowNull: true,
      references: {
        model: Company,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: Client,
        key: "client_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    sku_name: { type: DataTypes.STRING, allowNull: false },
    client: { type: DataTypes.STRING, allowNull: false },
    ply: { type: DataTypes.INTEGER, allowNull: false },
    length: { type: DataTypes.FLOAT, allowNull: false },
    width: { type: DataTypes.FLOAT, allowNull: false },
    height: { type: DataTypes.FLOAT, allowNull: false },
    joints: { type: DataTypes.INTEGER },
    ups: { type: DataTypes.INTEGER },
    inner_outer_dimension: {
      type: DataTypes.ENUM("Inner", "Outer"),
      allowNull: false,
    },
    flap_width: { type: DataTypes.FLOAT },
    flap_tolerance: { type: DataTypes.FLOAT },
    length_trimming_tolerance: { type: DataTypes.FLOAT },
    width_trimming_tolerance: { type: DataTypes.FLOAT },
    strict_adherence: { type: DataTypes.BOOLEAN, defaultValue: false },
    customer_reference: { type: DataTypes.STRING },
    reference_number: { type: DataTypes.STRING },
    internal_id: { type: DataTypes.STRING },
    board_size_cm2: { type: DataTypes.STRING },
    deckle_size: { type: DataTypes.FLOAT },
    minimum_order_level: { type: DataTypes.INTEGER },
    sku_type: { type: DataTypes.STRING },
    sku_values: {
      type: Sequelize.JSON, // or Sequelize.JSONB
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      // allowNull: false,
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

// Better naming for associations to prevent conflicts
Sku.belongsTo(User, { foreignKey: "created_by", as: "sku_creator" });
Sku.belongsTo(User, { foreignKey: "updated_by", as: "sku_updater" });

export default Sku;
