import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";

const Company = db.Company;
const User =db.User;
const GRN = db.GRN;
const GRNItem = db.GRNItem;
const PurchaseOrder = db.PurchaseOrder;
const ItemMaster = db.ItemMaster;
const PurchaseOrderItem = db.PurchaseOrderItem;
const Inventory = db.Inventory;
const Categories = db.Categories;
const Sub_categories = db.Sub_categories;


dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();








// v1Router.post("/grn", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();
//   try {
//     const grn_generate_id = await generateId(req.user.company_id, GRN, "grn");
//     const inventory_generate_id = await generateId(req.user.company_id, Inventory, "inventory");
//     console.log("inventory_generate_id :", inventory_generate_id);
    
//     const { items, ...grnData } = req.body;

//     grnData.created_by = req.user.id;
//     grnData.updated_by = req.user.id;
//     grnData.grn_generate_id = grn_generate_id;
//     grnData.company_id = req.user.company_id;

//     const validatePo = await PurchaseOrder.findOne({
//       where: { id: grnData.po_id, status: "active" },
//       transaction
//     });

//     if (!validatePo) {
//       throw new Error("Invalid or inactive Purchase Order.");
//     }
//     let newGRN = null;

//     for (const item of items) {
//       const {
//         po_item_id, item_id, item_code, grn_item_name, description,
//         quantity_ordered, quantity_received, accepted_quantity,
//         rejected_quantity, notes,unit_price,  cgst, cgst_amount, sgst, sgst_amount, amount, tax_amount, total_amount, work_order_no, batch_no, location
//       } = item;


//       const poItem = await PurchaseOrderItem.findOne({
//         where: { id: po_item_id },
//         attributes: ['quantity'],
//         transaction
//       });
//       if (!poItem) throw new Error(`PO Item ${po_item_id} not found`);

//       const grnStatus = (parseFloat(accepted_quantity) === parseFloat(poItem.quantity))
//         ? "fully_received"
//         : "partially_received";


//       if (!newGRN) {
//         grnData.grn_status = grnStatus;
//         newGRN = await GRN.create(grnData, { transaction });
//       }

//       // const newGRN = await GRN.create(grnData, { transaction });


//       const itemMaster = await ItemMaster.findOne({
//         where: { id: item_id },
//         transaction
//       });
//       if (!itemMaster) throw new Error(`Item ${item_id} not found`);

//       const category = itemMaster.category;
//       const sub_category = itemMaster.sub_category;

//       const newGRNItem = await GRNItem.create({
//         grn_id: newGRN.id,
//         po_item_id,
//         item_id,
//         item_code,
//         grn_item_name,
//         description,
//         quantity_ordered,
//         quantity_received,
//         accepted_quantity,
//         rejected_quantity,
//         unit_price,
//         notes,
//         work_order_no,
//         batch_no,
//         location,
//         cgst, 
//         cgst_amount, 
//         sgst, 
//         sgst_amount, 
//         amount, 
//         tax_amount, 
//         total_amount,
//         created_by: req.user.id,
//         updated_by: req.user.id,
//         company_id: req.user.company_id,
//         grn_item_status: grnStatus,
//       }, { transaction });

//       const acceptedQty = parseFloat(accepted_quantity) || 0;

//       // const existingInventory = await Inventory.findOne({
//       //   where: {
//       //     item_id,
//       //     batch_no: batch_no || null,
//       //     location: location || null,
//       //     status: 'active'
//       //   },
//       //   transaction
//       // });

//       // if (existingInventory) {
       
//       //   // existingInventory.quantity_available =
//       //   //   (parseFloat(existingInventory.quantity_available) || 0) + acceptedQty;
//       //   // existingInventory.updated_by = req.user.id;
//       //   // await existingInventory.save({ transaction });
        
//       //   const updatedQuantity = (parseFloat(existingInventory.quantity_available) || 0) + acceptedQty;
        
