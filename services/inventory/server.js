import express, { json, Router } from "express";
import cors from "cors";
import { fn, col, Op, Sequelize } from "sequelize";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";
// import dotenv from "dotenv";
// const ItemMaster = db.ItemMaster;
// const Company = db.Company;
// const Inventory = db.Inventory;
// const User =db.User;
// const InventoryType = db.InventoryType;
// const GRN = db.GRN;
// const GRNItem = db.GRNItem;


const ItemMaster = db.ItemMaster;
const Notification = db.Notification;
const Company = db.Company;
const User = db.User;
const GRN = db.GRN;
const GRNItem = db.GRNItem;
const Inventory = db.Inventory;
const PurchaseOrder = db.PurchaseOrder;
const PurchaseOrderItem = db.PurchaseOrderItem;
const PurchaseOrderReturn = db.PurchaseOrderReturn;
const PurchaseOrderReturnItem = db.PurchaseOrderReturnItem;
const CreditNote = db.CreditNote;
const DebitNote = db.DebitNote;
const stockAdjustment = db.stockAdjustment;
const stockAdjustmentItem = db.stockAdjustmentItem;
const Categories = db.Categories;
const Sub_categories = db.Sub_categories;
const PurchaseOrderBilling = db.PurchaseOrderBilling;
const Sku = db.Sku;
const WorkOrder = db.WorkOrder;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();

//reels 
v1Router.get("/inventory/reels", authenticateJWT, async (req, res) => {
  try {   
    const { search = "", bf, gsm, size, color } = req.query;

    // Build AND conditions
    let andConditions = [
      { company_id: req.user.company_id }
    ];

    if (search.trim() !== "") {
      const searchConditions = [
        { id: { [Op.like]: `%${search}%` } }
      ];

      // Search in ItemMaster JSON fields
      const matchingItems = await ItemMaster.findAll({
        attributes: ['id'],
        where: {
          [Op.or]: [
            Sequelize.where(Sequelize.json('default_custom_fields.bf'), { [Op.like]: `%${search}%` }),
            Sequelize.where(Sequelize.json('default_custom_fields.gsm'), { [Op.like]: `%${search}%` }),
            Sequelize.where(Sequelize.json('default_custom_fields.size'), { [Op.like]: `%${search}%` }),
            Sequelize.where(Sequelize.json('default_custom_fields.color'), { [Op.like]: `%${search}%` })
          ]
        }
      });
      if (matchingItems.length > 0) {
        const itemIds = matchingItems.map(item => item.id);
        searchConditions.push({ item_id: { [Op.in]: itemIds } });
      }
      if (searchConditions.length > 0) {
        andConditions.push({ [Op.or]: searchConditions });
      }
    }

    andConditions.push({ quantity_available: { [Op.ne]: 0 } });

    const whereCondition = { [Op.and]: andConditions };


    console.log("where conditio : ",whereCondition);
    
    // Get inventory data
    const inventory = await Inventory.findAll({
      attributes: [
        'id',
        'inventory_generate_id',
        'quantity_available',
        'quantity_blocked',
      ],
      where: whereCondition,
      include: [
        {
          model: ItemMaster,
          as: 'item_info',
          attributes: [
            'item_generate_id',
            'item_name',
            'default_custom_fields'
          ],
          required: true,
          where: Sequelize.and(
            ...(bf ? [Sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(\`item_info\`.\`default_custom_fields\`, '$.bf')) = '${bf}'`)] : []),
            ...(gsm ? [Sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(\`item_info\`.\`default_custom_fields\`, '$.gsm')) = '${gsm}'`)] : []),
            ...(size ? [Sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(\`item_info\`.\`default_custom_fields\`, '$.size')) = '${size}'`)] : []),
            ...(color ? [Sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(\`item_info\`.\`default_custom_fields\`, '$.color')) = '${color}'`)] : [])
          ),
          
        }
      ],
      order: [['created_at', 'DESC']],
    });

    const inventoryData = inventory.map(inv => {
    const raw = inv.toJSON();

    if (raw.item_info) {
      if (typeof raw.item_info.default_custom_fields === 'string') {
        try {
          raw.item_info.default_custom_fields = JSON.parse(raw.item_info.default_custom_fields);
        } catch {
          raw.item_info.default_custom_fields = {};
        }
      }
    }

    return raw;
  });

    return res.status(200).json({
      success: true,
      message: "Grouped Inventory data fetched successfully",
      data: inventoryData,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `Inventory fetch error: ${error.message}`,
    });
  }
});


//share notification
// v1Router.get("/inventory/low-stock", authenticateJWT, async (req, res) => {
//   try {
//     const { sendEmail, recipients } = req.query;

//     // 1. Get all items with their total available quantity
//     const lowStockItems = await Inventory.findAll({
//       attributes: [
//         'item_id',
//         [fn('SUM', col('quantity_available')), 'total_quantity']
//       ],
//       where: { company_id: req.user.company_id },
//       group: ['Inventory.item_id', 'item.id'],
//       include: [
//         {
//           model: ItemMaster,
//           as: 'item',
//           attributes: [
//             'item_generate_id', 'item_name', 'description', 'category', 'sub_category',
//             'min_stock_level', 'standard_cost', 'status', 'uom'
//           ],
//           required: true
//         }
//       ],
//       having: Sequelize.where(
//         fn('SUM', col('quantity_available')),
//         '<',
//         col('item.min_stock_level')
//       ),
//       order: [[fn('SUM', col('quantity_available')), 'ASC']]
//     });

//     // Calculate additional metrics
//     const criticalItems = lowStockItems.filter(item => Number(item.dataValues.total_quantity) === 0);
//     const totalValue = lowStockItems.reduce(
//       (sum, item) => sum + (Number(item.dataValues.total_quantity) * (item.item?.standard_cost || 0)),
//       0
//     );

