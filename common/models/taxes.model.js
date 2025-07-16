import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";
import User from "./user.model.js";
import CompanyAddress from "./companyAddress.model.js";


const Taxes = sequelize.define("taxes", {
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
      tax_name: {
        type: DataTypes.STRING(191),
        allowNull: false
      },
      rate_percent: {
        type: DataTypes.STRING(191),
        allowNull: false
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
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      }
    }, {
      tableName: "taxes",
      timestamps: false,
    }
);
  
Taxes.belongsTo(Company, { foreignKey: "company_id" });
Taxes.belongsTo(User, { foreignKey: "created_by", as: "creator" });
Taxes.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
Taxes.belongsTo(CompanyAddress, {
  foreignKey: "company_branch_id",
});

export default Taxes;
  
  