//       //   await Inventory.create({
//       //     company_id: req.user.company_id,
//       //     item_id,
//       //     item_code,
//       //     grn_id: newGRN.id,
//       //     grn_item_id: newGRNItem.id,
//       //     po_id: grnData.po_id,
//       //     category:category,
//       //     sub_category:sub_category,
//       //     // inventory_type: itemType,
//       //     work_order_no,
//       //     description,
//       //     quantity_available: updatedQuantity,
//       //     batch_no,
//       //     location,
//       //     status: 'active',
//       //     created_by: req.user.id,
//       //     updated_by: req.user.id
//       //   }, { transaction });
//       // } else {
//         await Inventory.create({
//           inventory_generate_id :inventory_generate_id,
//           company_id: req.user.company_id,
//           item_id,
//           item_code,
//           grn_id: newGRN.id,
//           grn_item_id: newGRNItem.id,
//           po_id: grnData.po_id,
//           category:category,
//           sub_category:sub_category,
//           po_item_id:po_item_id,
//           // inventory_type: itemType,
//           work_order_no,
//           description,
//           quantity_available: acceptedQty,
//           rate :newGRNItem.amount,
//           total_amount: acceptedQty * newGRNItem.amount,
//           batch_no,
//           location,
//           status: 'active',
//           created_by: req.user.id,
//           updated_by: req.user.id
//         }, { transaction });
//       }
//     // }

//     const allPoItems = await PurchaseOrderItem.findAll({
//       where: { po_id: grnData.po_id },
//       transaction
//     });

//     const allGrns = await GRN.findAll({
//       where: { po_id: grnData.po_id },
//       transaction
//     });
//     const allGrnIds = allGrns.map(grn => grn.id);

//     const allGrnItems = await GRNItem.findAll({
//       where: { grn_id: allGrnIds },
//       transaction
//     });

//     // const allReceived = allPoItems.every(poItem =>
//     //   allGrnItems.some(grnItem => grnItem.po_item_id === poItem.id)
//     // );

//     const allReceived = allPoItems.every(poItem =>
//       allGrnItems
//         .filter(grnItem => grnItem.po_item_id === poItem.id)
//         .reduce((total, grnItem) => total + parseFloat(grnItem.quantity_received || 0), 0) >= parseFloat(poItem.quantity || 0)
//     );

//     await PurchaseOrder.update(
//       { po_status: allReceived ? "received" : "partialy-recieved" },
//       { where: { id: grnData.po_id }, transaction }      
//     );

//     await transaction.commit();

//     return res.status(200).json({
//       success: true,
//       message: "GRN and inventory updated successfully",
//       data: newGRN
//     });

//   } catch (error) {
//     await transaction.rollback();
//     console.error("GRN creation error:", error);
//     return res.status(500).json({
//       success: false,
//       message: `GRN creation failed: ${error.message}`
//     });
//   }
// });










