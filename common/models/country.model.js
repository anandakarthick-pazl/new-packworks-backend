import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../database/database.js";

const Country = sequelize.define(
  "Country",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    iso: {
      type: DataTypes.CHAR(2),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    nicename: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    iso3: {
      type: DataTypes.CHAR(3),
      allowNull: true,
    },
    numcode: {
      type: DataTypes.SMALLINT,
      allowNull: true,
    },
    phonecode: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "country",
    timestamps: false, // ✅ No createdAt & updatedAt
  }
);

export default Country;
