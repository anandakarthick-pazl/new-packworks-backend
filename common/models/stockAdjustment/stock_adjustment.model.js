import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";

const StockAdjustment = sequelize.define("StockAdjustment", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  reference_number: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  mode_of_adjustment: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  stock_adjustment_generate_id: {
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
   inventory_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  adjustment_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    defaultValue: DataTypes.NOW,

  },
  // reason: {
  //   type: DataTypes.TEXT,
  //   allowNull: true,
  // },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("active", "inactive"),
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
 deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },
  created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
}, {
  tableName: "stock_adjustments",
  timestamps: false,
});

StockAdjustment.belongsTo(User, { as: "creator", foreignKey: "created_by" });


export default StockAdjustment;
