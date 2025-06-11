import express, { json, Router } from "express";
import cors from "cors";
import { fn, col, Op, Sequelize } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import ExcelJS from "exceljs";
// const ItemMaster = db.ItemMaster;
// const Company = db.Company;
// const Inventory = db.Inventory;
// const User =db.User;
// const InventoryType = db.InventoryType;
// const GRN = db.GRN;
// const GRNItem = db.GRNItem;


const ItemMaster = db.ItemMaster;
const Company = db.Company;
const User =db.User;
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

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();

//reels 
v1Router.get("/inventory/reels", authenticateJWT, async (req, res) => {
  try {   
    const {
      search = "", bf, gsm, size, color
    } = req.query;
    // ✅ Declare andConditions early
    let andConditions = [
      { company_id: req.user.company_id }
    ];
    if (search.trim() !== "") {
      const searchConditions = [
        { id: { [Op.like]: `%${search}%` } },
      ];
      // 🔍 Item name or generate ID match
      const matchingItems = await ItemMaster.findAll({
        attributes: ['id'],
        where: {
          [Op.or]: [
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
      if (searchConditions.length > 0) {
        andConditions.push({ [Op.or]: searchConditions });
      }
    }
    const whereCondition = { [Op.and]: andConditions };
  // get inventory data
  const inventory = await Inventory.findAll({
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
    group: ['Inventory.item_id', 'item.id', 'item->category_info.id', 'item->sub_category_info.id'],
    include: [
      {
        model: ItemMaster,
        as: 'item',
        attributes: ['item_generate_id','item_name', 'uom', 'net_weight', 'description', 'category', 'sub_category','min_stock_level','standard_cost', 'status','default_custom_fields','custom_fields'],
        required: true,
        where: Sequelize.and(
          ...(bf ? [Sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(\`item\`.\`default_custom_fields\`, '$.bf')) = '${bf}'`)] : []),
          ...(gsm ? [Sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(\`item\`.\`default_custom_fields\`, '$.gsm')) = '${gsm}'`)] : []),
          ...(size ? [Sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(\`item\`.\`default_custom_fields\`, '$.size')) = '${size}'`)] : []),
          ...(color ? [Sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(\`item\`.\`default_custom_fields\`, '$.color')) ='${color}'`)] : [])
        ),
        include: [
          {
            model: Categories,
            as: 'category_info',
            attributes: ['category_name'],
            required: false,
            on: {
              col1: Sequelize.where(Sequelize.col('item.category'), '=', Sequelize.col('item->category_info.id'))
            }
          },
          {
            model: Sub_categories,
            as: 'sub_category_info',
            attributes: ['sub_category_name'],
            required: false,
            on: {
              col1: Sequelize.where(Sequelize.col('item.sub_category'), '=', Sequelize.col('item->sub_category_info.id'))
            }
          }
        ]
      }
    ],
    order: [['created_at', 'DESC']],
  });
    const inventoryData = inventory.map(inv => {
      const raw = inv.toJSON();
      if (raw.item) {
        raw.item.default_custom_fields = raw.item.default_custom_fields
          ? JSON.parse(raw.item.default_custom_fields) : {};
        raw.item.custom_fields = raw.item.custom_fields
          ? JSON.parse(raw.item.custom_fields) : {};
      }
      return raw;
    });
    return res.status(200).json({
      success: true,
      message: "Grouped Inventory data fetched successfully",
      data: {inventoryData},
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
      group: ['Inventory.item_id', 'item.id', 'item->category_info.id', 'item->sub_category_info.id'],
      include: [
        {
          model: ItemMaster,
          as: 'item',
          attributes: ['item_generate_id','item_name', 'description', 'category', 'sub_category','min_stock_level','standard_cost', 'status'],
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
      where: { id: itemId}
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
    } = db;

    const results = {
      products:[],
      purchaseOrders: [],
      grns: [],
      purchaseReturns: [],
      // creditNotes: [],
      // debitNotes: [],
      stockAdjustments: []
    };
    
    //products
    results.products = await ItemMaster.findOne({
      where: { id: itemId},
    });
     

    // Purchase Orders
    results.purchaseOrders = await PurchaseOrderItem.findAll({
      where: { item_id: itemId },
      order: [['created_at', 'DESC']],
      attributes: [ // 👈 Choose specific fields from GRNItem
        "id","description","hsn_code","quantity","unit_price",
        "cgst","sgst","tax_amount","total_amount","status","created_at"
      ],
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: [
            "id", "purchase_generate_id", "po_date", "supplier_id", "supplier_name",
            "supplier_contact", "billing_address","shipping_address", "po_status",
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

    // GRNs
    results.grns = await GRNItem.findAll({
      where: { item_id: itemId },
      order: [['created_at', 'DESC']],
      attributes: [ // 👈 Choose specific fields from GRNItem
        "id","description","quantity_ordered","quantity_received","accepted_quantity","rejected_quantity",
        "status","created_at"
      ],
      include: [
        {
          model: GRN,
          as: "grn",
          attributes: ["id", "grn_generate_id", "grn_date", "invoice_no", "invoice_date", "received_by", 
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
        "id","return_qty", "reason", "notes", "created_at", "unit_price","cgst","sgst","amount",
        "tax_amount","total_amount"
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
        "id","previous_quantity", "type", "adjustment_quantity", "difference", "reason"
      ],
      include: [
        {
          model: stockAdjustment,
          as: "adjustment",
          attributes: ["id", "stock_adjustment_generate_id","adjustment_date", "remarks", "status", "created_by", "created_at"],
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






//get Inventory
v1Router.get("/inventory", authenticateJWT, async (req, res) => {
  try {   
    const {
      search = "",
      page = "1",
      limit = "10",
      categoryId,
      subCategoryId
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
        attributes: ['id'],
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

    // ✅ Final where condition
    const whereCondition = { [Op.and]: andConditions };


   
// get a subcategory data
const subCategoryQuantities  = await Inventory.findAll({
  attributes: [
    'sub_category',
    [Sequelize.fn('SUM', Sequelize.col('quantity_available')), 'total_quantity'],
  ],
  where: whereCondition,
  group: ['Inventory.sub_category', 'sub_category_info.id'],
  include: [
    {
      model: Sub_categories,
      as: 'sub_category_info',
      attributes: ['id','sub_category_name'],
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
const inventory = await Inventory.findAll({
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
  group: ['Inventory.item_id', 'item.id', 'item->category_info.id', 'item->sub_category_info.id'],
  include: [
    {
      model: ItemMaster,
      as: 'item',
      attributes: ['item_generate_id','item_name', 'uom', 'net_weight', 'description', 'category', 'sub_category','min_stock_level','standard_cost', 'status','default_custom_fields','custom_fields'],
      required: false,
      include: [
        {
          model: Categories,
          as: 'category_info',
          attributes: ['category_name'],
          required: false,
          on: {
            col1: Sequelize.where(Sequelize.col('item.category'), '=', Sequelize.col('item->category_info.id'))
          }
        },
        {
          model: Sub_categories,
          as: 'sub_category_info',
          attributes: ['sub_category_name'],
          required: false,
          on: {
            col1: Sequelize.where(Sequelize.col('item.sub_category'), '=', Sequelize.col('item->sub_category_info.id'))
          }
        }
      ]
    }
  ],
  order: [['created_at', 'DESC']],
  limit: limitNumber,
  offset: offset,
});


    // Get total count of unique item_ids (for pagination)
    const totalCountResult = await Inventory.findAll({
      attributes: ['item_id'],
      where: whereCondition,
      group: ['item_id']
    });


    // Parse JSON fields for each item in the result
    const inventoryData = inventory.map(inv => {
      const raw = inv.toJSON();
      if (raw.item) {
        raw.item.default_custom_fields = raw.item.default_custom_fields
          ? JSON.parse(raw.item.default_custom_fields) : {};
        raw.item.custom_fields = raw.item.custom_fields
          ? JSON.parse(raw.item.custom_fields) : {};
      }
      return raw;
    });

    const totalCount = totalCountResult.length;
    const totalPages = Math.ceil(totalCount / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Grouped Inventory data fetched successfully",
      data: {inventoryData,subCategoryQuantities},
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
    const updatedinventoryData = await Inventory.findOne({ where: { id: inventoryId },transaction });
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
      },{
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
v1Router.get('/inventory/type',authenticateJWT,async(req,res)=>{
  try{
    const inventoryTypeData = await InventoryType.findAll({where:{status:"active"}});
    return res.status(200).json({
      success : true,
      message : `Inventory Type Fetched Successfully`,
      data : inventoryTypeData
    });
  }catch(error){
    console.error(error.message);
    return res.status(500).json({
      success:false,
      message:`Inventory type fetched error ${error.message}`
    });
  }
});

// Create InventoryType
v1Router.post('/inventory/type',authenticateJWT,async(req,res)=>{
  const transaction =await sequelize.transaction();
  try{
    const { ...rest } = req.body;
    rest.updated_by = req.user.id;
    rest.created_by = req.user.id;

    const inventoryTypeData = await InventoryType.create(rest,{transaction});
    await transaction.commit();

    return res.status(200).json({
      success : true,
      message : `Inventory Type Created Successfully`,
      data : inventoryTypeData
    })




  }catch(error){
    console.error(error.message);
    return res.status(500).json({
      success : false,
      message : `inventory type created error : ${error.message}`
    })
  }

});



app.use("/api", v1Router);
// await db.sequelize.sync();
const PORT = 3025;
app.listen(process.env.PORT_INVENTORY,'0.0.0.0', () => {
  console.log(`Item Master Service running on port ${process.env.PORT_INVENTORY}`);
});