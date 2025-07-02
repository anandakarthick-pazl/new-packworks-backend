import Company from "./company.model.js";
import GlobalInvoices from "./globalInvoice.model.js";
import PurchaseOrderReturn from "./purchase_order_return/purchase_order_return.model.js";
import PurchaseOrderReturnItem from "./purchase_order_return/purchase_order_return_item.model.js";
import DataTransfer from "./dataTransfer.model.js";
import User from "./user.model.js";

// ✅ Define associations here
Company.hasMany(GlobalInvoices, { foreignKey: "company_id", as: "invoices" });
GlobalInvoices.belongsTo(Company, { foreignKey: "company_id", as: "company" });

PurchaseOrderReturn.hasMany(PurchaseOrderReturnItem, {
    foreignKey: "po_return_id",
    as: "items"
  });
  
  PurchaseOrderReturnItem.belongsTo(PurchaseOrderReturn, {
    foreignKey: "po_return_id",
    as: "purchaseOrderReturn"
  });

// DataTransfer associations
DataTransfer.belongsTo(Company, { foreignKey: "company_id", as: "company" });
DataTransfer.belongsTo(User, { foreignKey: "user_id", as: "user" });
DataTransfer.belongsTo(User, { foreignKey: "created_by", as: "creator" });
DataTransfer.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

Company.hasMany(DataTransfer, { foreignKey: "company_id", as: "dataTransfers" });
User.hasMany(DataTransfer, { foreignKey: "user_id", as: "dataTransfers" });
User.hasMany(DataTransfer, { foreignKey: "created_by", as: "createdDataTransfers" });
User.hasMany(DataTransfer, { foreignKey: "updated_by", as: "updatedDataTransfers" });


export default { Company, GlobalInvoices, DataTransfer, User };
