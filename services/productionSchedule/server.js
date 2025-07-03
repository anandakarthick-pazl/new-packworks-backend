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
// const SKU = db.Sku; // Assuming you have a SKU model


dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();

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

//     // Find employee
//     const employee = await Employee.findOne({
//       where: { user_id: userId, company_id: companyId },
//       attributes: ['id'],
//     });

//     if (!employee) {
//       return res.status(404).json({ success: false, message: "Employee not found" });
//     }

//     // Fetch employee's production schedules
//     const schedules = await ProductionSchedule.findAll({
//       where: { employee_id: employee.id, company_id: companyId },
//       order: [['start_time', 'ASC']],
//     });

//     if (!schedules.length) {
//       return res.status(404).json({ success: false, message: "No production schedules found" });
//     }

//     const groupIds = [...new Set(schedules.map(s => s.group_id))];

//     // Dynamic group where clause
//     let groupWhereClause = {
//       company_id: companyId,
//       id: groupIds,
//     };

//     // 🔍 Add search condition for group fields
//     if (search) {
//       groupWhereClause[Op.or] = [
//         { production_group_generate_id: { [Op.like]: `%${search}%` } },
//         { group_name: { [Op.like]: `%${search}%` } },
//         { group_status: { [Op.like]: `%${search}%` } }
//       ];
//     }

//     // ✅ Optional: filter by latest GroupHistory.group_status
//     if (group_status) {
//       const statusArray = group_status.split(',').map(s => s.trim());

//       const latestHistories = await GroupHistory.findAll({
//         where: {
//           group_id: { [Op.in]: groupIds },
//           company_id: companyId,
//           employee_id: employee.id,
//           status: "active",
//         },
//         attributes: [[sequelize.fn("MAX", sequelize.col("id")), "id"]],
//         group: ["group_id"]
//       });

//       const latestHistoryIds = latestHistories.map(h => h.id);

//       const histories = await GroupHistory.findAll({
//         where: {
//           id: { [Op.in]: latestHistoryIds },
//           group_status: statusArray.length > 1 ? { [Op.in]: statusArray } : statusArray[0],
//         },
//         attributes: ["group_id"],
//         raw: true,
//       });

//       const filteredGroupIds = histories.map(h => h.group_id);
//       groupWhereClause.id = filteredGroupIds.length ? filteredGroupIds : [-1]; // avoid empty IN clause
//     }

//     // Fetch ProductionGroups with filters
//     const groupsRaw = await ProductionGroup.findAll({
//       where: groupWhereClause,
//       raw: true,
//     });

//     const groups = groupsRaw.map(group => {
//       let parsedValue = [];
//       try {
//         parsedValue = group.group_value ? JSON.parse(group.group_value) : [];
//       } catch (err) {
//         console.error("Invalid group_value JSON:", group.group_value);
//       }

//       return {
//         ...group,
//         group_value: parsedValue,
//       };
//     });

