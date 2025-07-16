import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import Client from "../client.model.js";
import User from "../user.model.js";
import DropdownName from "./dropdown.model.js";
import CompanyAddress from "../companyAddress.model.js";

const DropdownValue = sequelize.define(
  "DropdownValue",
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
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: Client,
        key: "client_id",
      },
    },
    dropdown_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: DropdownName,
        key: "id",
      },
    },
    dropdown_value: {
      type: DataTypes.STRING(200),
      allowNull: false,
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
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
  },
  {
    tableName: "dropdown_values",
    timestamps: false,
  }
);

DropdownValue.belongsTo(Company, { foreignKey: "company_id" });
DropdownValue.belongsTo(CompanyAddress, { foreignKey: "company_branch_id" });
DropdownValue.belongsTo(Client, { foreignKey: "client_id" });
DropdownValue.belongsTo(User, { foreignKey: "created_by" });
DropdownValue.belongsTo(User, { foreignKey: "updated_by" });

DropdownName.hasMany(DropdownValue, { foreignKey: "dropdown_id" });
DropdownValue.belongsTo(DropdownName, { 
  foreignKey: "dropdown_id",
  as: "dropdownName",
});

export default DropdownValue;