v1Router.post("/grn", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const grn_generate_id = await generateId(req.user.company_id, GRN, "grn");
    const inventory_generate_id = await generateId(req.user.company_id, Inventory, "inventory");
    const { items, ...grnData } = req.body;

    grnData.created_by = req.user.id;
    grnData.updated_by = req.user.id;
    grnData.grn_generate_id = grn_generate_id;
    grnData.company_id = req.user.company_id;

    const validatePo = await PurchaseOrder.findOne({
      where: { id: grnData.po_id, status: "active" },
      transaction
    });

    if (!validatePo) throw new Error("Invalid or inactive Purchase Order.");

    let newGRN = null;

    for (const item of items) {
      const {
        po_item_id, item_id, item_code, grn_item_name, description,
        quantity_ordered, quantity_received, accepted_quantity,
        rejected_quantity, notes, unit_price,
        cgst, cgst_amount, sgst, sgst_amount,
        amount, tax_amount, total_amount,
        work_order_no, batch_no, location
      } = item;

      const poItem = await PurchaseOrderItem.findOne({
        where: { id: po_item_id },
        attributes: ['quantity'],
        transaction
      });

      if (!poItem) throw new Error(`PO Item ${po_item_id} not found`);

      // Calculate cumulative accepted quantity across all GRNs
      const existingGrns = await GRNItem.findAll({
        where: { po_item_id },
        attributes: ['accepted_quantity'],
        transaction
      });

      const previouslyAcceptedQty = existingGrns.reduce((sum, item) => sum + parseFloat(item.accepted_quantity || 0), 0);
      const totalAcceptedQty = previouslyAcceptedQty + parseFloat(accepted_quantity || 0);

      const grnStatus = (totalAcceptedQty >= parseFloat(poItem.quantity))
        ? "fully_received"
        : "partially_received";

      if (!newGRN) {
        grnData.grn_status = grnStatus;
        newGRN = await GRN.create(grnData, { transaction });
      }

      const itemMaster = await ItemMaster.findOne({ where: { id: item_id }, transaction });
      if (!itemMaster) throw new Error(`Item ${item_id} not found`);

      const category = itemMaster.category;
      const sub_category = itemMaster.sub_category;

      const newGRNItem = await GRNItem.create({
        grn_id: newGRN.id,
        po_item_id,
        item_id,
        item_code,
        grn_item_name,
        description,
        quantity_ordered,
        quantity_received,
        accepted_quantity,
        rejected_quantity,
        unit_price,
        notes,
        work_order_no,
        batch_no,
        location,
        cgst, cgst_amount, sgst, sgst_amount,
        amount, tax_amount, total_amount,
        created_by: req.user.id,
        updated_by: req.user.id,
        company_id: req.user.company_id,
        grn_item_status: grnStatus
      }, { transaction });

      await Inventory.create({
        inventory_generate_id: inventory_generate_id,
        company_id: req.user.company_id,
        item_id,
        item_code,
        grn_id: newGRN.id,
        grn_item_id: newGRNItem.id,
        po_id: grnData.po_id,
        category,
        sub_category,
        po_item_id,
        work_order_no,
        description,
        quantity_available: parseFloat(accepted_quantity),
        rate: newGRNItem.amount,
        total_amount: parseFloat(accepted_quantity) * newGRNItem.amount,
        batch_no,
        location,
        status: 'active',
        created_by: req.user.id,
        updated_by: req.user.id
      }, { transaction });
    }

    const allPoItems = await PurchaseOrderItem.findAll({ where: { po_id: grnData.po_id }, transaction });
    const allGrns = await GRN.findAll({ where: { po_id: grnData.po_id }, transaction });
    const allGrnIds = allGrns.map(grn => grn.id);
    const allGrnItems = await GRNItem.findAll({ where: { grn_id: allGrnIds }, transaction });

    const allReceived = allPoItems.every(poItem =>
      allGrnItems
        .filter(grnItem => grnItem.po_item_id === poItem.id)
        .reduce((total, grnItem) => total + parseFloat(grnItem.accepted_quantity || 0), 0) >= parseFloat(poItem.quantity || 0)
    );

    await PurchaseOrder.update(
      { po_status: allReceived ? "received" : "partialy-recieved" },
      { where: { id: grnData.po_id }, transaction }
    );

    await transaction.commit();
    return res.status(200).json({ success: true, message: "GRN and inventory updated successfully", data: newGRN });

  } catch (error) {
    await transaction.rollback();
    console.error("GRN creation error:", error);
    return res.status(500).json({ success: false, message: `GRN creation failed: ${error.message}` });
  }
});

















v1Router.get("/grn", authenticateJWT, async (req, res) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, parseInt(limit));
    const offset = (pageNumber - 1) * limitNumber;

    const whereCondition = {};