//     return res.status(200).json({
//       success: true,
//       groups,
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

    const employee = await Employee.findOne({
      where: { user_id: userId, company_id: companyId },
      attributes: ['id'],
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const schedules = await ProductionSchedule.findAll({
      where: { employee_id: employee.id, company_id: companyId },
      order: [['start_time', 'ASC']],
    });

    if (!schedules.length) {
      return res.status(404).json({ success: false, message: "No production schedules found" });
    }

    const groupIds = [...new Set(schedules.map(s => s.group_id))];

    let groupWhereClause = {
      company_id: companyId,
      id: groupIds,
    };

    if (search) {
      groupWhereClause[Op.or] = [
        { production_group_generate_id: { [Op.like]: `%${search}%` } },
        { group_name: { [Op.like]: `%${search}%` } },
        { group_status: { [Op.like]: `%${search}%` } }
      ];
    }

    if (group_status) {
      groupWhereClause.group_status = group_status;
    }

    const groupsRaw = await ProductionGroup.findAll({
      where: groupWhereClause,
      raw: true,
    });

    const result = await Promise.all(groupsRaw.map(async (group) => {
      let parsedGroupValue = [];
      try {
        parsedGroupValue = group.group_value ? JSON.parse(group.group_value) : [];
      } catch (err) {
        console.error("Invalid group_value JSON:", group.group_value);
      }

      const workOrderIds = [...new Set(parsedGroupValue.map(item => item.work_order_id).filter(Boolean))];

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
          workOrderMap[order.id] = {
            ...order,
            work_order_sku_values: [],
          };
        }
      }

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

      return {
        id: group.id,
        production_group_generate_id: group.production_group_generate_id,
        group_name: group.group_name,
        group_status: group.group_status,
        group_Qty: group.group_Qty,
        manufactured_qty: group.manufactured_qty || 0,
        balance_manufacture_qty: group.balance_manufacture_qty || 0,
        layers: layers,
      };
    }));

    return res.status(200).json({
      success: true,
      data: result.length === 1 ? result[0] : result,
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
// v1Router.get("/group/:id", authenticateJWT, async (req, res) => {
//   try {
//     const groupId = req.params.id;
//     const companyId = req.user.company_id;

//     if (!groupId) {
//       return res.status(400).json({
//         success: false,
//         message: "Group ID is required",
//       });
//     }

//     // Fetch the group
//     const group = await ProductionGroup.findOne({
//       where: {
//         id: groupId,
//         company_id: companyId,
//       },
//       raw: true,
//     });

//     if (!group) {
//       return res.status(404).json({
//         success: false,
//         message: "Production group not found",
//       });
//     }

//     // Parse group_value safely
//     let parsedGroupValue = [];
//     try {
//       parsedGroupValue = group.group_value ? JSON.parse(group.group_value) : [];
//     } catch (err) {
//       console.error("Invalid group_value JSON:", group.group_value);
//     }

//     // Extract unique work_order_ids
//     const workOrderIds = [...new Set(parsedGroupValue.map(item => item.work_order_id).filter(Boolean))];

//     // Fetch all work orders
//     const workOrders = await WorkOrder.findAll({
//       where: {
//         id: workOrderIds,
//         company_id: companyId
//       },
//       raw: true,
//     });

//     // Build workOrderMap for easy lookup
//     const workOrderMap = {};
//     for (const order of workOrders) {
//       let parsedSkus = [];
//       try {
//         parsedSkus = order.work_order_sku_values
//           ? JSON.parse(order.work_order_sku_values)
//           : [];
//       } catch (err) {
//         console.error("Invalid work_order_sku_values JSON for order:", order.id);
//       }

//       workOrderMap[order.id] = {
//         ...order,
//         work_order_sku_values: parsedSkus,
//       };
//     }

//     // Construct enriched layers
//     const enrichedLayers = parsedGroupValue.map(item => {
//       const workOrder = workOrderMap[item.work_order_id];
//       if (!workOrder) return null;

//       const layerDetail = workOrder.work_order_sku_values.find(l => l.layer_id === item.layer_id);
//       return {
//         ...layerDetail,
//         work_order_id: item.work_order_id,
//         work_generate_id: workOrder.work_generate_id,
//         sku_name: workOrder.sku_name,
//         priority: workOrder.priority,
//         edd: workOrder.edd,
//         stage: workOrder.stage
//       };
//     }).filter(Boolean);

//     // Fetch latest group history for this group
//     const productionScheduleHistory = await ProductionSchedule.findOne({
//       where: {
//         group_id: groupId,
//         company_id: companyId,
//         status: "active"
//       },
//       order: [["id", "DESC"]],
//       attributes: [
        
//         "production_status"
//       ],
//       raw: true
//     });

//     // Send final response
//     return res.status(200).json({
//       success: true,
//       data: {
//         id: group.id,
//         production_group_generate_id: group.production_group_generate_id,
//         group_name: group.group_name,
//         group_status: group.group_status,
//         group_Qty: group.group_Qty,
//         layers: enrichedLayers,
//         group_history: productionScheduleHistory || null
//       }
//     });

//   } catch (err) {
//     console.error("Error fetching production group by ID:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while fetching production group",
//       error: err.message,
//     });
//   }
// });

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
v1Router.patch("/group/update_quantity/:groupId", authenticateJWT, async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const { manufactured_quantity } = req.body;
    const userId = req.user.id;
    const employee = await Employee.findOne({
      where: {
        company_id: req.user.company_id,
        user_id: userId,
      },
      attributes: ["id", "company_id"],
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const employeeId = employee.id;

    console.log("Updating group quantity for groupId:", groupId, "by employeeId:", employeeId);
    

    if (!manufactured_quantity || isNaN(manufactured_quantity) || manufactured_quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Used quantity must be a valid number greater than 0"
      });
    }

    // Fetch the latest active group history by group_id and company
    const groupHistory = await GroupHistory.findOne({
      where: {
        group_id: groupId,
        company_id: req.user.company_id,
        employee_id: employeeId,
        status: "active"
      },
      order: [['id', 'DESC']] // Get latest record
    });

    if (!groupHistory) {
      return res.status(404).json({
        success: false,
        message: "Group history not found for this group ID"
      });
    }


    console.log("Original groupHistory:", groupHistory);
    

    const originalBalance = parseFloat(groupHistory.balanced_quantity || 0);
    const usedQty = parseFloat(manufactured_quantity);

    if (usedQty > originalBalance) {
      return res.status(400).json({
        success: false,
        message: "Used quantity cannot be greater than current balanced quantity"
      });
    }

    const newBalance = originalBalance - usedQty;

    // Update the history record
    groupHistory.manufactured_quantity = usedQty;
    groupHistory.total_quantity = originalBalance;
    groupHistory.balanced_quantity = newBalance;
    groupHistory.updated_by = req.user.id;
    groupHistory.group_status = newBalance === 0 ? 'completed' : 'in_progress';

    await groupHistory.save();

    
    
    
    // ✅ Update ProductionSchedule for the group and employee
    const schedules = await ProductionSchedule.findAll({
      where: {
        group_id: groupId,
        employee_id: employeeId,
        company_id: req.user.company_id,
        status: "active"
      }
    });

    for (const schedule of schedules) {
      schedule.group_manufactured_quantity = usedQty;
      schedule.group_balanced_quantity = newBalance;
      if (newBalance === 0) {
        schedule.production_status = 'completed';
      }
      await schedule.save();
    }


    // If balance becomes 0, mark group as Completed
    if (newBalance === 0) {
      await ProductionGroup.update(
        // { group_status: "Completed" },
        { production_completed: "Completed" },
        {
          where: {
            id: groupId,
            company_id: req.user.company_id
          }
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Group history updated successfully",
      data: {
        group_id: groupId,
        total_quantity: groupHistory.total_quantity,
        manufactured_quantity: groupHistory.manufactured_quantity,
        balanced_quantity: groupHistory.balanced_quantity
      }
    });

  } catch (err) {
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