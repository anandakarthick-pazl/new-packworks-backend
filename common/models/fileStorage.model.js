import { DataTypes } from "sequelize";
import sequelize from "../database/database.js";
import Company from "./company.model.js";
import CompanyAddress from "./companyAddress.model.js";

const FileStorage = sequelize.define(
  "FileStorage",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    // company_branch_id: {
    //       type: DataTypes.INTEGER.UNSIGNED,
    //       allowNull: true,
    //       references: {
    //         model: CompanyAddress,
    //         key: "id",
    //       },
    //       onUpdate: "CASCADE",
    // },
    path: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    filename: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    size: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    storage_location: {
      type: DataTypes.ENUM("local", "aws_s3"),
      allowNull: false,
      defaultValue: "local",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "file_storage",
    timestamps: false,
  }
);

FileStorage.belongsTo(Company, {
    foreignKey: 'company_id'
});
// FileStorage.belongsTo(CompanyAddress, {
//   foreignKey: "company_branch_id",
// });

export default FileStorage;
