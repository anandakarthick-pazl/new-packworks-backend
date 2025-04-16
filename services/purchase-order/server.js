import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
const Company = db.Company;
const User =db.User;
const PurchaseOrder = db.PurchaseOrder;
const PurchaseOrderItem = db.PurchaseOrderItem;
const ItemMaster = db.ItemMaster;

dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();

////////////////////////////////////////////////////// Purchase Order //////////////////////////////////////////////////////////

// get PurchaseOrder  //supplier_name based search
v1Router.get("/purchase-order", authenticateJWT, async (req, res) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNumber = Math.max(1, parseInt(page) || 1);
    const limitNumber = Math.max(10, parseInt(limit) || 10);
    const offset = (pageNumber - 1) * limitNumber;
    let whereCondition = { status: "active", decision: "approve" };
    if (search.trim() !== "") {
      whereCondition = {
        ...whereCondition,
        supplier_name: { [Op.like]: `%${search}%` },
      };
    }
    const purchaseOrder = await PurchaseOrder.findAll({
      where: whereCondition,
      limit: limitNumber,
      offset,
    });
    const totalPurchaseOrders = await PurchaseOrder.count({ where: whereCondition }); 
    return res.status(200).json({
      success: true,
      message: "Purchase Orders Fetched Successfully",
      data: purchaseOrder,
      totalCount: totalPurchaseOrders,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: "Purchase Orders not found",
    });
  }
});


//create purchase order
v1Router.post("/purchase-order",authenticateJWT,async(req,res)=>{
  const transaction=await sequelize.transaction();
  try{
    const {...rest}=req.body;
    rest.created_by = req.user.id;
    rest.updated_by = req.user.id;
    rest.company_id = req.user.company_id;
    const createPurchaseOrder = await PurchaseOrder.create(rest,{transaction});
    await transaction.commit();
    return res.status(200).json({
      success : true,
      message : `Purchase order Created Successfully`,
      data : createPurchaseOrder
    });
  }catch(error){
    await transaction.rollback();
    console.error(error.message);
    return res.status(500).json({
      success:false,
      message:`Purchase Order Created Error : ${error.message}`
    })
  }
});

//edit purchase order
v1Router.get("/purchase-order/:id", authenticateJWT, async (req, res) => {
  try {
    const purchaseOrderId = req.params.id;

    if (!purchaseOrderId) {
      return res.status(400).json({
        success: false,
        message: "Purchase Order ID is required",
      });
    }

    const purchaseOrderData = await PurchaseOrder.findOne({
      where: { po_id: purchaseOrderId },
    });

    if (!purchaseOrderData) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Purchase Order Details Fetched Successfully",
      data: purchaseOrderData,
    });

  } catch (error) {
    console.error("Error fetching Purchase Order:", error.message);
    return res.status(500).json({
      success: false,
      message: `Something went wrong: ${error.message}`,
    });
  }
});


//update purchase order
v1Router.put("/purchase-order/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const poId = req.params.id;
    // const poId = parseInt(req.params.id);

    const { ...rest } = req.body;
    if (!poId) {
      return res.status(400).json({
        success: false,
        message: `Purchase Order ID is required`
      });
    }
    const purchaseOrderData = await PurchaseOrder.findOne({ where: { po_id: poId } });
    if (!purchaseOrderData) {
      return res.status(404).json({
        success: false,
        message: `Purchase Order not found`
      });
    }
    rest.updated_by = req.user.id;
    rest.updated_at = new Date();
    rest.company_id = req.user.company_id;
    await PurchaseOrder.update(rest, {
      where: { po_id: poId },
      transaction
    });
    const updatedData = await PurchaseOrder.findByPk(poId, { transaction });
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: `Purchase Order Updated Successfully`,
      data: updatedData
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `Purchase Order update error: ${error.message}`
    });
  }
});


// Delete purchase order
v1Router.delete("/purchase-order/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const poId = req.params.id;
    if (!poId) {
      return res.status(400).json({
        success: false,
        message: `ID is required`
      });
    }
    const purchaseOrderData = await PurchaseOrder.findOne({ where: { po_id: poId } });
    if (!purchaseOrderData) {
      return res.status(404).json({
        success: false,
        message: `Purchase Order not found`
      });
    }
    await PurchaseOrder.update(
      {
        status: "inactive",
        decision: "disapprove",
        updated_by: req.user.id,
        deleted_at: new Date()
      },
      { where: { po_id: poId }, transaction }
    );
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: `Purchase Order deleted (soft) successfully`,
      data: []
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `Purchase Order delete error: ${error.message}`
    });
  }
});

//////////////////////////////////////////////////////// Purchase Order Items//////////////////////////////////////////////////////

