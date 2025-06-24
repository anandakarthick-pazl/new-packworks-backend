import { DataTypes } from "sequelize";
import sequelize from "../../database/database.js";

const SalesReturnItem = sequelize.define("SalesReturnItem", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    sales_return_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    sales_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    item_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    return_qty: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    unit_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    cgst: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    cgst_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    sgst: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    sgst_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    igst: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    igst_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    tax_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    company_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'sales_return_items',
    timestamps: false
});

export default SalesReturnItem;
