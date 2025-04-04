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
import MachineProcessName from "./machine/processName.model.js";
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
  SalesOrder,
  WorkOrder,
  DropdownName,
  DropdownValue,
  Machine,
  MachineProcessName,
  MachineProcessValue,
  MachineProcessField,
  Package,
  Currency,
  ModuleSettings,Flute,Module,
};

export default db;
