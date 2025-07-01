import db from "../models/index.js";
const Company = db.Company;
const InvoiceSetting = db.InvoiceSetting;
const Client = db.Client;
const SalesOrder = db.SalesOrder;
const WorkOrder = db.WorkOrder;
const Machine = db.Machine;
const ProcessName = db.ProcessName;
const Route = db.Route;
const Sku = db.Sku;
const ItemMaster = db.ItemMaster;
const PurchaseOrder = db.PurchaseOrder;
const GRN = db.GRN;
const Inventory = db.Inventory;
const PurchaseOrderReturn = db.PurchaseOrderReturn;
const stockAdjustment = db.stockAdjustment;
const debit_note = db.DebitNote;
const Categories = db.Categories;
const Sub_categories = db.Sub_categories;
const PurchaseOrderBilling = db.PurchaseOrderBilling;
const PurchaseOrderPayment = db.PurchaseOrderPayment;
const ProductionSchedule = db.ProductionSchedule;
const ProductionGroup = db.ProductionGroup;

export async function generateId(companyId, model, prefixKey) {
  console.log(companyId, model, prefixKey, "123");

  const company = await InvoiceSetting.findByPk(companyId, {
    attributes: [
      `${prefixKey}_prefix`,
      `${prefixKey}_number_separator`,
      `${prefixKey}_digit`
    ]
  });

  if (!company) throw new Error("Company/InvoiceSetting not found");

  const prefix = company[`${prefixKey}_prefix`];
  const separator = company[`${prefixKey}_number_separator`] || "-";
  const ticketNumberDigit = company[`${prefixKey}_digit`] || 5;

  console.log(prefix, "456");

  const primaryKey = model === Client ? "client_id" : "id";

  const lastRecord = await model.findOne({
    where: { company_id: companyId },
    order: [[primaryKey, "DESC"]],
    attributes: [primaryKey]
  });

  const nextNumber = lastRecord ? lastRecord[primaryKey] + 1 : 1;
  const paddedNumber = String(nextNumber).padStart(ticketNumberDigit, "0");

  console.log(prefix, separator, paddedNumber, "1234");

  return `${prefix}${separator}${paddedNumber}`;
}