//     let emailResult = null;

//     // Send email if requested and items found
//     if (sendEmail === 'true' && lowStockItems.length > 0) {
//       const emailRecipients = recipients ? recipients.split(',').map(email => email.trim()) : [];
//       emailResult = await sendLowStockEmail(lowStockItems, emailRecipients);
//     }

//     res.status(200).json({
//       success: true,
//       data: lowStockItems,
//       summary: {
//         totalLowStockItems: lowStockItems.length,
//         criticalItems: criticalItems.length,
//         totalValueAtRisk: totalValue.toFixed(2),
//         lastChecked: new Date().toISOString()
//       },
//       emailSent: emailResult ? emailResult.success : false,
//       message: lowStockItems.length > 0
//         ? `Found ${lowStockItems.length} low stock items`
//         : "All items are adequately stocked"
//     });
//   } catch (error) {
//     console.error("Low stock fetch error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// });

//export excel
v1Router.get("/inventory/export", authenticateJWT, async (req, res) => {
  try {
    const whereCondition = {
      company_id: req.user.company_id,
    };

    const inventoryData = await Inventory.findAll({
      attributes: [
        'item_id',
        [fn('SUM', col('quantity_available')), 'total_quantity'],
        'sub_category',
        'location',
        'status',
        'created_at',
        'updated_at',
      ],
      where: whereCondition,
      group: ['Inventory.item_id', 'item_info.id', 'item_info->category_info.id', 'item_info->sub_category_info.id'],
      include: [
        {
          model: ItemMaster,
          as: 'item_info',
          attributes: ['item_generate_id', 'item_name', 'description', 'category', 'sub_category', 'min_stock_level', 'standard_cost', 'status'],
          required: false,
          include: [
            {
              model: Categories,
              as: 'category_info',
              attributes: ['category_name'],
              required: false,
            },
            {
              model: Sub_categories,
              as: 'sub_category_info',
              attributes: ['sub_category_name'],
              required: false,
            }
          ]
        }
      ]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventory');

    worksheet.columns = [
      { header: 'Product ID', key: 'item_generate_id', width: 20 },
      { header: 'Item Name', key: 'item_name', width: 30 },
      { header: 'Category', key: 'category_name', width: 20 },
      { header: 'Sub Category', key: 'sub_category_name', width: 20 },
      { header: 'Location', key: 'location', width: 15 },
      { header: 'Quantity', key: 'total_quantity', width: 10 },
      { header: 'Standard Cost', key: 'standard_cost', width: 15 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Created At', key: 'created_at', width: 20 }
    ];

    inventoryData.forEach(item => {
      worksheet.addRow({
        item_generate_id: item.item?.item_generate_id || '',
        item_name: item.item?.item_name || '',
        category_name: item.item?.category_info?.category_name || '',
        sub_category_name: item.item?.sub_category_info?.sub_category_name || '',
        location: item.location || '',
        total_quantity: item.dataValues.total_quantity || 0,
        standard_cost: item.item?.standard_cost || '',
        status: item.status || '',
        created_at: item.created_at?.toISOString().split('T')[0] || '',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory_export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Excel Export Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `Inventory Excel export failed: ${error.message}`,
    });
  }
});


//////////////////////////////////////////////////////   Inventory   ///////////////////////////////////////////////////////////
//product status details
v1Router.get("/inventory/status/:id", authenticateJWT, async (req, res) => {
  try {
    const itemId = req.params.id;
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required.",
      });
    }
    // Fetch all related data for the given item ID
    const itemExists = await ItemMaster.findOne({
      where: { id: itemId }
    });

    const item_generate_id = itemExists ? itemExists.item_generate_id : null;


    const {
      PurchaseOrder,
      PurchaseOrderItem,
      GRN,
      GRNItem,
      PurchaseOrderReturn,
      PurchaseOrderReturnItem,
      CreditNote,
      DebitNote,
      stockAdjustment,
      stockAdjustmentItem,
      User,
      PurchaseOrderBilling
    } = db;

    const results = {
      products: [],
      purchaseOrders: [],
      grns: [],
      purchaseReturns: [],
      // creditNotes: [],
      // debitNotes: [],
      stockAdjustments: [],
      billing:[]
    };

    //products
    // results.products = await ItemMaster.findOne({
    //   where: { id: itemId },
    // });


    const product = await ItemMaster.findOne({
      where: { id: itemId },
    });

    if (product) {
      const parsedProduct = product.toJSON();

      if (typeof parsedProduct.custom_fields === 'string') {
        try {
          parsedProduct.custom_fields = JSON.parse(parsedProduct.custom_fields);
        } catch {
          parsedProduct.custom_fields = {};
        }
      }

      if (typeof parsedProduct.default_custom_fields === 'string') {
        try {
          parsedProduct.default_custom_fields = JSON.parse(parsedProduct.default_custom_fields);
        } catch {
          parsedProduct.default_custom_fields = {};
        }
      }

      results.products = parsedProduct;
    } else {
      results.products = null;
    }



    // Purchase Orders
    results.purchaseOrders = await PurchaseOrderItem.findAll({
      where: { item_id: itemId },
      order: [['created_at', 'DESC']],
      attributes: [ // 👈 Choose specific fields from GRNItem
        "id", "description", "hsn_code", "quantity", "unit_price",
        "cgst", "sgst", "tax_amount", "total_amount", "status", "created_at"
      ],
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: [
            "id", "purchase_generate_id", "po_date", "supplier_id", "supplier_name",
            "supplier_contact", "billing_address", "shipping_address", "po_status",
          ],
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "name", "email"]
            }
          ]
        }
      ]
    });

    // Billing

    const purchaseOrderItemPOs = await PurchaseOrderItem.findAll({
      where: { item_id: itemId },
      attributes: ["po_id"],
      raw: true,
    });
    const relevantPoIds = purchaseOrderItemPOs.map(item => item.po_id);

    results.billing = await PurchaseOrderBilling.findAll({
      where: {
        purchase_order_id: relevantPoIds  
      },
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          required: true,
          attributes: ["id", "purchase_generate_id", "supplier_name", "po_date"]
        }
      ],
      attributes: [
        "id","bill_generate_id", "bill_reference_number", "bill_date", "status", "created_at"
      ],
      order: [["created_at", "DESC"]]
    });


    // GRNs
    results.grns = await GRNItem.findAll({
      where: { item_id: itemId },
      order: [['created_at', 'DESC']],
      attributes: [ // 👈 Choose specific fields from GRNItem
        "id", "description", "quantity_ordered", "quantity_received", "accepted_quantity", "rejected_quantity",
        "status", "created_at"
      ],
      include: [
        {
          model: GRN,
          as: "grn",
          attributes: ["id", "po_id","grn_generate_id", "grn_date", "invoice_no", "invoice_date", "received_by",
            "delivery_note_no", "created_at", "status"],
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "name", "email"]
            }
          ]
        }
      ]
    });

    // Purchase Order Returns
    results.purchaseReturns = await PurchaseOrderReturnItem.findAll({
      where: { item_id: itemId },
      order: [['created_at', 'DESC']],
      attributes: [ // 👈 Choose specific fields from GRNItem
        "id", "return_qty", "reason", "notes", "created_at", "unit_price", "cgst", "sgst", "amount",
        "tax_amount", "total_amount"
      ],
      include: [
        {
          model: PurchaseOrderReturn,
          as: 'purchaseOrderReturnId',
          attributes: ["id", "purchase_return_generate_id", "return_date", "reason"],
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "name", "email"]
            }
          ]
        }
      ]
    });


    // Stock Adjustments
    results.stockAdjustments = await stockAdjustmentItem.findAll({
      where: { item_id: itemId },
      order: [['created_at', 'DESC']],
      attributes: [
        "id", "previous_quantity", "type", "adjustment_quantity", "difference", "reason"
      ],
      include: [
        {
          model: stockAdjustment,
          as: "adjustment",
          attributes: ["id", "stock_adjustment_generate_id", "adjustment_date", "remarks", "status", "created_by", "created_at"],
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "name", "email"]
            }
          ]
        }
      ]
    });

    //  // Credit Notes
    // results.creditNotes = await CreditNote.findAll({
    //   where: { item_id: itemId }
    // });

    // // Debit Notes
    // results.debitNotes = await DebitNote.findAll({
    //   where: { item_id: itemId }
    // });

    return res.status(200).json({
      success: true,
      message: "Item-related data fetched successfully.",
      data: results,
    });

  } catch (error) {
    console.error("Inventory Item Status Fetch Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `Error fetching item data: ${error.message}`,
    });
  }
});


