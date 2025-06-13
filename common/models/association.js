import Company from "./company.model.js";
import GlobalInvoices from "./globalInvoice.model.js";
import PurchaseOrderReturn from "./purchase_order_return/purchase_order_return.model.js";
import PurchaseOrderReturnItem from "./purchase_order_return/purchase_order_return_item.model.js";

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


export default { Company, GlobalInvoices };
