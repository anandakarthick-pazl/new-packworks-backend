import Company from "./company.model.js";
import GlobalInvoices from "./globalInvoice.model.js";

// ✅ Define associations here
Company.hasMany(GlobalInvoices, { foreignKey: "company_id", as: "invoices" });
GlobalInvoices.belongsTo(Company, { foreignKey: "company_id", as: "company" });


export default { Company, GlobalInvoices };
