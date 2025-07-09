import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
import moment from "moment-timezone";
import Employee from "../../common/models/employee.model.js";

const Company = db.Company;
const User =db.User;
const ProductionSchedule = db.ProductionSchedule;
const ProductionGroup = db.ProductionGroup;
const WorkOrder = db.WorkOrder;
const GroupHistory = db.GroupHistory; // Assuming you have a GroupHistory model
const AllocationHistory = db.AllocationHistory; // Assuming you have an AllocationHistory model
const ItemMaster = db.ItemMaster; // Assuming you have an ItemMaster model
const Inventory = db.Inventory; // Assuming you have an Inventory model
const Machine = db.Machine; // Assuming you have a Machine model
// const SKU = db.Sku; // Assuming you have a SKU model


dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();


//get group_history
v1Router.get('/group/history/:group_id', async (req, res) => {
  try {
    const { group_id } = req.params;

    // 1. Get the production schedule
    const productionSchedule = await ProductionSchedule.findOne({
      where: {
        group_id: group_id,
        status: 'active'
      },
      attributes: [
        'id',
        'production_schedule_generate_id',
        'employee_id',
        'machine_id',
        'group_id'
      ]
    });

    if (!productionSchedule) {
      return res.status(404).json({
        success: false,
        message: 'Production schedule not found or inactive'
      });
    }

    // 2. Get ALL group history records for this schedule
    const groupHistories = await sequelize.query(`
      SELECT 
        id,
        start_time, 
        end_time, 
        group_manufactured_quantity, 
        employee_id, 
        machine_id
      FROM group_history
      WHERE production_schedule_id = :scheduleId
      AND status = 'active'
      ORDER BY created_at DESC
    `, {
      replacements: { scheduleId: productionSchedule.id },
      type: sequelize.QueryTypes.SELECT
    });

    // 3. Enrich each history with employee and machine details
    const enrichedHistories = await Promise.all(groupHistories.map(async (history) => {
      // Fetch employee
      const employee = await Employee.findOne({
        where: { id: history.employee_id },
        attributes: ['id', 'slack_username']
      });

      // Fetch machine
      const machine = await Machine.findOne({
        where: { id: history.machine_id },
        attributes: ['id', 'machine_name']
      });

      return {
        id: history.id,
        start_time: history.start_time,
        end_time: history.end_time,
        group_manufactured_quantity: history.group_manufactured_quantity,
        employee: employee ? {
          id: employee.id,
          name: employee.slack_username
        } : null,
        machine: machine ? {
          id: machine.id,
          name: machine.machine_name
        } : null
      };
    }));

    // 4. Get production group
    const productionGroup = await ProductionGroup.findOne({
      where: {
        id: group_id,
        status: 'active'
      },
      attributes: [
        'id',
        'production_group_generate_id',
        'group_name',
        'group_Qty',
        'balance_manufacture_qty',
        'group_status'
      ]
    });

    if (!productionGroup) {
      return res.status(404).json({
        success: false,
        message: 'Production group not found or inactive'
      });
    }

    // 5. Respond
    return res.json({
      success: true,
      data: {
        production_group: {
          id: productionGroup.id,
          group_Qty: productionGroup.group_Qty,
          generate_id: productionGroup.production_group_generate_id,
          balance_manufacture_qty: productionGroup.balance_manufacture_qty,
          group_name: productionGroup.group_name,
          group_status: productionGroup.group_status
           
        },
        production_histories: enrichedHistories
      }
    });

  } catch (error) {
    console.error("Error fetching group history:", error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});






//create
v1Router.post("/create", authenticateJWT, async (req, res) => {
  try {
    const { employee_id, start_time, end_time, group_id, machine_id, ...restData } = req.body;

    // Validate time fields
    if (!start_time || !end_time) {
      return res.status(400).json({ success: false, message: "start_time and end_time are required" });
    }

    const parsedStartTime = new Date(start_time);
    const parsedEndTime = new Date(end_time);

    if (isNaN(parsedStartTime.getTime()) || isNaN(parsedEndTime.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format for start_time or end_time" });
    }

    // Validate employee
    const employee = await Employee.findOne({
      where: {
        company_id: req.user.company_id,
        id: employee_id,
      },
      attributes: ["id", "user_id", "company_id"],
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Generate production schedule ID
    const production_schedule_generate_id = await generateId(
      req.user.company_id,
      ProductionSchedule,
      "production_schedule"
    );

    
    // Create production schedule
    const schedule = await ProductionSchedule.create({
      ...restData,
      employee_id: employee.id,
      user_id: employee.user_id,
      company_id: req.user.company_id,
      created_by: req.user.id,
      production_schedule_generate_id,
      group_id,
      start_time: parsedStartTime,
      end_time: parsedEndTime,
      machine_id
    });

    return res.status(200).json({
      success: true,
      message: "Production schedule and group history created successfully",
      data: {
        schedule
      }
    });

  } catch (err) {
    console.error("Error creating production schedule:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create production schedule",
      error: err.message,
    });
  }
});

//get all -work
v1Router.get("/get-all", authenticateJWT, async (req, res) => {
  const userId = req.user.id;
  console.log("Fetching all production schedules for user:", userId, "in company:", req.user.company_id);

  try {
    const {
      startDate, endDate, date, month, year, today, thisWeek, thisMonth
    } = req.query;

    let whereCondition = {
      company_id: req.user.company_id,
      status: "active",
    };

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];

    // Date filter logic
    if (date) {
      whereCondition.date = date;
    } else if (today === 'true') {
      whereCondition.date = currentDate;
    } else if (thisWeek === 'true') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      whereCondition.date = {
        [Op.between]: [
          startOfWeek.toISOString().split('T')[0],
          endOfWeek.toISOString().split('T')[0]
        ]
      };
    } else if (thisMonth === 'true') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      whereCondition.date = {
        [Op.between]: [
          startOfMonth.toISOString().split('T')[0],
          endOfMonth.toISOString().split('T')[0]
        ]
      };
    } else if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      whereCondition.date = {
        [Op.between]: [
          startOfMonth.toISOString().split('T')[0],
          endOfMonth.toISOString().split('T')[0]
        ]
      };
    } else if (year) {
      whereCondition.date = {
        [Op.between]: [`${year}-01-01`, `${year}-12-31`]
      };
    } else if (startDate || endDate) {
      whereCondition.date = {};
      if (startDate) whereCondition.date[Op.gte] = startDate;
      if (endDate) whereCondition.date[Op.lte] = endDate;
    }

    // Fetch schedules
    const schedules = await ProductionSchedule.findAll({
      where: whereCondition,
      order: [["id", "DESC"]],
      raw: true
    });

    // Enrich with group balance_manufacture_qty and manufactured_qty
    const enriched = await Promise.all(
      schedules.map(async (sch) => {
        if (!sch.group_id) return sch;

        const group = await ProductionGroup.findOne({
          where: {
            id: sch.group_id,
            company_id: req.user.company_id,
          },
          attributes: ['balance_manufacture_qty', 'manufactured_qty'],
          raw: true,
        });

        return {
          ...sch,
          balance_manufacture_qty: group?.balance_manufacture_qty || 0,
          manufactured_qty: group?.manufactured_qty || 0,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: enriched,
      filters: {
        startDate, endDate, date, month, year, today, thisWeek, thisMonth
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error fetching production schedules",
      error: err.message
    });
  }
});
//get by id
v1Router.get("/get-by-id/:id", authenticateJWT, async (req, res) => {
  try {
    const schedule = await ProductionSchedule.findOne({
      where: {
        id: req.params.id,
        company_id: req.user.company_id,
      }
    });

    if (!schedule) {
      return res.status(404).json({ success: false, message: "Production schedule not found" });
    }

    return res.status(200).json({ success: true, data: schedule });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
//update
v1Router.put("/update/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const existingSchedule = await ProductionSchedule.findOne({
      where: {
        id,
        company_id: req.user.company_id,
        status: "active"
      }
    });

    if (!existingSchedule) {
      return res.status(404).json({ success: false, message: "Production schedule not found" });
    }
    await existingSchedule.update({
      ...req.body,
      updated_by: req.user.id,
      updated_at: new Date()
    });

    return res.status(200).json({
      success: true,
      message: "Production schedule updated successfully",
      data: existingSchedule
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
//delete
v1Router.delete("/delete/:id", authenticateJWT, async (req, res) => {
  try {
    const scheduleId=req.params.id;

    if(!scheduleId){
      return res.status(400).json({
        success:false,
        message:"Production schedule id is required"
      })
    }

    const schedule= await ProductionSchedule.findOne({where:{ id:scheduleId }});
    if(!schedule){
          return res.status(404).json({
            success:false,
            message : "Production schedule id is mismatch"
          })
    }
    const deletedSchedule =await ProductionSchedule.update({
        status : "inactive",
        updated_by : req.user.id,
        updated_at : new Date()
    },
    {where:{id:scheduleId}}
    );
    
    if(!deletedSchedule){
      return res.status(404).json({
        success:false,
        message : "Production schedule id is mismatch"
      })
    }
    res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

//mobile
//Get employee work order 
v1Router.get("/employee/work-order-schedule", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;
    const { progress, search } = req.query;

    // Step 1: Find the employee
    const employee = await Employee.findOne({
      where: {
        user_id: userId,
        user_source: 'both', 
        company_id: companyId,
      },
      attributes: ['id'],
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Step 2: Get employee's production schedule
    const schedules = await ProductionSchedule.findAll({
      where: {
        employee_id: employee.id,
        company_id: companyId,
      },
      order: [['start_time', 'ASC']],
    });

    if (!schedules.length) {
      return res.status(404).json({
        success: false,
        message: "No production schedules found",
      });
    }

    // Step 3: Extract unique group IDs
    const groupIds = [...new Set(schedules.map(s => s.group_id))];

    // Step 4: Fetch Production Groups
    const groupsRaw = await ProductionGroup.findAll({
      where: {
        company_id: companyId,
        id: groupIds,
      },
      raw: true,
    });

    // Step 5: Build map of work_order_id → [group_id]
    const workOrderGroupMap = {};

    groupsRaw.forEach(group => {
      let parsedValue = [];
      try {
        parsedValue = group.group_value ? JSON.parse(group.group_value) : [];
      } catch (err) {
        console.error("Invalid group_value JSON:", group.group_value);
      }

      parsedValue.forEach(item => {
        const workOrderId = item.work_order_id;
        if (workOrderId) {
          if (!workOrderGroupMap[workOrderId]) {
            workOrderGroupMap[workOrderId] = new Set();
          }
          workOrderGroupMap[workOrderId].add(group.id);
        }
      });
    });

    // Step 6: Fetch work order details
    const workOrderIds = Object.keys(workOrderGroupMap);

    const workOrderFilter = {
          company_id: companyId,
          id: workOrderIds,
        };

        if (progress) {
          workOrderFilter.progress = progress;
        }

        if (search) {
          workOrderFilter[Op.or] = [
            {
              work_generate_id: {
                [Op.like]: `%${search}%`
              }
            },
            {
              priority: {
                [Op.like]: `%${search}%`
              }
            }
          ];
        }

    // const workOrders = await WorkOrder.findAll({
    //   where: {
    //     id: workOrderIds,
    //     company_id: companyId,
    //   },
    //   raw: true,
    // });

    const workOrders = await WorkOrder.findAll({
      where: workOrderFilter,
      // include: [
      //   {
      //     model: SKU,
      //     as: 'sku_id',
      //     attributes: ['sku_generate_id'],
      //   }
      // ],
      raw: true,
    });

    // Step 7: Parse work_order_sku_values and attach group_ids
    const result = workOrders.map(wo => {
      let parsedSkuValues = [];
      try {
        parsedSkuValues = wo.work_order_sku_values ? JSON.parse(wo.work_order_sku_values) : [];
      } catch (err) {
        console.error("Invalid JSON in work_order_sku_values:", wo.work_order_sku_values);
      }

      return {
        ...wo,
        work_order_sku_values: parsedSkuValues,
        group_ids: Array.from(workOrderGroupMap[wo.id] || []),
      };
    });

    // Step 8: Send response
    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (err) {
    console.error("Error in /employee/work-order-schedule:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching work order schedule",
      error: err.message,
    });
  }
});

// Get employee production group schedule
// v1Router.get("/employee/group-schedule", authenticateJWT, async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const companyId = req.user.company_id;
//     const { group_status, search } = req.query;

//     // Find the employee
//     const employee = await Employee.findOne({
//       where: { user_id: userId, company_id: companyId },
//       attributes: ['id'],
//     });

//     if (!employee) {
//       return res.status(404).json({ success: false, message: "Employee not found" });
//     }

//     // Get production schedules for the employee
//     const schedules = await ProductionSchedule.findAll({
//       where: { employee_id: employee.id, company_id: companyId },
//       order: [['start_time', 'ASC']],
//     });

//     if (!schedules.length) {
//       return res.status(404).json({ success: false, message: "No production schedules found" });
//     }

//     // Extract unique group IDs from schedules
//     const groupIds = [...new Set(schedules.map(s => s.group_id))];

//     // Build where clause for ProductionGroup
//     let groupWhereClause = {
//       company_id: companyId,
//       id: groupIds,
//     };

//     // Apply search filter
//     if (search) {
//       groupWhereClause[Op.or] = [
//         { production_group_generate_id: { [Op.like]: `%${search}%` } },
//         { group_name: { [Op.like]: `%${search}%` } },
//         { group_status: { [Op.like]: `%${search}%` } }
//       ];
//     }

//     // Apply group_status filter
//     if (group_status) {
//       const statusArray = group_status.split(',').map(s => s.trim()).filter(s => s.length > 0);
      
//       if (statusArray.length > 0) {
//         groupWhereClause.group_status = statusArray.length > 1
//           ? { [Op.in]: statusArray }
//           : statusArray[0];
//       }
//     }

//     // Fetch production groups with filters applied
//     const groupsRaw = await ProductionGroup.findAll({
//       where: groupWhereClause,
//       raw: true,
//     });

//     // Process each group to include work order details
//     const result = await Promise.all(groupsRaw.map(async (group) => {
//       let parsedGroupValue = [];
//       try {
//         parsedGroupValue = group.group_value ? JSON.parse(group.group_value) : [];
//       } catch (err) {
//         console.error("Invalid group_value JSON:", group.group_value);
//       }

//       // Extract work order IDs from group value
//       const workOrderIds = [...new Set(parsedGroupValue.map(item => item.work_order_id).filter(Boolean))];

//       // Fetch work orders
//       const workOrders = await WorkOrder.findAll({
//         where: {
//           id: workOrderIds,
//           company_id: companyId,
//         },
//         raw: true,
//       });

//       // Create work order map with parsed SKU values
//       const workOrderMap = {};
//       for (const order of workOrders) {
//         try {
//           const parsedSku = order.work_order_sku_values ? JSON.parse(order.work_order_sku_values) : [];
//           workOrderMap[order.id] = {
//             ...order,
//             work_order_sku_values: parsedSku,
//           };
//         } catch (e) {
//           console.error("Invalid work_order_sku_values JSON:", order.work_order_sku_values);
//           workOrderMap[order.id] = {
//             ...order,
//             work_order_sku_values: [],
//           };
//         }
//       }

//       // Build layers with work order details
//       const layers = parsedGroupValue.map((item) => {
//         const wo = workOrderMap[item.work_order_id];
//         const layerDetail = wo?.work_order_sku_values?.find(l => l.layer_id === item.layer_id);

//         return {
//           ...(layerDetail || {}),
//           work_order_id: item.work_order_id,
//           work_generate_id: wo?.work_generate_id,
//           sku_name: wo?.sku_name,
//           priority: wo?.priority,
//           edd: wo?.edd,
//           stage: wo?.stage,
//         };
//       });

//       return {
//         id: group.id,
//         production_group_generate_id: group.production_group_generate_id,
//         group_name: group.group_name,
//         group_status: group.group_status,
//         group_Qty: group.group_Qty,
//         manufactured_qty: group.manufactured_qty || 0,
//         balance_manufacture_qty: group.balance_manufacture_qty || 0,
//         layers: layers,
//       };
//     }));

//     return res.status(200).json({
//       success: true,
//       data: result.length === 1 ? result[0] : result,
//     });

//   } catch (err) {
//     console.error("Error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while fetching group schedule",
//       error: err.message,
//     });
//   }
// });

v1Router.get("/employee/group-schedule", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;
    const { group_status, search } = req.query;

    // Find the employee
    const employee = await Employee.findOne({
      where: { user_id: userId, company_id: companyId, user_source: 'both' },
      attributes: ['id'],
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Get production schedules for the employee
    const schedules = await ProductionSchedule.findAll({
      where: { employee_id: employee.id, company_id: companyId },
      order: [['start_time', 'ASC']],
    });

    if (!schedules.length) {
      return res.status(404).json({ success: false, message: "No production schedules found" });
    }

    // Extract unique group IDs from schedules
    const groupIds = [...new Set(schedules.map(s => s.group_id))];

    // Build where clause for ProductionGroup
    let groupWhereClause = {
      company_id: companyId,
      id: groupIds,
    };

    // Apply search filter
    if (search) {
      groupWhereClause[Op.or] = [
        { production_group_generate_id: { [Op.like]: `%${search}%` } },
        { group_name: { [Op.like]: `%${search}%` } },
        { group_status: { [Op.like]: `%${search}%` } }
      ];
    }

    // Apply group_status filter
    if (group_status) {
      const statusArray = group_status.split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (statusArray.length > 0) {
        groupWhereClause.group_status = statusArray.length > 1
          ? { [Op.in]: statusArray }
          : statusArray[0];
      }
    }

    // Fetch production groups
    const groupsRaw = await ProductionGroup.findAll({
      where: groupWhereClause,
      raw: true,
    });

    // Process each group
    const result = await Promise.all(groupsRaw.map(async (group) => {
      let parsedGroupValue = [];
      try {
        parsedGroupValue = group.group_value ? JSON.parse(group.group_value) : [];
      } catch (err) {
        console.error("Invalid group_value JSON:", group.group_value);
      }

      // Extract work order IDs
      const workOrderIds = [...new Set(parsedGroupValue.map(item => item.work_order_id).filter(Boolean))];

      // Fetch work orders
      const workOrders = await WorkOrder.findAll({
        where: {
          id: workOrderIds,
          company_id: companyId,
        },
        raw: true,
      });

      const workOrderMap = {};
      for (const order of workOrders) {
        try {
          const parsedSku = order.work_order_sku_values ? JSON.parse(order.work_order_sku_values) : [];
          workOrderMap[order.id] = {
            ...order,
            work_order_sku_values: parsedSku,
          };
        } catch (e) {
          console.error("Invalid work_order_sku_values JSON:", order.work_order_sku_values);
          workOrderMap[order.id] = {
            ...order,
            work_order_sku_values: [],
          };
        }
      }

      // Build layers with work order details
      const layers = parsedGroupValue.map((item) => {
        const wo = workOrderMap[item.work_order_id];
        const layerDetail = wo?.work_order_sku_values?.find(l => l.layer_id === item.layer_id);

        return {
          ...(layerDetail || {}),
          work_order_id: item.work_order_id,
          work_generate_id: wo?.work_generate_id,
          sku_name: wo?.sku_name,
          priority: wo?.priority,
          edd: wo?.edd,
          stage: wo?.stage,
        };
      });

      // ✅ Fetch AllocationHistory for this group
      const allocations = await AllocationHistory.findAll({
        where: {
          group_id: group.id,
          company_id: companyId,
        },
        attributes: ['inventory_id'],
        raw: true,
      });

      // ✅ Get unique inventory IDs
      const uniqueInventoryIds = [...new Set(allocations.map(a => a.inventory_id))];

      // ✅ Fetch Inventory
      const inventories = await Inventory.findAll({
        where: {
          id: uniqueInventoryIds,
          company_id: companyId,
        },
        attributes: ['id', 'item_id', 'inventory_generate_id', 'qr_code_url'],
        raw: true,
      });

      // ✅ Get item IDs from inventories
      const itemIds = inventories.map(i => i.item_id);

      // ✅ Fetch Items
      const items = await ItemMaster.findAll({
        where: {
          id: itemIds,
          company_id: companyId,
        },
        attributes: ['id', 'item_name'],
        raw: true,
      });

      // ✅ Maps for quick access
      const inventoryMap = Object.fromEntries(inventories.map(inv => [inv.id, inv]));
      const itemMap = Object.fromEntries(items.map(it => [it.id, it]));

      // ✅ Build unique inventory details
      const inventoryDetails = uniqueInventoryIds.map(inventoryId => {
        const inv = inventoryMap[inventoryId];
        const item = itemMap[inv?.item_id];
        return {
          inventory_generate_id: inv?.inventory_generate_id ?? null,
          qr_code_url: inv?.qr_code_url ?? null,
          item_name: item?.item_name ?? null,
        };
      });

      return {
        id: group.id,
        production_group_generate_id: group.production_group_generate_id,
        group_name: group.group_name,
        group_status: group.group_status,
        group_Qty: group.group_Qty,
        manufactured_qty: group.manufactured_qty || 0,
        balance_manufacture_qty: group.balance_manufacture_qty || 0,
        layers: layers,
        inventories: inventoryDetails, // ✅ final clean list
      };
    }));

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching group schedule",
      error: err.message,
    });
  }
});

// get group view 
v1Router.get("/group/:id", authenticateJWT, async (req, res) => {
  try {
    const groupId = req.params.id;
    const companyId = req.user.company_id;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: "Group ID is required",
      });
    }

    // Fetch the group
    const group = await ProductionGroup.findOne({
      where: {
        id: groupId,
        company_id: companyId,
      },
      raw: true,
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Production group not found",
      });
    }

    // Parse group_value
    let parsedGroupValue = [];
    try {
      parsedGroupValue = group.group_value ? JSON.parse(group.group_value) : [];
    } catch (err) {
      console.error("Invalid group_value JSON:", group.group_value);
    }

    // Get unique work_order_ids
    const workOrderIds = [...new Set(parsedGroupValue.map(item => item.work_order_id).filter(Boolean))];

    // Fetch related work orders
    const workOrders = await WorkOrder.findAll({
      where: {
        id: workOrderIds,
        company_id: companyId
      },
      raw: true,
    });

    // Map work orders with parsed SKU values
    const workOrderMap = {};
    for (const order of workOrders) {
      let parsedSkus = [];
      try {
        parsedSkus = order.work_order_sku_values
          ? JSON.parse(order.work_order_sku_values)
          : [];
      } catch (err) {
        console.error("Invalid work_order_sku_values JSON for order:", order.id);
      }

      workOrderMap[order.id] = {
        ...order,
        work_order_sku_values: parsedSkus,
      };
    }

    // Build enriched layer list
    const enrichedLayers = parsedGroupValue.map(item => {
      const workOrder = workOrderMap[item.work_order_id];
      if (!workOrder) return null;

      const layerDetail = workOrder.work_order_sku_values.find(l => l.layer_id === item.layer_id);

      return {
        ...layerDetail,
        work_order_id: item.work_order_id,
        work_generate_id: workOrder.work_generate_id,
        sku_name: workOrder.sku_name,
        priority: workOrder.priority,
        edd: workOrder.edd,
        stage: workOrder.stage
      };
    }).filter(Boolean);

    // Fetch latest production schedule for this group
    const productionSchedule = await ProductionSchedule.findOne({
      where: {
        group_id: groupId,
        company_id: companyId,
        status: "active"
      },
      order: [["id", "DESC"]],
      attributes: [
        "production_status"
      ],
      raw: true
    });

    // Final response
    return res.status(200).json({
      success: true,
      data: {
        id: group.id,
        production_group_generate_id: group.production_group_generate_id,
        group_name: group.group_name,
        group_status: group.group_status,
        group_Qty: group.group_Qty,
        manufactured_qty: group.manufactured_qty || 0,
        balance_manufacture_qty: group.balance_manufacture_qty || 0,
        layers: enrichedLayers,
        group_history: productionSchedule || null
      }
    });

  } catch (err) {
    console.error("Error fetching production group by ID:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching production group",
      error: err.message,
    });
  }
});

//update group quantity
// v1Router.patch("/group/update_quantity/:groupId", authenticateJWT, async (req, res) => {
//   const t = await sequelize.transaction();
//   try {
//     const groupId = req.params.groupId;
//     const { manufactured_quantity } = req.body;
//     const userId = req.user.id;
//     const companyId = req.user.company_id;

//     // Get employee
//     const employee = await Employee.findOne({
//       where: {
//         company_id: companyId,
//         user_source: 'both',
//         user_id: userId,
//       },
//       attributes: ["id", "company_id"],
//       transaction: t
//     });
//     if (!employee) {
//       await t.rollback();
//       return res.status(404).json({ success: false, message: "Employee not found" });
//     }
//     const employeeId = employee.id;

//     // Validate manufactured quantity
//     const usedQty = parseFloat(manufactured_quantity);
//     if (!usedQty || isNaN(usedQty) || usedQty <= 0) {
//       await t.rollback();
//       return res.status(400).json({
//         success: false,
//         message: "Used quantity must be a valid number greater than 0"
//       });
//     }

//     // Fetch ProductionGroup
//     const productionGroup = await ProductionGroup.findOne({
//       where: {
//         id: groupId,
//         company_id: companyId,
//         status: "active"
//       },
//       transaction: t
//     });
//     if (!productionGroup) {
//       await t.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "Production Group not found for this group ID"
//       });
//     }
//     const groupQty = parseFloat(productionGroup.group_Qty || 0);
//     const originalBalance = parseFloat(productionGroup.balance_manufacture_qty || 0);
//     const originalManufactured = parseFloat(productionGroup.manufactured_qty || 0);
//     const newManufacturedTotal = originalManufactured + usedQty;
//     if (usedQty > originalBalance) {
//       await t.rollback();
//       return res.status(400).json({
//         success: false,
//         message: "Used quantity cannot be greater than current balanced quantity"
//       });
//     }
//     if (newManufacturedTotal > groupQty) {
//       await t.rollback();
//       return res.status(400).json({
//         success: false,
//         message: "Total manufactured quantity cannot exceed group quantity"
//       });
//     }
//     const newBalance = groupQty - newManufacturedTotal;

//     // Find all active production schedules for this group and employee
//     const schedules = await ProductionSchedule.findAll({
//       where: {
//         group_id: groupId,
//         employee_id: employeeId,
//         company_id: companyId,
//         status: "active"
//       },
//       transaction: t
//     });
//     if (!schedules.length) {
//       await t.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "No active production schedule found for this group and employee"
//       });
//     }
//     // Use the latest schedule for history
//     const activeSchedule = schedules[0];

//     // Create new GroupHistory entry
//     const groupHistory = await GroupHistory.create({
//       company_id: companyId,
//       production_schedule_id: activeSchedule.id,
//       group_manufactured_quantity: usedQty,
//       start_time: new Date(),
//       end_time: new Date(),
//       employee_id: employeeId,
//       machine_id: activeSchedule.machine_id,
//       created_by: userId,
//       updated_by: userId
//     }, { transaction: t });

//     // Update ProductionGroup
//     await ProductionGroup.update(
//       {
//         manufactured_qty: newManufacturedTotal,
//         balance_manufacture_qty: newBalance,
//         ...(newBalance === 0 ? { production_completed: "Completed" } : {})
//       },
//       {
//         where: {
//           id: groupId,
//           company_id: companyId
//         },
//         transaction: t
//       }
//     );

//     // Update all active ProductionSchedule records for this group/employee
//     for (const schedule of schedules) {
//       schedule.group_manufactured_quantity = (parseFloat(schedule.group_manufactured_quantity || 0) + usedQty);
//       schedule.group_balanced_quantity = newBalance;
//       if (newBalance === 0) {
//         schedule.production_status = 'completed';
//       } else {
//         schedule.production_status = 'in_progress';
//       }
//       await schedule.save({ transaction: t });
//     }

//     await t.commit();
//     return res.status(200).json({
//       success: true,
//       message: "Group quantity updated and history entry created successfully",
//       data: {
//         group_id: groupId,
//         group_history_id: groupHistory.id,
//         manufactured_quantity: usedQty,
//         total_manufactured: newManufacturedTotal,
//         total_quantity: groupQty,
//         balanced_quantity: newBalance,
//         production_schedule_id: activeSchedule.id
//       }
//     });
//   } catch (err) {
//     if (t.finished !== 'commit') await t.rollback();
//     console.error("Error updating group quantity:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while updating group quantity",
//       error: err.message
//     });
//   }
// });

v1Router.patch("/group/update_quantity/:groupId", authenticateJWT, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const groupId = req.params.groupId;
    const { manufactured_quantity } = req.body;
    const userId = req.user.id;
    const companyId = req.user.company_id;

    // Get employee
    const employee = await Employee.findOne({
      where: {
        company_id: companyId,
        user_source: 'both',
        user_id: userId,
      },
      attributes: ["id", "company_id"],
      transaction: t
    });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    const employeeId = employee.id;

    // Validate manufactured quantity
    const usedQty = parseFloat(manufactured_quantity);
    if (!usedQty || isNaN(usedQty) || usedQty <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Used quantity must be a valid number greater than 0"
      });
    }

    // Fetch ProductionGroup
    const productionGroup = await ProductionGroup.findOne({
      where: {
        id: groupId,
        company_id: companyId,
        status: "active"
      },
      transaction: t
    });
    if (!productionGroup) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Production Group not found for this group ID"
      });
    }
    const groupQty = parseFloat(productionGroup.group_Qty || 0);
    const originalBalance = parseFloat(productionGroup.balance_manufacture_qty || 0);
    const originalManufactured = parseFloat(productionGroup.manufactured_qty || 0);
    const newManufacturedTotal = originalManufactured + usedQty;
    if (usedQty > originalBalance) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Used quantity cannot be greater than current balanced quantity"
      });
    }
    if (newManufacturedTotal > groupQty) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Total manufactured quantity cannot exceed group quantity"
      });
    }
    const newBalance = originalBalance - usedQty;

    // Find all active production schedules for this group and employee
    const schedules = await ProductionSchedule.findAll({
      where: {
        group_id: groupId,
        employee_id: employeeId,
        company_id: companyId,
        status: "active"
      },
      transaction: t
    });
    if (!schedules.length) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "No active production schedule found for this group and employee"
      });
    }
    // Use the latest schedule for history
    const activeSchedule = schedules[0];

    // Create new GroupHistory entry
    const groupHistory = await GroupHistory.create({
      company_id: companyId,
      production_schedule_id: activeSchedule.id,
      group_manufactured_quantity: usedQty,
      start_time: new Date(),
      end_time: new Date(),
      employee_id: employeeId,
      machine_id: activeSchedule.machine_id,
      created_by: userId,
      updated_by: userId
    }, { transaction: t });

    // Update ProductionGroup
    await ProductionGroup.update(
      {
        manufactured_qty: newManufacturedTotal,
        balance_manufacture_qty: newBalance,
        ...(newBalance === 0 ? { production_completed: "Completed" } : {})
      },
      {
        where: {
          id: groupId,
          company_id: companyId
        },
        transaction: t
      }
    );

    // Update all active ProductionSchedule records for this group/employee
    // Only update manufactured quantities, not status
    for (const schedule of schedules) {
      schedule.group_manufactured_quantity = (parseFloat(schedule.group_manufactured_quantity || 0) + usedQty);
      schedule.group_balanced_quantity = newBalance;
      await schedule.save({ transaction: t });
    }

    await t.commit();
    return res.status(200).json({
      success: true,
      message: "Group quantity updated and history entry created successfully",
      data: {
        group_id: groupId,
        group_history_id: groupHistory.id,
        manufactured_quantity: usedQty,
        total_manufactured: newManufacturedTotal,
        total_quantity: groupQty,
        balanced_quantity: newBalance,
        production_schedule_id: activeSchedule.id
      }
    });
  } catch (err) {
    if (t.finished !== 'commit') await t.rollback();
    console.error("Error updating group quantity:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while updating group quantity",
      error: err.message
    });
  }
});

app.use("/api/production-schedule", v1Router);
const PORT = process.env.PORT_PRODUCTION_SCHEDULE;
app.listen(process.env.PORT_PRODUCTION_SCHEDULE,'0.0.0.0', () => {
  console.log(`Production Schedule Service running on port ${process.env.PORT_PRODUCTION_SCHEDULE}`);
});