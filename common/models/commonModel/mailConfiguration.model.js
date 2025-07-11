import { Sequelize, DataTypes } from "sequelize";
import sequelize from "../../database/database.js";
import Company from "../company.model.js";
import User from "../user.model.js";

const MailConfiguration = sequelize.define("MailConfiguration", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
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
   mail_driver: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: 'smtp'
    },
    mail_host: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: 'smtp.gmail.com'
    },
    mail_port: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: '587'
    },
    mail_username: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: 'youremail@gmail.com'
    },
    mail_password: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    mail_from_name: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: 'your name'
    },
    mail_from_email: {
      type: DataTypes.STRING(191),
      allowNull: false,
      defaultValue: 'from@email.com'
    },
    mail_encryption: {
      type: DataTypes.ENUM('ssl', 'tls', 'starttls'),
      allowNull: true,
      defaultValue: 'tls'
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    mail_connection: {
      type: DataTypes.ENUM('sync', 'database'),
      allowNull: false,
      defaultValue: 'sync'
    },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: User,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
  updated_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: User,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
}, {
  tableName: "smtp_settings",
  timestamps: false,
});

MailConfiguration.belongsTo(Company, { foreignKey: "company_id" });
MailConfiguration.belongsTo(User, { foreignKey: "created_by", as: "creator" });
MailConfiguration.belongsTo(User, { foreignKey: "updated_by", as: "updater" });


export default MailConfiguration;
