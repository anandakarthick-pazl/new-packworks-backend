import sequelize from "../database/database.js";
import User from "./user.model.js";
import UserAuth from "./userAuth.model.js";
import Company from "./company.model.js";
import apiLog from "./apiLog.model.js";
import Client from "./client.model.js";
import ClientAddress from "./ClientAddress.model.js";
import SkuType from "./skuModel/skuType.model.js";
import Sku from "./skuModel/sku.model.js";
import SalesOrder from "./salesOrder/salesOrder.model.js";
import WorkOrder from "./salesOrder/workOrder.model.js";
import Machine from "./machine/machine.model.js";
import ProcessName from "./machine/processName.model.js";
import MachineProcessField from "./machine/processField.model.js";
import DropdownName from "./commonModel/dropdown.model.js";
import DropdownValue from "./commonModel/dropdownValues.model.js";
import MachineProcessValue from "./machine/processValue.model.js";
import Package from "../models/package.model.js";
import Currency from "../models/currency.model.js";
import ModuleSettings from "../models/moduleSettings.model.js";
import Flute from "../models/flute.model.js";
import Module from "../models/module.model.js";
import SkuVersion from "./skuModel/skuVersion.js";
import SalesSkuDetails from "./salesOrder/salesSku.model.js";
import Taxes from "./taxes.model.js";
import Die from "./die.model.js";
import MachineFlow from "./machine/machineFlow.model.js";
import ItemMaster from "./item.model.js";
import PurchaseOrder from "../models/po/purchase_order.model.js";
import PurchaseOrderItem from "./po/purchase_order_item.model.js";
import GRN from "./grn/grn.model.js";
import GRNItem from "./grn/grn_item.model.js";
import Inventory from "./inventory/inventory.model.js";
import InventoryType from "./inventory/inventory_type.model.js";
import Route from "./route/route.model.js";
import PurchaseOrderReturn from "./purchase_order_return/purchase_order_return.model.js";
import PurchaseOrderReturnItem from "./purchase_order_return/purchase_order_return_item.model.js";
import InvoiceSetting from "./invoiceSetting.model.js";
import SkuOptions from "./skuModel/skuOptions.model.js";
import States from "./commonModel/states.model.js";
import Color from "./commonModel/color.model.js";
import WorkOrderInvoice from "./salesOrder/workOrderInvoice.model.js";
import MachineRouteProcess from "./route/machineRouteProcess.model.js";
import stockAdjustment from "./stockAdjustment/stock_adjustment.model.js";
import stockAdjustmentItem from "./stockAdjustment/stock_adjustment_item.model.js";
import DebitNote from "./debit/debitNote.model.js";
import WorkOrderStatus from "./commonModel/workOrderStatus.js";
import CreditNote from "./credit/creditNote.model.js";
import Categories from "./category/category.model.js";
import Sub_categories from "./category/sub_category.model.js";
import ProductionGroup from "./Production/productionGroup.model.js";
import Notification from "./notification.model.js";
import HtmlTemplate from "./htmlTemplate.model.js";
import AllocationHistory from "./Production/allocationHistory.model.js";
import DemoRequest from "./demoRequest.model.js";
import PasswordReset from "./passwordReset.model.js";
import ContactMessage from "./contactMessage.model.js";
import PurchaseOrderBilling from "./po/purchaseOrderBilling.model.js";
import WalletHistory from "./walletHistory.model.js";
import PartialPayment from "./salesOrder/partialPayment.model.js";
import SalesReturn  from "./sales_return/sales_return.model.js";
import SalesReturnItem  from "./sales_return/sales_return_item.model.js";
import PurchaseOrderPayment from "./po/PurchaseOrderPayment.model.js";

const db = {
  sequelize,
  User,
  Company,
  UserAuth,
  apiLog,
  Client,
  ClientAddress,
  SkuType,
  Sku,
  SkuVersion,
  SkuOptions,
  SalesOrder,
  SalesSkuDetails,
  WorkOrder,
  DropdownName,
  DropdownValue,
  Machine,
  MachineFlow,
  ProcessName,
  MachineProcessValue,
  MachineProcessField,
  Package,
  Currency,
  ModuleSettings,
  Flute,
  Module,
  Taxes,
  Die,
  ItemMaster,
  PurchaseOrder,
  PurchaseOrderItem,
  GRN,
  GRNItem,
  Inventory,
  InventoryType,
  Route,
  PurchaseOrderReturn,
  PurchaseOrderReturnItem,
  InvoiceSetting,
  States,
  Color,
  WorkOrderInvoice,
  WorkOrderStatus,
  MachineRouteProcess,
  stockAdjustment,
  stockAdjustmentItem,
  DebitNote,
  Categories,
  CreditNote,
  Sub_categories,
  ProductionGroup,
  Notification,
  HtmlTemplate,
  AllocationHistory,
  DemoRequest,
  PasswordReset,
  ContactMessage,
  PurchaseOrderBilling,
  WalletHistory,
  PartialPayment,
  SalesReturnItem,
  SalesReturn,
  PurchaseOrderPayment


};

export default db;
