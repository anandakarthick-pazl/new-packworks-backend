import { DataTypes } from "sequelize";
import sequelize from "../database/database.js";

const FileStorageSetting = sequelize.define(
  "FileStorageSetting",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    filesystem: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    auth_keys: {
      type: DataTypes.TEXT, // Stores encoded AWS credentials
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("enabled", "disabled"),
      allowNull: false,
      defaultValue: "disabled",
    },
  },
  {
    tableName: "file_storage_settings",
    timestamps: false,
  }
);

export default FileStorageSetting;
