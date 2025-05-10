import Company from "./company.model.js";
import GlobalInvoices from "./globalInvoice.model.js";
import PurchaseOrderReturn from "./po_return/purchase_order_return.model.js";
import PurchaseOrderReturnItem from "./po_return/purchase_order_return_item.model.js";

// ✅ Define associations here
Company.hasMany(GlobalInvoices, { foreignKey: "company_id", as: "invoices" });
GlobalInvoices.belongsTo(Company, { foreignKey: "company_id", as: "company" });

PurchaseOrderReturn.hasMany(PurchaseOrderReturnItem, {
    foreignKey: "por_id",
    as: "items"
  });
  
  PurchaseOrderReturnItem.belongsTo(PurchaseOrderReturn, {
    foreignKey: "por_id",
    as: "purchaseOrderReturn"
  });


export default { Company, GlobalInvoices };
