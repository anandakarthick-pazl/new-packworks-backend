import { DataTypes } from 'sequelize';
import  sequelize from '../database/database.js';
import Company from './company.model.js';
import UserRole from './userRole.model.js';
import Employee from './employee.model.js';
import { formatDateTime } from '../utils/dateFormatHelper.js';
// import CompanyAddress from './companyAddress.model.js';

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    company_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
            model: Company,
            key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
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
    user_auth_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
    },
    is_superadmin: {
        type: DataTypes.TINYINT(1),
        defaultValue: 0,
    },
    customised_permissions: {
        type: DataTypes.TINYINT(1),
        defaultValue: 0,
    },
    name: {
        type: DataTypes.STRING(191),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(191),
        allowNull: true,
        unique: 'email_company_unique',
    },
    image: {
        type: DataTypes.STRING(191),
        allowNull: true,
    },
    country_phonecode: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    country_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    mobile: {
        type: DataTypes.STRING(191),
        allowNull: true,
    },
    gender: {
        type: DataTypes.ENUM('male', 'female', 'others'),
        defaultValue: 'male',
    },
    salutation: {
        type: DataTypes.ENUM('mr', 'mrs', 'miss', 'dr', 'sir', 'madam'),
        allowNull: true,
    },
    locale: {
        type: DataTypes.STRING(191),
        defaultValue: 'en',
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
    },
    login: {
        type: DataTypes.ENUM('enable', 'disable'),
        defaultValue: 'enable',
    },
    last_login: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    email_notifications: {
        type: DataTypes.TINYINT(1),
        defaultValue: 1,
    },
    dark_theme: {
        type: DataTypes.TINYINT(1),
        allowNull: true,
    },
    rtl: {
        type: DataTypes.TINYINT(1),
        allowNull: true,
    },
    admin_approval: {
        type: DataTypes.TINYINT(1),
        defaultValue: 1,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        get() {
            return formatDateTime(this.getDataValue('created_at'));
        }
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        get() {
            return formatDateTime(this.getDataValue('updated_at'));
        }
    }
}, {
    tableName: 'users',
    timestamps: false,
});

Company.hasMany(User, {
    foreignKey: 'company_id',
    as: 'users',
}); 

User.belongsTo(Company, {
    foreignKey: 'company_id'
});
// User.belongsTo(CompanyAddress, {
//   foreignKey: "company_branch_id",
// });




export default User;