//selva
//get Inventory
v1Router.get("/inventory/product", authenticateJWT, async (req, res) => {
  try {
    const {
      search = "",
      page = "1",
      limit = "10",
      // categoryId = "1",  
       categoryId,  
      subCategoryId,
      stock_status
    } = req.query;

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    const offset = (pageNumber - 1) * limitNumber;

    // let whereCondition = {
    //   company_id: req.user.company_id
    // };

    // Optional search filters (e.g., inventory ID or generate ID)

    // ✅ Declare andConditions early
    let andConditions = [
      { company_id: req.user.company_id }
    ];

    if (search.trim() !== "") {
      const searchConditions = [
        { id: { [Op.like]: `%${search}%` } },
        { item_id: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
      ];

      // 🔍 Item name or generate ID match
      const matchingItems = await ItemMaster.findAll({
        attributes: ['id'],
        where: {
          [Op.or]: [
            { item_generate_id: { [Op.like]: `%${search}%` } },
            { item_name: { [Op.like]: `%${search}%` } },
            Sequelize.where(
              Sequelize.json('default_custom_fields.bf'),
              { [Op.like]: `%${search}%` }
            ),
            Sequelize.where(
              Sequelize.json('default_custom_fields.gsm'),
              { [Op.like]: `%${search}%` }
            ),
            Sequelize.where(
              Sequelize.json('default_custom_fields.size'),
              { [Op.like]: `%${search}%` }
            ),
            Sequelize.where(
              Sequelize.json('default_custom_fields.color'),
              { [Op.like]: `%${search}%` }
            )
          ]
        }
      });
      if (matchingItems.length > 0) {
        const itemIds = matchingItems.map(item => item.id);
        searchConditions.push({ item_id: { [Op.in]: itemIds } });
      }

      // 🔍 Category name match
      const matchingCategory = await Categories.findAll({
        attributes: ['id',],
        where: {
          category_name: { [Op.like]: `%${search}%` }
        }
      });
      if (matchingCategory.length > 0) {
        const categoryIds = matchingCategory.map(category => category.id);
        searchConditions.push({ category: { [Op.in]: categoryIds } });
      }

      // 🔍 Subcategory name match
      const matchingSubCategory = await Sub_categories.findAll({
        attributes: ['id'],
        where: {
          sub_category_name: { [Op.like]: `%${search}%` }
        }
      });
      if (matchingSubCategory.length > 0) {
        const subCategoryIds = matchingSubCategory.map(sub => sub.id);
        searchConditions.push({ sub_category: { [Op.in]: subCategoryIds } });
      }

      if (searchConditions.length > 0) {
        andConditions.push({ [Op.or]: searchConditions });
      }
    }
    // 🔍 Filter by selected dropdowns
    if (categoryId) {
      andConditions.push({ category: categoryId });
    }

    if (subCategoryId) {
      andConditions.push({ sub_category: subCategoryId });
    }

    // if (stock_status) {
    //   andConditions.push({ stock_status: stock_status });
    // }

    // ✅ Final where condition
    const whereCondition = { [Op.and]: andConditions };



    // get a subcategory data
    const subCategoryQuantities = await Inventory.findAll({
      attributes: [
        'sub_category',
        'category'
        // [Sequelize.fn('SUM', Sequelize.col('quantity_available')), 'total_quantity'],
      ],
      // where: whereCondition,
      group: ['Inventory.sub_category', 'sub_category_info.id', 'Inventory.category'],
      include: [
        {
          model: Categories,
          as: 'category_info',
          attributes: ['id', 'category_name',[Sequelize.fn('SUM', Sequelize.col('quantity_available')), 'total_quantity'],[Sequelize.fn('SUM', Sequelize.literal('Inventory.quantity_available * Inventory.rate')), 'total_amount']],
          required: false,
          on: Sequelize.where(
            Sequelize.col('Inventory.category'),
            '=',
            Sequelize.col('category_info.id')
          )
        },
        {
          model: Sub_categories,
          as: 'sub_category_info',
          attributes: ['id', 'sub_category_name',[Sequelize.fn('SUM', Sequelize.col('quantity_available')), 'total_quantity'],[Sequelize.fn('SUM', Sequelize.literal('Inventory.quantity_available * Inventory.rate')), 'total_amount']],
          required: false,
          on: Sequelize.where(
            Sequelize.col('Inventory.sub_category'),
            '=',
            Sequelize.col('sub_category_info.id')
          )
        },
        {
          model: ItemMaster,
          as: 'item_info',
          attributes: [
            'item_name',
            'item_generate_id'
          ],
          required: false,
          on: Sequelize.where(
            Sequelize.col('Inventory.item_id'),
            '=',
            Sequelize.col('item_info.id')
          )
        }
      ]
    });


    // get inventory data
    let allInventoryData  = await Inventory.findAll({
      attributes: [
        //  'id',
        'item_id',
        [fn('SUM', col('quantity_available')), 'total_quantity'],
        [fn('SUM', col('total_amount')), 'total_amount'],
        // 'sub_category',
        'location',
        'qr_code_url',
        //  'rate',
        'status',
        'created_at',
        'updated_at',
        [Sequelize.literal(`(
      SELECT rate FROM inventory AS i2
      WHERE i2.item_id = Inventory.item_id
      ORDER BY i2.created_at DESC
      LIMIT 1
    )`), 'rate'],
      ],
      where: whereCondition,
      group: ['Inventory.item_id', 'item_info.id', 'item_info->category_info.id', 'item_info->sub_category_info.id'],
      include: [
        {
          model: ItemMaster,
          as: 'item_info',
          attributes: ['item_generate_id', 'item_name', 'uom', 'net_weight', 'description', 'category', 'sub_category', 'min_stock_level', 'standard_cost', 'qr_code_url', 'status', 'default_custom_fields', 'custom_fields'],
          required: false,
          include: [
            {
              model: Categories,
              as: 'category_info',
              attributes: ['category_name'],
              required: false,
              on: {
                col1: Sequelize.where(Sequelize.col('item_info.category'), '=', Sequelize.col('item_info->category_info.id'))
              }
            },
            {
              model: Sub_categories,
              as: 'sub_category_info',
              attributes: ['sub_category_name'],
              required: false,
              on: {
                col1: Sequelize.where(Sequelize.col('item_info.sub_category'), '=', Sequelize.col('item_info->sub_category_info.id'))
              }
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: limitNumber,
      offset: offset,
    });

    let filteredInventory = allInventoryData;
if (stock_status && ['out_of_stock', 'low_stock', 'in_stock'].includes(stock_status)) {
      filteredInventory = allInventoryData.filter(inv => {
        const raw = inv.toJSON();
      
        if (raw.item_info && raw.item_info.min_stock_level !== undefined) {
          // ✅ Use correct field name 'total_quantity'
          const quantity = parseFloat(raw.total_quantity || 0);
          const minStock = parseFloat(raw.item_info.min_stock_level || 0);
          
          let calculatedStatus;
          if (quantity <= 0) {
            calculatedStatus = 'out_of_stock';
          } else if (quantity <= minStock) {
            calculatedStatus = 'low_stock';
          } else {
            calculatedStatus = 'in_stock';
          }
          
          return calculatedStatus === stock_status;
        }
        
        return false;
      });
    }




    // Get total count of unique item_ids (for pagination)
    const totalCount = filteredInventory.length;
    const paginatedInventory = filteredInventory.slice(offset, offset + limitNumber);

    // Get total amount (from original query without stock filter)
    // const totalAmount = await Inventory.findOne({
    //   attributes: [[Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total_amount']],
    //   where: whereCondition,
    // });

    let totalAmount = 0;
    
    if (stock_status && ['out_of_stock', 'low_stock', 'in_stock'].includes(stock_status)) {
      // For stock-filtered queries, calculate from filtered results
      totalAmount = filteredInventory.reduce((sum, inv) => {
        const raw = inv.toJSON();
        return sum + parseFloat(raw.total_amount || 0);
      }, 0);
    } else {
      // For non-stock-filtered queries, use efficient database calculation
      const totalAmountResult = await Inventory.findOne({
        attributes: [[Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total_amount']],
        where: whereCondition,
      });
      totalAmount = totalAmountResult?.total_amount || 0;
    }


    // Parse JSON fields for each item in the result
    // const inventoryData = inventory.map(inv => {
    //   const raw = inv.toJSON();
    //   if (raw.item) {
    //     raw.item.default_custom_fields = raw.item.default_custom_fields
    //       ? JSON.parse(raw.item.default_custom_fields) : {};
    //     raw.item.custom_fields = raw.item.custom_fields
    //       ? JSON.parse(raw.item.custom_fields) : {};
    //   }
    //   return raw;
    // });

    const inventoryData = paginatedInventory.map(inv => {
      const raw = inv.toJSON();

      if (raw.item_info) {
        if (typeof raw.item_info.default_custom_fields === 'string') {
          try {
            raw.item_info.default_custom_fields = JSON.parse(raw.item_info.default_custom_fields);
          } catch {
            raw.item_info.default_custom_fields = {};
          }
        }

        if (typeof raw.item_info.custom_fields === 'string') {
          try {
            raw.item_info.custom_fields = JSON.parse(raw.item_info.custom_fields);
          } catch {
            raw.item_info.custom_fields = {};
          }
        }


         // Add calculated stock status to response
        const quantity = parseFloat(raw.total_quantity || 0);
        const minStock = parseFloat(raw.item_info.min_stock_level || 0);
        
        if (quantity <= 0) {
          raw.calculated_stock_status = 'out_of_stock';
        } else if (quantity <= minStock) {
          raw.calculated_stock_status = 'low_stock';
        } else {
          raw.calculated_stock_status = 'in_stock';
        }
      
      }

             


      return raw;
    });

    // const totalCount = totalCountResult.length;
    const totalPages = Math.ceil(totalCount / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Grouped Inventory data fetched successfully",
      data: { inventoryData, subCategoryQuantities },
      pagination: {
        currentPage: pageNumber,
        perPage: limitNumber,
        totalCount,
        totalPages,
        totalAmount: totalAmount
      },
      totalCount: totalCount
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `Inventory fetch error: ${error.message}`,
    });
  }
});




v1Router.get("/inventory", authenticateJWT, async (req, res) => {
  try {
    const {
      search = "",
      page = "1",
      limit = "50",
      categoryId,  
      subCategoryId,
      stock_status
    } = req.query;

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    const offset = (pageNumber - 1) * limitNumber;

    let andConditions = [
      { company_id: req.user.company_id }
    ];

    if (search.trim() !== "") {
      const searchConditions = [
        { id: { [Op.like]: `%${search}%` } },
        { item_id: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
      ];

      // 🔍 Item name or generate ID match
      const matchingItems = await ItemMaster.findAll({
        attributes: ['id'],
        where: {
          [Op.or]: [
            { item_generate_id: { [Op.like]: `%${search}%` } },
            { item_name: { [Op.like]: `%${search}%` } },
            Sequelize.where(
              Sequelize.json('default_custom_fields.bf'),
              { [Op.like]: `%${search}%` }
            ),
            Sequelize.where(
              Sequelize.json('default_custom_fields.gsm'),
              { [Op.like]: `%${search}%` }
            ),
            Sequelize.where(
              Sequelize.json('default_custom_fields.size'),
              { [Op.like]: `%${search}%` }
            ),
            Sequelize.where(
              Sequelize.json('default_custom_fields.color'),
              { [Op.like]: `%${search}%` }
            )
          ]
        }
      });
      if (matchingItems.length > 0) {
        const itemIds = matchingItems.map(item => item.id);
        searchConditions.push({ item_id: { [Op.in]: itemIds } });
      }


      // 🔍 Category name match
      const matchingCategory = await Categories.findAll({
        attributes: ['id',],
        where: {
          category_name: { [Op.like]: `%${search}%` }
        }
      });
      if (matchingCategory.length > 0) {
        const categoryIds = matchingCategory.map(category => category.id);
        searchConditions.push({ category: { [Op.in]: categoryIds } });
      }

      // 🔍 Subcategory name match
      const matchingSubCategory = await Sub_categories.findAll({
        attributes: ['id'],
        where: {
          sub_category_name: { [Op.like]: `%${search}%` }
        }
      });
      if (matchingSubCategory.length > 0) {
        const subCategoryIds = matchingSubCategory.map(sub => sub.id);
        searchConditions.push({ sub_category: { [Op.in]: subCategoryIds } });
      }

      if (searchConditions.length > 0) {
        andConditions.push({ [Op.or]: searchConditions });
      }
    }
    // 🔍 Filter by selected dropdowns
    if (categoryId) {
      andConditions.push({ category: categoryId });
    }

    if (subCategoryId) {
      andConditions.push({ sub_category: subCategoryId });
    }

    // if (stock_status) {
    //   andConditions.push({ stock_status: stock_status });
    // }

    // ✅ Final where condition



    // get a subcategory data
    const subCategoryQuantities = await Inventory.findAll({
      attributes: [
        'sub_category',
        'category'
      ],
      // where: whereCondition,
      group: ['Inventory.sub_category', 'sub_category_info.id', 'Inventory.category'],
      include: [
        {
          model: Categories,
          as: 'category_info',
          attributes: ['id', 'category_name',[Sequelize.fn('SUM', Sequelize.col('quantity_available')), 'total_quantity'],[Sequelize.fn('SUM', Sequelize.literal('Inventory.quantity_available * Inventory.rate')), 'total_amount']],
          required: false,
          on: Sequelize.where(
            Sequelize.col('Inventory.category'),
            '=',
            Sequelize.col('category_info.id')
          )
        },
        {
          model: Sub_categories,
          as: 'sub_category_info',
          attributes: ['id', 'sub_category_name',[Sequelize.fn('SUM', Sequelize.col('quantity_available')), 'total_quantity'],[Sequelize.fn('SUM', Sequelize.literal('Inventory.quantity_available * Inventory.rate')), 'total_amount']],
          required: false,
          on: Sequelize.where(
            Sequelize.col('Inventory.sub_category'),
            '=',
            Sequelize.col('sub_category_info.id')
          )
        },
        {
          model: ItemMaster,
          as: 'item_info',
          attributes: [
            'item_name',
            'item_generate_id'
          ],
          required: false,
          on: Sequelize.where(
            Sequelize.col('Inventory.item_id'),
            '=',
            Sequelize.col('item_info.id')
          )
        }
      ]
    });


    // get inventory data



    
//   const inventory = await Inventory.findAll({
//   attributes: [
//     'id',
//     'item_id',
//     'quantity_available',
//     'total_amount',
//     'location',
//     'rate',
//     'status',
//     'created_at',
//     'updated_at'
//   ],
//   where: whereCondition,
//   include: [
//     {
//       model: ItemMaster,
//       as: 'item_info',
//       attributes: ['item_generate_id', 'item_name', 'uom', 'net_weight', 'description', 'category', 'sub_category', 'min_stock_level', 'standard_cost', 'status', 'default_custom_fields', 'custom_fields'],
//       required: false,
//       include: [
//         {
//           model: Categories,
//           as: 'category_info',
//           attributes: ['category_name'],
//           required: false
//         },
//         {
//           model: Sub_categories,
//           as: 'sub_category_info',
//           attributes: ['sub_category_name'],
//           required: false
//         }
//       ]
//     }

//   ],
//   order: [['created_at', 'DESC']],
//   limit: limitNumber,
//   offset: offset,
// });


let inventory = [];

if (stock_status) {
      andConditions.push({ stock_status: stock_status });
}

    const whereCondition = { [Op.and]: andConditions };

const itemMasterInventory = await Inventory.findAll({
  attributes: [
    'id',
    'item_id',
    'qr_code_url',
    'quantity_available',
    'total_amount',
    'location',
    'rate',
    'status',
    'stock_status',
    'sales_return_id',
    'created_at',
    'updated_at'
  ],
  where: {
    ...whereCondition,
  sku_id: { [Sequelize.Op.or]: [0, null] }
  },
  include: [
    {
      model: ItemMaster,
      as: 'item_info',
      attributes: [
        'item_generate_id', 'item_name', 'uom', 'net_weight', 'description',
        'category', 'sub_category', 'min_stock_level', 'standard_cost','qr_code_url', 'status',
        'default_custom_fields', 'custom_fields'
      ],
      required: false,
      include: [
        {
          model: Categories,
          as: 'category_info',
          attributes: ['category_name'],
          required: false
        },
        {
          model: Sub_categories,
          as: 'sub_category_info',
          attributes: ['sub_category_name'],
          required: false
        }
      ]
    }
  ],
  order: [['created_at', 'DESC']],
  limit: limitNumber,
  offset: offset
});

const skuInventory = await Inventory.findAll({
  attributes: [
    'id',
    'sku_id',
    'sku_generate_id',
    'work_order_id',
    'quantity_available',
    'total_amount',
    'location',
    'rate',
    'status',
    'sales_return_id',
    'created_at',
    'updated_at'
  ],
  where: {
    ...whereCondition,
    item_id: { [Sequelize.Op.or]: [0, null] }
  },
  //  include: [
  //   {
  //     model: WorkOrder, 
  //     as: 'work_order_info', 
  //     attributes: ['id'] 
  //   }
  // ],
  order: [['created_at', 'DESC']],
  limit: limitNumber,
  offset: offset
});


// Final merged result
let allInventory = [...itemMasterInventory, ...skuInventory];



// Filter by calculated stock status if needed
    if (stock_status && ['out_of_stock', 'low_stock', 'in_stock'].includes(stock_status)) {
      allInventory = allInventory.filter(inv => {
        const raw = inv.toJSON();
        
        // For ItemMaster inventory
        if (raw.item_info && raw.item_info.min_stock_level !== undefined) {
          const quantity = parseFloat(raw.quantity_available || 0);
          const minStock = parseFloat(raw.item_info.min_stock_level || 0);
          
          let calculatedStatus;
          if (quantity <= 0) {
            calculatedStatus = 'out_of_stock';
          } else if (quantity <= minStock) {
            calculatedStatus = 'low_stock';
          } else {
            calculatedStatus = 'in_stock';
          }
          
          return calculatedStatus === stock_status;
        }
        
        // For SKU inventory (only include for out_of_stock)
        if (raw.sku_id && stock_status === 'out_of_stock') {
          return parseFloat(raw.quantity_available || 0) <= 0;
        }
        
        return false;
      });
    }

    // Apply pagination to filtered results
    inventory = allInventory.slice(0, limitNumber);





    // Get total count of unique item_ids (for pagination)
    const totalCountResult = await Inventory.findAll({
      attributes: ['item_id'],
      where: whereCondition,
      // group: ['item_id']
    });


    // Parse JSON fields for each item in the result
    // const inventoryData = inventory.map(inv => {
    //   const raw = inv.toJSON();
    //   if (raw.item) {
    //     raw.item.default_custom_fields = raw.item.default_custom_fields
    //       ? JSON.parse(raw.item.default_custom_fields) : {};
    //     raw.item.custom_fields = raw.item.custom_fields
    //       ? JSON.parse(raw.item.custom_fields) : {};
    //   }
    //   return raw;
    // });

    const inventoryData = inventory.map(inv => {
  const raw = inv.toJSON();

  if (raw.item_info) {
    if (typeof raw.item_info.default_custom_fields === 'string') {
      try {
        raw.item_info.default_custom_fields = JSON.parse(raw.item_info.default_custom_fields);
      } catch {
        raw.item_info.default_custom_fields = {};
      }
    }

    if (typeof raw.item_info.custom_fields === 'string') {
      try {
        raw.item_info.custom_fields = JSON.parse(raw.item_info.custom_fields);
      } catch {
        raw.item_info.custom_fields = {};
      }
    }
  }

  return raw;
});

    const totalCount = totalCountResult.length;
    const totalPages = Math.ceil(totalCount / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Grouped Inventory data fetched successfully",
      data: { inventoryData, subCategoryQuantities },
      pagination: {
        currentPage: pageNumber,
        perPage: limitNumber,
        totalCount,
        totalPages
      },
      totalCount: totalCount
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `Inventory fetch error: ${error.message}`,
    });
  }
});


// Edit Inventory (Fetch by ID)
v1Router.get("/inventory/id/:id", authenticateJWT, async (req, res) => {
  try {
    const inventoryId = req.params.id;
    if (!inventoryId) {
      return res.status(400).json({
        success: false,
        message: "Inventory ID is required.",
      });
    }
    const inventoryData = await Inventory.findOne({
      where: { id: inventoryId },
    });
    if (!inventoryData) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found.",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Inventory fetched successfully.",
      data: inventoryData,
    });
  } catch (error) {
    console.error("Inventory Fetch Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `Inventory fetch error: ${error.message}`,
    });
  }
});


// update inventory 
v1Router.put("/inventory/id/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const inventoryId = req.params.id;
    const { ...rest } = req.body;
    if (!inventoryId) {
      return res.status(400).json({
        success: false,
        message: `inventory ID is required.`,
      });
    }
    rest.updated_by = req.user.id;
    rest.updated_at = new Date();
    rest.company_id = req.user.company_id;
    const existingData = await Inventory.findOne({ where: { id: inventoryId } });
    if (!existingData) {
      return res.status(404).json({
        success: false,
        message: `inventory not found.`,
      });
    }

    // Validate Item
    const itemId = req.body.item_id;
    const validateItem = await ItemMaster.findOne({
      where: { id: itemId, status: "active" }
    });
    if (!validateItem) {
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive Item.`,
      });
    }

    // Validate GRN
    const grnId = req.body.grn_id;
    const validateGrn = await GRN.findOne({
      where: { id: grnId, status: "active" }
    });
    if (!validateGrn) {
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive GRN.`,
      });
    }

    // Validate GRN Item
    const grnItemId = req.body.grn_item_id;
    const validateGrnItem = await GRNItem.findOne({
      where: { id: grnItemId, status: "active" }
    });
    if (!validateGrnItem) {
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive GrnItem.`,
      });
    }



    await Inventory.update(rest, {
      where: { id: inventoryId },
      transaction
    });
    const updatedinventoryData = await Inventory.findOne({ where: { id: inventoryId }, transaction });
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: `inventory updated successfully.`,
      data: updatedinventoryData
    });

  } catch (error) {
    await transaction.rollback();
    console.error("inventory Update Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `inventory update error: ${error.message}`
    });
  }
});


// Delete Inventory 
v1Router.delete("/inventory/id/:id", authenticateJWT, async (req, res) => {
  try {
    const inventoryId = req.params.id;
    if (!inventoryId) {
      return res.status(400).json({
        success: false,
        message: `inventory ID is required`
      });
    }
    const existingData = await Inventory.findOne({ where: { id: inventoryId } });
    if (!existingData) {
      return res.status(404).json({
        success: false,
        message: `inventory not found`
      });
    }
    await Inventory.update(
      {
        status: "inactive",
        deleted_at: new Date(),
        updated_by: req.user.id,
        updated_at: new Date(),
      }, {
      where: { id: inventoryId }
    }
    );
    return res.status(200).json({
      success: true,
      message: `inventory deleted successfully`,
      data: []
    });
  } catch (error) {
    console.error("inventory Delete Error:", error.message);
    return res.status(500).json({
      success: false,
      message: `inventory delete error: ${error.message}`
    });
  }
});


//////////////////////////////////////////////////////    InventoryType    /////////////////////////////////////////////////////

// Get InventoryType
v1Router.get('/inventory/type', authenticateJWT, async (req, res) => {
  try {
    const inventoryTypeData = await InventoryType.findAll({ where: { status: "active" } });
    return res.status(200).json({
      success: true,
      message: `Inventory Type Fetched Successfully`,
      data: inventoryTypeData
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `Inventory type fetched error ${error.message}`
    });
  }
});

// Create InventoryType
v1Router.post('/inventory/type', authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { ...rest } = req.body;
    rest.updated_by = req.user.id;
    rest.created_by = req.user.id;

    const inventoryTypeData = await InventoryType.create(rest, { transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Inventory Type Created Successfully`,
      data: inventoryTypeData
    })




  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `inventory type created error : ${error.message}`
    })
  }

});

