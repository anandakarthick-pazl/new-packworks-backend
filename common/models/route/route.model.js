import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import User from "../user.model.js";
import Company from "../company.model.js";
import { formatDateTime } from '../../utils/dateFormatHelper.js';


const Route = sequelize.define(
  "Route",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    route_generate_id:{
      type: DataTypes.STRING(200),
      allowNull: true,
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
    route_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    route_process: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      get() {
        return formatDateTime(this.getDataValue('created_at'));
      }
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      get() {
        return formatDateTime(this.getDataValue('updated_at'));
      }
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
    tableName: "route",
    timestamps: false,
    underscored: true,
  }
);

// Associations
Company.hasMany(Route, { foreignKey: "company_id" });
Route.belongsTo(Company, { foreignKey: "company_id" });

User.hasMany(Route, { foreignKey: "created_by" });
User.hasMany(Route, { foreignKey: "updated_by" });
Route.belongsTo(User, {
  foreignKey: "created_by",
  as: "route_creator",
});
Route.belongsTo(User, {
  foreignKey: "updated_by",
  as: "route_updater",
});

export default Route;
