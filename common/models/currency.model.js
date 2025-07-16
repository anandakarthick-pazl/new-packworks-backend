import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";
import CompanyAddress from "./companyAddress.model.js";

const Currency = sequelize.define(
  "Currency",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id : {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    company_branch_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: CompanyAddress,
            key: "id",
          },
          onUpdate: "CASCADE",
    },
    currency_name: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    currency_symbol: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    currency_code: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    exchange_rate: {
        type: DataTypes.STRING(191),
        allowNull: true,
        defaultValue: "1",
    },
    is_cryptocurrency: {
        type: DataTypes.ENUM('yes', 'no'),
        allowNull: false,
        defaultValue: 'no', 
    },
    usd_price: {
        type: DataTypes.STRING(191),
        allowNull: true,
        defaultValue: "1",
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    },
    no_of_decimal: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: "2",
    },
    thousand_separator: {
        type: DataTypes.STRING(191),
        allowNull: true,
    },
    decimal_separator: {
        type: DataTypes.STRING(191),
        allowNull: true,
    },
    currency_position: {
        type: DataTypes.ENUM('left','right','left_with_space','right_with_space'),
        allowNull: false,
        defaultValue: 'left', 
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
    },
    created_by: {
        type: DataTypes.INTEGER(11),
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.INTEGER(11),
        allowNull: true,
      },

  },
  {
    tableName: "currencies",
    timestamps: false, 
  }
);
Currency.belongsTo(CompanyAddress, {
  foreignKey: "company_id",
  as: "company",
});
export default Currency;