v1Router.post('/inventory/alert', authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { ...rest } = req.body;
    const itemId = req.body.item_id;

    // Validate Item and get min_stock_level
    const validateItem = await ItemMaster.findOne({
      where: { id: itemId, status: "active" }
    });

    if (!validateItem) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive Item.`,
      });
    }

    // Get current available quantity from inventory
    const inventoryResult = await sequelize.query(
      'SELECT SUM(quantity_available) as total_quantity FROM `inventory` WHERE `item_id` = :itemId',
      {
        replacements: { itemId: itemId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const currentQuantity = parseFloat(inventoryResult[0]?.total_quantity || 0);
    const minStockLevel = parseFloat(validateItem.min_stock_level || 0);

    console.log(`Item: ${validateItem.name}, Current Qty: ${currentQuantity}, Min Level: ${minStockLevel}`);

    let notificationCreated = false;
    let emailSent = false;

    // Check if current quantity is less than minimum stock level
    if (currentQuantity < minStockLevel) {

      // Check if there's already an active notification for this item
      const existingNotification = await Notification.findOne({
        where: {
          item_id: itemId,
          status: 'active',
          notification_type: currentQuantity === 0 ? 'out_of_stock' : 'low_stock'
        },
        transaction
      });

      if (!existingNotification) {
        // Create notification message
        const notificationType = currentQuantity === 0 ? 'out_of_stock' : 'low_stock';
        const message = currentQuantity === 0
          ? `CRITICAL: Item "${validateItem.item_name}" is completely out of stock! Immediate purchase required.`
          : `ALERT: Item "${validateItem.item_name}" is running low (${currentQuantity} units remaining, minimum required: ${minStockLevel}). This item now has low availability and needs to be purchased to maintain adequate stock levels.`;

        // Create notification record
        const notification = await Notification.create({
          item_id: itemId,
          company_id: req.user.company_id,
          notification_type: notificationType,
          message: message,
          current_quantity: currentQuantity,
          min_stock_level: minStockLevel,
          status: 'active',
          email_sent: false
        }, { transaction });

        notificationCreated = true;

        // Send email alert
        try {
          emailSent = await sendLowStockEmail(validateItem, currentQuantity, minStockLevel);

          if (emailSent) {
            // Update notification to mark email as sent
            await notification.update({
              email_sent: true,
              email_sent_at: new Date()
            }, { transaction });
          }
        } catch (emailError) {
          console.error('Failed to send email:', emailError);
          // Don't rollback transaction just because email failed
        }

        await transaction.commit();

        return res.status(200).json({
          success: true,
          message: `Low stock alert created successfully`,
          alert_triggered: true,
          data: {
            item_name: validateItem.name,
            current_quantity: currentQuantity,
            min_stock_level: minStockLevel,
            shortage: minStockLevel - currentQuantity,
            notification_created: notificationCreated,
            email_sent: emailSent,
            notification_message: message
          }
        });
      } else {
        await transaction.commit();

        return res.status(200).json({
          success: true,
          message: `Active low stock alert already exists for this item`,
          alert_triggered: false,
          data: {
            item_name: validateItem.name,
            current_quantity: currentQuantity,
            min_stock_level: minStockLevel,
            existing_notification_id: existingNotification.id
          }
        });
      }
    } else {
      // Stock level is adequate, resolve any existing notifications
      await Notification.update(
        { status: 'resolved', updated_at: new Date() },
        {
          where: {
            item_id: itemId,
            status: 'active'
          },
          transaction
        }
      );

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: `Stock level is adequate - no alert needed`,
        alert_triggered: false,
        data: {
          item_name: validateItem.name,
          current_quantity: currentQuantity,
          min_stock_level: minStockLevel,
          stock_status: 'adequate'
        }
      });
    }

  } catch (error) {
    await transaction.rollback();
    console.error('Inventory alert error:', error.message);
    return res.status(500).json({
      success: false,
      message: `Inventory alert error: ${error.message}`
    });
  }
});

async function sendLowStockEmail(itemData, currentQuantity, minStockLevel) {
  try {
    // Configure your email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc3545; color: white; padding: 15px; text-align: center; }
            .content { padding: 20px; border: 1px solid #ddd; }
            .alert-box { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 15px 0; border-radius: 4px; }
            .details { background-color: #f8f9fa; padding: 15px; margin: 10px 0; }
            .urgent { color: #dc3545; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>🚨 LOW STOCK ALERT</h2>
            </div>
            <div class="content">
                <div class="alert-box">
                    <p class="urgent">URGENT: Item stock is running low and needs immediate attention!</p>
                </div>
                
                <h3>Item Details:</h3>
                <div class="details">
                    <p><strong>Item Name:</strong> ${itemData.name || itemData.item_name}</p>
                    <p><strong>Item Code:</strong> ${itemData.code || itemData.item_code}</p>
                    
                </div>
                
                <h3>Stock Information:</h3>
                <div class="details">
                    <p><strong>Current Available Quantity:</strong> <span class="urgent">${currentQuantity}</span></p>
                    <p><strong>Minimum Stock Level:</strong> ${minStockLevel}</p>
                    <p><strong>Shortage:</strong> <span class="urgent">${minStockLevel - currentQuantity} units</span></p>
                </div>
                
                <div class="alert-box">
                    <p><strong>Action Required:</strong> This item now has low availability and needs to be purchased immediately to avoid stockout.</p>
                </div>
                
                <p><strong>Generated on:</strong> ${new Date().toLocaleString()}</p>
            </div>
        </div>
    </body>
    </html>`;

    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: process.env.INVENTORY_ALERT_EMAIL || 'ananda.s@pazl.info', // Configure this in your environment
      subject: `🚨 LOW STOCK ALERT - ${itemData.name || itemData.item_name}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
}

v1Router.get('/inventory/notifications', authenticateJWT, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { status: 'active' },
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      message: 'Active notifications retrieved successfully',
      data: notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error.message);
    return res.status(500).json({
      success: false,
      message: `Get notifications error: ${error.message}`
    });
  }
});

// Endpoint to resolve/dismiss notifications
v1Router.patch('/inventory/notifications/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'resolved' or 'dismissed'

    const notification = await Notification.findByPk(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.update({ status: status });

    return res.status(200).json({
      success: true,
      message: `Notification ${status} successfully`,
      data: notification
    });
  } catch (error) {
    console.error('Update notification error:', error.message);
    return res.status(500).json({
      success: false,
      message: `Update notification error: ${error.message}`
    });
  }
});

app.use("/api", v1Router);
// await db.sequelize.sync();
const PORT = 3025;
app.listen(process.env.PORT_INVENTORY, '0.0.0.0', () => {
  console.log(`Inventory Service running on port ${process.env.PORT_INVENTORY}`);
});