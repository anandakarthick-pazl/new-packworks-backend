import db from "../models/index.js";
const Company = db.Company;
const InvoiceSetting = db.InvoiceSetting;
const Client = db.Client;
const SalesOrder = db.SalesOrder;
const Sku = db.Sku;

export async function generateId(companyId, model, prefixKey) {
  console.log(companyId, model, prefixKey, "123");
  const company = await InvoiceSetting.findByPk(companyId);
  console.log(company, "companyss");
  const prefix = company[`${prefixKey}_prefix`];
  const separator = company[`${prefixKey}_number_separator`] || "-";
  const ticketNumberDigit = company[`${prefixKey}_digit`] || 5;
  console.log(prefix, "456");
  // Determine the primary key based on the model
  const primaryKey = model === Client ? "client_id" : "id";

  // Get latest record for that model
  const lastRecord = await model.findOne({
    where: { company_id: companyId },
    order: [[primaryKey, "DESC"]],
  });

  // Use the appropriate primary key for incrementing
  const nextNumber = lastRecord ? lastRecord[primaryKey] + 1 : 1;
  const paddedNumber = String(nextNumber).padStart(ticketNumberDigit, "0");

  console.log(prefix, separator, paddedNumber, "1234");

  return `${prefix}${separator}${paddedNumber}`;
}