whereCondition.status="active"
    // Enhanced search functionality across all relevant fields
    if (search.trim() !== "") {
      whereCondition[Op.or] = [
        { delivery_note_no: { [Op.like]: `%${search}%` } },
        { invoice_no: { [Op.like]: `%${search}%` } },
        { received_by: { [Op.like]: `%${search}%` } }
      ];
      
      // If search could be a number (for po_id)
      if (!isNaN(search)) {
        whereCondition[Op.or].push({ po_id: parseInt(search) });
      }
    }

    const grns = await GRN.findAll({
      where: whereCondition,
      limit: limitNumber,
      offset,
      include: [
        { model: GRNItem },
        {
        model: PurchaseOrder,
        as: 'purchase_order',
        attributes: ['id', 'purchase_generate_id'], // fetch only what's needed
        required: false
        }
      ],
      order: [['updated_at', 'DESC']] 
    });
    

    const totalCount = await GRN.count({ where: whereCondition });

    return res.status(200).json({
      success: true,
      message: "GRNs fetched successfully",
      data: grns,
      totalCount,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalCount / limitNumber),
        pageSize: limitNumber,
        totalRecords: totalCount
      }
    });

  } catch (error) {
    console.error("Error fetching GRNs:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

//  get one grn 
v1Router.get("/grn/:id", authenticateJWT, async (req, res) => {
    try {
      const grnId = req.params.id;
  
      // Fetch GRN
      const grn = await GRN.findOne({
        where: { id: grnId },
        include: [
          {
            model: GRNItem,
            as: "GRNItems", // Ensure alias matches your association
            include: [
            {
              model: ItemMaster,
              as: "item_info", // Alias from GRNItem → ItemMaster association
              attributes: ["id", "item_generate_id"]
            },
          ]
          },
          {
          model: PurchaseOrder,
          as: "purchase_order",
          include: [
            {
              model: PurchaseOrderItem,
              as: "PurchaseOrderItems"
            }
          ]
        }
        ]
      });
  
      if (!grn) {
        return res.status(404).json({
          success: false,
          message: "GRN not found"
        });
      }
  
      return res.status(200).json({
        success: true,
        message: "GRN fetched successfully",
        data: grn
      });
    } catch (error) {
      console.error("Fetch GRN error:", error.message);
      return res.status(500).json({
        success: false,
        message: `Error fetching GRN: ${error.message}`
      });
    }
  });
  
  


//   update grn 
v1Router.put("/grn/:id", authenticateJWT, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const { items, ...grnData } = req.body;
      const grnId = req.params.id;
  
      const grn = await GRN.findOne({ where: { id: grnId }, transaction });
  
      if (!grn) {
        return res.status(404).json({ success: false, message: "GRN not found" });
      }
  
      grnData.updated_by = req.user.id;
      await grn.update(grnData, { transaction });
  
      // Delete old items
      await GRNItem.destroy({ where: { grn_id: grnId }, transaction });
  
      for (const item of items) {
        item.grn_id = grnId;
        item.created_by = req.user.id;
        item.updated_by = req.user.id;
        item.company_id = req.user.company_id;
  
        await GRNItem.create(item, { transaction });
      }



       const poId = grn.po_id;

      const allPoItems = await PurchaseOrderItem.findAll({
        where: { po_id: poId },
        transaction,
      });
      
      const allGrns = await GRN.findAll({
        where: { po_id: poId },
        transaction,
      });
      const allGrnIds = allGrns.map(grn => grn.id);

      const allGrnItems = await GRNItem.findAll({
        where: { grn_id: allGrnIds },
        transaction,
      });



    const allReceived = allPoItems.every(poItem =>
      allGrnItems
        .filter(grnItem => grnItem.po_item_id === poItem.id)
        .reduce((total, grnItem) => total + parseFloat(grnItem.quantity_received || 0), 0) >= parseFloat(poItem.quantity || 0)
    );

          console.log("allReceived", allReceived);

      await PurchaseOrder.update(
        { po_status: allReceived ? "received" : "partialy-recieved" },
        { where: { id: poId }, transaction }
      );

      const currentGrnItems = await GRNItem.findAll({ where: { grn_id: grnId }, transaction });
      for (const grnItem of currentGrnItems) {
        const totalAccepted = allGrnItems
          .filter(g => g.po_item_id === grnItem.po_item_id)
          .reduce((sum, g) => sum + parseFloat(g.accepted_quantity || 0), 0);

        const poItem = allPoItems.find(p => p.id === grnItem.po_item_id);
        const expectedQty = parseFloat(poItem?.quantity || 0);

        const status = totalAccepted >= expectedQty ? "fully_received" : "partially_received";

        await grnItem.update({ grn_item_status: status }, { transaction });
      }

      console.log("allReceived", allReceived);
  
      await transaction.commit();
  
      return res.status(200).json({
        success: true,
        message: "GRN updated successfully",
        data: grn,
      });
  
    } catch (error) {
      await transaction.rollback();
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  
//   delete grn 
v1Router.delete("/grn/:id", authenticateJWT, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const grnId = req.params.id;
  
      const grn = await GRN.findOne({ where: { id: grnId }, transaction });
  
      if (!grn) {
        return res.status(404).json({ success: false, message: "GRN not found" });
      }
  
      // Optionally delete GRN items
    //   await GRNItem.destroy({ where: { grn_id: grnId }, transaction });
  
      // Soft delete or hard delete depending on your model setup
      await grn.update({ status: "inactive", updated_by: req.user.id },{ transaction });

  
      await transaction.commit();
  
      return res.status(200).json({
        success: true,
        message: "GRN deleted successfully"
      });
  
    } catch (error) {
      await transaction.rollback();
      return res.status(500).json({ success: false, message: error.message });
    }
  });
  
  



app.use("/api", v1Router);
// await db.sequelize.sync();
const PORT = process.env.PORT_GRN;
app.listen(process.env.PORT_GRN,'0.0.0.0', () => {
  console.log(`Purchase running on port ${process.env.PORT_GRN}`);
});