// get Purchase Order Items
v1Router.get("/purchase-order-items",authenticateJWT,async(req,res)=>{
  try{
    const {search="",page="1",limit="10"}=req.params;
    const pageNumber = Math.max(1,parseInt(page)||1);
    const limitNumber = Math.max(10,parseInt(limit)||10);
    const offset = (pageNumber-1)*limitNumber;
    const whereCondition = {status:"active"};
    if(search.trim()!=""){
      whereCondition={
        ...whereCondition,po_item_name:{[Op.like]:`%${search}%`}
      }
    }
    const purchaseOrderItem = await PurchaseOrderItem.findAll({
      where:whereCondition,
      limit:limitNumber,
      offset
    });
    const totalPurchaseOrderItem = await PurchaseOrderItem.count({where:whereCondition});
    return res.status(200).json({
      success : true,
      message : ` purchase order items Fetching Successfully`,
      data : purchaseOrderItem,
      totalCount : totalPurchaseOrderItem
    });
  }catch(error){
    console.error(error.message);
    return res.status(500).json({
      success : false,
      message : ` purchase order items Fetching error : ${error.message}`
    });
  }
});

// Create po item
v1Router.post("/purchase-order-item", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction(); 
  try {
    const { ...rest } = req.body;
    rest.created_by = req.user.id;
    rest.updated_by = req.user.id;
    rest.company_id = req.user.company_id;


    // Validate po_id
    const poId = req.body.po_id;
    const validatePo = await PurchaseOrder.findOne({
      where: { po_id: poId, status: "active" }
    });

    if (!validatePo) {
      return res.status(400).json({
        success: false,
        message: `Purchase Order is not valid or inactive.`
      });
    }

    // Validate item_id
    const itemId = req.body.item_id;
    const validateItem = await ItemMaster.findOne({
      where: { item_id: itemId, status: "active" }
    });

    if (!validateItem) {
      return res.status(400).json({
        success: false,
        message: `Item is not valid or inactive.`
      });
    }

    const createPo = await PurchaseOrderItem.create(rest, { transaction });
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: `Purchase order item created successfully`,
      data: createPo
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `Purchase Order Item creation error: ${error.message}`
    });
  }
});


// edit po item
v1Router.get("/purchase-order-item/:id", authenticateJWT, async (req, res) => {
  try {
    const poItemId = req.params.id;
    if (!poItemId) {
      return res.status(400).json({
        success: false,
        message: "Purchase Order Item ID is required",
      });
    }
    const poItemData = await PurchaseOrderItem.findOne({
      where: { po_item_id: poItemId },
    });
    if (!poItemData) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order Item not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Purchase Order Item fetched successfully",
      data: poItemData,
    });
  } catch (error) {
    console.error("Error fetching PO item:", error.message);
    return res.status(500).json({
      success: false,
      message: `Error fetching Purchase Order Item: ${error.message}`,
    });
  }
});

// update po item 
v1Router.put("/purchase-order-item/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const poItemId = req.params.id;
    const { ...rest } = req.body;

    // Validate po_id
    const poId = req.body.po_id;
    const validatePo = await PurchaseOrder.findOne({
      where: { po_id: poId, status: "active" }
    });

    if (!validatePo) {
      return res.status(400).json({
        success: false,
        message: `Purchase Order is not valid or inactive.`
      });
    }

    // Validate item_id
    const itemId = req.body.item_id;
    const validateItem = await ItemMaster.findOne({
      where: { item_id: itemId, status: "active" }
    });
    if (!validateItem) {
      return res.status(400).json({
        success: false,
        message: `Item is not valid or inactive.`
      });
    }
    if (!poItemId) {
      return res.status(400).json({
        success: false,
        message: "Purchase Order Item ID is required",
      });
    }
    const existingData = await PurchaseOrderItem.findOne({
      where: { po_item_id: poItemId },
    });
    if (!existingData) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order Item not found",
      });
    }
    rest.updated_by = req.user.id;
    rest.updated_at = new Date();
    rest.company_id = req.user.company_id;
    await PurchaseOrderItem.update(rest, {
      where: { po_item_id: poItemId },
      transaction,
    });
    const updatedpoItem = await PurchaseOrderItem.findByPk(poItemId, { transaction });
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: "Purchase Order Item updated successfully",
      data: updatedpoItem,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update error:", error.message);
    return res.status(500).json({
      success: false,
      message: `Purchase Order Item update error: ${error.message}`,
    });
  }
});

//delete po item
v1Router.delete("/purchase-order-item/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const poItemId = req.params.id;
    if (!poItemId) {
      return res.status(400).json({
        success: false,
        message: "PO Item ID is required",
      });
    }
    const poItemData = await PurchaseOrderItem.findOne({
      where: { po_item_id: poItemId },
    });
    if (!poItemData) {
      return res.status(404).json({
        success: false,
        message: "PO Item not found",
      });
    }
    await PurchaseOrderItem.update(
      {
        status: "inactive",
        updated_at: new Date(),
        updated_by: req.user.id,
        deleted_at: new Date(),
      },
      {
        where: { po_item_id: poItemId },
        transaction,
      }
    );
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: "PO Item deleted successfully",
      data: [],
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: `PO Item delete error: ${error.message}`,
    });
  }
});








//connection port
app.use("/api", v1Router);
await db.sequelize.sync();
const PORT = 3023;
app.listen(PORT, () => {
  console.log(`Purchase running on port ${PORT}`);
});