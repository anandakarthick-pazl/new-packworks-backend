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


dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();





v1Router.post("/grn", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
        const grn_generate_id = await generateId(req.user.company_id, GRN, "grn");
    
    const { items, ...grnData } = req.body;

    // Add user info
    grnData.created_by = req.user.id;
    grnData.grn_generate_id = grn_generate_id;
    grnData.updated_by = req.user.id;
    grnData.company_id = req.user.company_id;

    // Validate PO
    const validatePo = await PurchaseOrder.findOne({
      where: { id: grnData.po_id, status: "active" },
      transaction
    });

    if (!validatePo) {
      throw new Error("Invalid or inactive Purchase Order.");
    }

    // Create GRN
    const newGRN = await GRN.create(grnData, { transaction });

    // Loop through items
    for (const item of items) {
      const {
        po_item_id,
        item_id,
        item_code,
        grn_item_name,
        description,
        quantity_ordered,
        quantity_received,
        accepted_quantity,
        rejected_quantity,
        notes,
        work_order_no,
        batch_no,
        location
      } = item;

      // Validate PO item
      const poItem = await PurchaseOrderItem.findOne({
        where: { id: po_item_id },
        transaction
      });
      if (!poItem) throw new Error(`PO Item ${po_item_id} not found`);

      // Validate Item Master
      const itemMaster = await ItemMaster.findOne({
        where: { id: item_id },
        transaction
      });
      if (!itemMaster) throw new Error(`Item ${item_id} not found`);

      const itemType = itemMaster.item_type;

      // Create GRN Item
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
        notes,
        work_order_no,
        batch_no,
        location,
        created_by: req.user.id,
        updated_by: req.user.id,
        company_id: req.user.company_id
      }, { transaction });

      // Update or Create Inventory
      const existingInventory = await Inventory.findOne({
        where: {
          item_id,
          batch_no: batch_no || null,
          location: location || null,
          status: 'active'
        },
        transaction
      });

      const acceptedQty = parseFloat(accepted_quantity) || 0;

      if (existingInventory) {
        existingInventory.quantity_available = (parseFloat(existingInventory.quantity_available) || 0) + acceptedQty;
        existingInventory.updated_by = req.user.id;
        await existingInventory.save({ transaction });
      } else {
        await Inventory.create({
          company_id: req.user.company_id,
          item_id,
          item_code,
          grn_id: newGRN.id,
          grn_item_id: newGRNItem.id,
          po_id: grnData.po_id,
          inventory_type: itemType,
          work_order_no,
          description,
          quantity_available: acceptedQty,
          batch_no,
          location,
          status: 'active',
          created_by: req.user.id,
          updated_by: req.user.id
        }, { transaction });
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "GRN and inventory updated successfully",
      data: newGRN
    });

  } catch (error) {
    await transaction.rollback();
    console.error("GRN creation error:", error.message);
    return res.status(500).json({
      success: false,
      message: `GRN creation failed: ${error.message}`
    });
  }
});

// v1Router.post("/grn", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();
//   try {
//     const { items, ...grnData } = req.body;
//     const { po_id } = grnData;


//     // Add user info
//     grnData.created_by = req.user.id;
//     grnData.updated_by = req.user.id;
//     grnData.company_id = req.user.company_id;

//     // Validate PO
//     const validatePo = await PurchaseOrder.findOne({
//       where: { id: grnData.po_id, status: "active" },
//       transaction
//     });

//     if (!validatePo) {
//       throw new Error("Invalid or inactive Purchase Order.");
//     }

//     // Create GRN
//     const newGRN = await GRN.create(grnData, { transaction });

//     console.log("New GRN created with items:");

//     // Loop through items
//     for (const item of items) {
//       const {
//         po_item_id,
//         item_id,
//         item_code,
//         grn_item_name,
//         description,
//         quantity_ordered,
//         quantity_received,
//         accepted_quantity,
//         rejected_quantity,
//         notes,
//         work_order_no,
//         batch_no,
//         location
//       } = item;

//       // Validate PO item
//       const poItem = await PurchaseOrderItem.findOne({
//         where: { id:po_item_id },
//         transaction
//       });
//       if (!poItem) throw new Error(`PO Item ${po_item_id} not found`);

//       // Validate Item Master
//       const itemMaster = await ItemMaster.findOne({
//         where: { id:item_id },
//         transaction
//       });
//       if (!itemMaster) throw new Error(`Item ${item_id} not found`);
//       let itemType=itemMaster.item_type;

//       // Create GRN Item
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
//         notes,
//         work_order_no,
//         batch_no,
//         location,
//         created_by: req.user.id,
//         updated_by: req.user.id,
//         company_id: req.user.company_id
//       }, { transaction });

//       // Update Inventory with accepted_quantity only
//       const existingInventory = await Inventory.findOne({
//         where: {
//           item_id,
//           // batch_no: batch_no || null,
//           location: location || null,
//           status: 'active'
//         },
//         transaction
//       });

//       console.log("Existing Inventory:", existingInventory);
      

//       if (existingInventory) {
//         console.log("existing inventory:", existingInventory.quantity_available);
//         console.log("accepted quantity:", accepted_quantity);
        
        
//         const currentQty = parseFloat(existingInventory.quantity_available) || 0;
//         const acceptedQty = parseFloat(accepted_quantity) || 0;
//         existingInventory.quantity_available = currentQty + acceptedQty;
        
//         console.log("newGRNItem inventory:", newGRNItem.quantity_available);

//         existingInventory.updated_by = req.user.id;
//         await existingInventory.save({ transaction });
//       } else {
//         console.log('test',existingInventory);
//         await Inventory.create({
//           company_id: req.user.company_id,
//           item_id,
//           item_code,
//           grn_id: newGRN.grn_id,
//           grn_item_id: newGRNItem.grn_item_id,
//           po_id,
//           inventory_type: itemType,
//           work_order_no,
//           description,
//           quantity_available: accepted_quantity,
//           batch_no,
//           location,
//           status: 'active',
//           created_by: req.user.id,
//           updated_by: req.user.id
//         }, { transaction });
//       }
//     }

//     await transaction.commit();

//     return res.status(200).json({
//       success: true,
//       message: "GRN and inventory updated successfully",
//       data: newGRN
//     });

//   } catch (error) {
//     await transaction.rollback();
//     console.error("GRN creation error:", error.message);
//     return res.status(500).json({
//       success: false,
//       message: `GRN creation failed: ${error.message}`
//     });
//   }
// });


















// get grn 
v1Router.get("/grn", authenticateJWT, async (req, res) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, parseInt(limit));
    const offset = (pageNumber - 1) * limitNumber;

    const whereCondition = {};

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
      include: [{ model: GRNItem }],
      order: [['updated_at', 'DESC']] 
    });
    console.log("grns",grns);
    

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
            as: "GRNItems" // Ensure alias matches your association
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
await db.sequelize.sync();
const PORT = process.env.PORT_GRN;
app.listen(process.env.PORT_GRN,'0.0.0.0', () => {
  console.log(`Purchase running on port ${process.env.PORT_GRN}`);
});