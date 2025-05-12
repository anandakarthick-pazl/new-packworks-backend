import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
// Import the Redis and RabbitMQ configurations
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";
dotenv.config();
const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const Machine = db.Machine;
const ProcessName = db.ProcessName;
const MachineProcessValue = db.MachineProcessValue;
const MachineProcessField = db.MachineProcessField;
const MachineFlow = db.MachineFlow;
const Company = db.Company;
const User = db.User;

v1Router.post("/assign", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const company_id = req.user.company_id;
    const user_id = req.user.id;
    const { assignments } = req.body;

    // Validate request body
    if (
      !assignments ||
      !Array.isArray(assignments) ||
      assignments.length === 0
    ) {
      return res.status(400).json({
        status: "error",
        message: "Please provide an array of machine and process assignments",
      });
    }

    // Validate each assignment has required fields
    const missingFields = assignments.filter(
      (item) => !item.machine_id || !item.process_id
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Each assignment must have machine_id and process_id",
      });
    }

    // Collect all machine and process IDs for validation
    const machineIds = [...new Set(assignments.map((item) => item.machine_id))];
    const processIds = [...new Set(assignments.map((item) => item.process_id))];

    // Validate all machines exist and belong to the company
    const machines = await Machine.findAll({
      where: {
        id: machineIds,
        company_id,
        status: "active",
      },
    });

    if (machines.length !== machineIds.length) {
      return res.status(404).json({
        status: "error",
        message:
          "One or more machines not found or do not belong to your company",
      });
    }

    // Validate all processes exist and belong to the company
    const processes = await ProcessName.findAll({
      where: {
        id: processIds,
        company_id,
        status: "active",
      },
    });

    if (processes.length !== processIds.length) {
      return res.status(404).json({
        status: "error",
        message:
          "One or more processes not found or do not belong to your company",
      });
    }

    // Create a map for easy lookup
    const machineMap = new Map(
      machines.map((machine) => [machine.id, machine])
    );
    const processMap = new Map(
      processes.map((process) => [process.id, process])
    );

    // Check for existing assignments to avoid duplicates
    const existingAssignments = await MachineFlow.findAll({
      where: {
        company_id,
        status: "active",
        [Op.or]: assignments.map((item) => ({
          machine_id: item.machine_id,
          process_id: item.process_id,
        })),
      },
    });

    // Filter out any existing assignments
    const existingMap = new Map();
    existingAssignments.forEach((assignment) => {
      const key = `${assignment.machine_id}-${assignment.process_id}`;
      existingMap.set(key, true);
    });

    const newAssignments = assignments.filter((item) => {
      const key = `${item.machine_id}-${item.process_id}`;
      return !existingMap.has(key);
    });

    if (newAssignments.length === 0) {
      return res.status(409).json({
        status: "error",
        message: "All requested assignments already exist",
      });
    }

    // Create new machine flow assignments
    const machineFlowData = newAssignments.map((item) => {
      const machine = machineMap.get(item.machine_id);
      const process = processMap.get(item.process_id);

      return {
        company_id,
        machine_id: item.machine_id,
        machine_name: machine.machine_name,
        process_id: item.process_id,
        process_name: process.process_name,
        status: "active",
        created_by: user_id,
        updated_by: user_id,
      };
    });

    const createdAssignments = await MachineFlow.bulkCreate(machineFlowData, {
      transaction,
    });

    await transaction.commit();

    // Fetch complete data with associations
    const completeAssignments = await MachineFlow.findAll({
      where: {
        id: createdAssignments.map((item) => item.id),
      },
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: Machine, attributes: ["id", "machine_name", "machine_type"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
        {
          model: User,
          as: "creator_machine_flow",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater_machine_flow",
          attributes: ["id", "name"],
        },
      ],
    });

    return res.status(201).json({
      status: "success",
      message: "Machine-process assignments created successfully",
      data: completeAssignments,
      skipped: assignments.length - newAssignments.length,
    });
  } catch (error) {
    // Rollback if transaction hasn't been committed
    if (!transaction.finished) {
      await transaction.rollback();
    }

    logger.error(
      `Error creating machine-process assignments: ${error.message}`
    );
    return res.status(500).json({
      status: "error",
      message: "Failed to create machine-process assignments",
      error: error.message,
    });
  }
});
v1Router.get("/assign", authenticateJWT, async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const machineFlows = await MachineFlow.findAll({
      where: {
        company_id,
        status: "active",
      },
      include: [
        { model: Machine, attributes: ["id", "machine_name", "machine_type"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      status: "success",
      message: "Machine-process assignments retrieved successfully",
      data: machineFlows,
    });
  } catch (error) {
    logger.error(
      `Error retrieving machine-process assignments: ${error.message}`
    );
    return res.status(500).json({
      status: "error",
      message: "Failed to retrieve machine-process assignments",
      error: error.message,
    });
  }
});
v1Router.get(
  "/assign/machine/:machineId",
  authenticateJWT,
  async (req, res) => {
    try {
      const company_id = req.user.company_id;
      const machineId = req.params.machineId;

      // Validate machine exists and belongs to company
      const machine = await Machine.findOne({
        where: {
          id: machineId,
          company_id,
          status: "active",
        },
      });

      if (!machine) {
        return res.status(404).json({
          status: "error",
          message: "Machine not found or does not belong to your company",
        });
      }

      const processAssignments = await MachineFlow.findAll({
        where: {
          company_id,
          machine_id: machineId,
          status: "active",
        },
        include: [{ model: ProcessName, attributes: ["id", "process_name"] }],
        order: [["created_at", "DESC"]],
      });

      return res.status(200).json({
        status: "success",
        message: "Process assignments for machine retrieved successfully",
        data: processAssignments,
      });
    } catch (error) {
      logger.error(
        `Error retrieving process assignments for machine: ${error.message}`
      );
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve process assignments for machine",
        error: error.message,
      });
    }
  }
);
v1Router.get(
  "/assign/process/:processId",
  authenticateJWT,
  async (req, res) => {
    try {
      const company_id = req.user.company_id;
      const processId = req.params.processId;

      // Validate process exists and belongs to company
      const process = await ProcessName.findOne({
        where: {
          id: processId,
          company_id,
          status: "active",
        },
      });

      if (!process) {
        return res.status(404).json({
          status: "error",
          message: "Process not found or does not belong to your company",
        });
      }

      const machineAssignments = await MachineFlow.findAll({
        where: {
          company_id,
          process_id: processId,
          status: "active",
        },
        include: [
          {
            model: Machine,
            attributes: ["id", "machine_name", "machine_type"],
          },
        ],
        order: [["created_at", "DESC"]],
      });

      return res.status(200).json({
        status: "success",
        message: "Machine assignments for process retrieved successfully",
        data: machineAssignments,
      });
    } catch (error) {
      logger.error(
        `Error retrieving machine assignments for process: ${error.message}`
      );
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve machine assignments for process",
        error: error.message,
      });
    }
  }
);
v1Router.delete("/assign/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const company_id = req.user.company_id;
    const user_id = req.user.id;
    const flowId = req.params.id;

    // Check if the flow exists and belongs to the company
    const flow = await MachineFlow.findOne({
      where: {
        id: flowId,
        company_id,
        status: "active",
      },
    });

    if (!flow) {
      return res.status(404).json({
        status: "error",
        message:
          "Machine-process assignment not found or does not belong to your company",
      });
    }

    // Update status to inactive instead of deleting
    await MachineFlow.update(
      {
        status: "inactive",
        updated_by: user_id,
      },
      {
        where: {
          id: flowId,
        },
        transaction,
      }
    );

    await transaction.commit();

    return res.status(200).json({
      status: "success",
      message: "Machine-process assignment removed successfully",
    });
  } catch (error) {
    // Rollback if transaction hasn't been committed
    if (!transaction.finished) {
      await transaction.rollback();
    }

    logger.error(`Error removing machine-process assignment: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to remove machine-process assignment",
      error: error.message,
    });
  }
});

v1Router.put("/assign/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const company_id = req.user.company_id;
    const user_id = req.user.id;
    const flowId = req.params.id;
    const { machine_id, process_id } = req.body;

    // Validate request body
    if (!machine_id && !process_id) {
      return res.status(400).json({
        status: "error",
        message: "Please provide at least machine_id or process_id to update",
      });
    }

    // Check if the flow exists and belongs to the company
    const flow = await MachineFlow.findOne({
      where: {
        id: flowId,
        company_id,
        status: "active",
      },
    });

    if (!flow) {
      return res.status(404).json({
        status: "error",
        message:
          "Machine-process assignment not found or does not belong to your company",
      });
    }

    // If updating machine_id, validate machine exists and belongs to company
    let machine;
    if (machine_id) {
      machine = await Machine.findOne({
        where: {
          id: machine_id,
          company_id,
          status: "active",
        },
      });

      if (!machine) {
        return res.status(404).json({
          status: "error",
          message: "Machine not found or does not belong to your company",
        });
      }
    }

    // If updating process_id, validate process exists and belongs to company
    let process;
    if (process_id) {
      process = await ProcessName.findOne({
        where: {
          id: process_id,
          company_id,
          status: "active",
        },
      });

      if (!process) {
        return res.status(404).json({
          status: "error",
          message: "Process not found or does not belong to your company",
        });
      }
    }

    // Check if the updated assignment would create a duplicate
    const duplicateCheck = await MachineFlow.findOne({
      where: {
        company_id,
        machine_id: machine_id || flow.machine_id,
        process_id: process_id || flow.process_id,
        status: "active",
        id: { [Op.ne]: flowId }, // Exclude current record
      },
    });

    if (duplicateCheck) {
      return res.status(409).json({
        status: "error",
        message: "This machine-process assignment already exists",
      });
    }

    // Prepare update data
    const updateData = {
      updated_by: user_id,
    };

    if (machine_id) {
      updateData.machine_id = machine_id;
      updateData.machine_name = machine.machine_name;
    }

    if (process_id) {
      updateData.process_id = process_id;
      updateData.process_name = process.process_name;
    }

    // Update the machine flow assignment
    await MachineFlow.update(updateData, {
      where: {
        id: flowId,
      },
      transaction,
    });

    await transaction.commit();

    // Fetch updated assignment with associations
    const updatedAssignment = await MachineFlow.findOne({
      where: {
        id: flowId,
      },
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: Machine, attributes: ["id", "machine_name", "machine_type"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
        {
          model: User,
          as: "creator_machine_flow",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater_machine_flow",
          attributes: ["id", "name"],
        },
      ],
    });

    return res.status(200).json({
      status: "success",
      message: "Machine-process assignment updated successfully",
      data: updatedAssignment,
    });
  } catch (error) {
    // Rollback if transaction hasn't been committed
    if (!transaction.finished) {
      await transaction.rollback();
    }

    logger.error(`Error updating machine-process assignment: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to update machine-process assignment",
      error: error.message,
    });
  }
});

// Create a new machine
v1Router.post("/master/create", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    const machine_generate_id = await generateId(
      req.user.company_id,
      Machine,
      "machine"
    );

    // Validate required fields
    const requiredFields = [
      "machine_name",
      "machine_type",
      "model_number",
      "serial_number",
      "manufacturer",
      // "purchase_date",
      // "installation_date",
      "location",
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        status: "error",
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Check for duplicate serial number
    const existingMachine = await Machine.findOne({
      where: {
        serial_number: req.body.serial_number,
        status: "active",
      },
    });

    if (existingMachine) {
      return res.status(409).json({
        status: "error",
        message: "Serial number already exists",
      });
    }

    // Set default values for specific fields
    const defaultValues = {
      machine_generate_id: machine_generate_id,
      machine_status: "Active",
      connectivity_status: true,
      status: "active",
      created_by: user_id,
      updated_by: user_id,
      company_id,
    };

    // Create the machine by combining req.body with default values
    const machine = await Machine.create(
      {
        ...req.body,
        ...defaultValues,
      },
      { transaction }
    );

    await transaction.commit();

    // After successful commit, fetch the created machine details
    const createdMachine = await Machine.findByPk(machine.id, {
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        {
          model: User,
          as: "creator_machine",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater_machine",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
    });

    return res.status(201).json({
      status: "success",
      message: "Machine created successfully",
      data: createdMachine,
    });
  } catch (error) {
    // Only rollback if transaction hasn't been committed
    if (!transaction.finished) {
      await transaction.rollback();
    }
    logger.error(`Error creating machine: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to create machine",
      error: error.message,
    });
  }
});
// Get all machines with pagination and search
v1Router.get("/master/get", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, machine_status } = req.query;
    const offset = (page - 1) * limit;
    const where = {
      company_id: req.user.company_id,
      status: "active",
    };

    // Apply search filter if provided
    if (search) {
      where[Op.or] = [
        { machine_name: { [Op.like]: `%${search}%` } },
        { serial_number: { [Op.like]: `%${search}%` } },
        { model_number: { [Op.like]: `%${search}%` } },
        { manufacturer: { [Op.like]: `%${search}%` } },
      ];
    }

    // Apply machine status filter if provided
    if (machine_status) {
      where.machine_status = machine_status;
    }

    // Get total count for pagination
    const count = await Machine.count({ where });

    // Get counts for each machine status
    const statusCounts = {
      Active: await Machine.count({
        where: { ...where, machine_status: "Active" },
      }),
      Inactive: await Machine.count({
        where: { ...where, machine_status: "Inactive" },
      }),
      "Under Maintenance": await Machine.count({
        where: { ...where, machine_status: "Under Maintenance" },
      }),
    };

    // Fetch machines with company and user info
    const machines = await Machine.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        {
          model: User,
          as: "creator_machine",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater_machine",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
      order: [["updated_at", "DESC"]],
    });

    return res.status(200).json({
      status: "success",
      data: machines,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
      statusCounts,
    });
  } catch (error) {
    logger.error(`Error fetching machines: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch machines",
      error: error.message,
    });
  }
});

// Get a single machine by ID
v1Router.get("/master/get/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const machine = await Machine.findOne({
      where: {
        id,
        company_id,
        status: "active",
      },
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        {
          model: User,
          as: "creator_machine",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater_machine",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!machine) {
      return res.status(404).json({
        status: "error",
        message: "Machine not found or access denied",
      });
    }

    // Get status counts for company
    const statusWhere = {
      company_id,
      status: "active",
    };

    const statusCounts = {
      Active: await Machine.count({
        where: { ...statusWhere, machine_status: "Active" },
      }),
      Inactive: await Machine.count({
        where: { ...statusWhere, machine_status: "Inactive" },
      }),
      "Under Maintenance": await Machine.count({
        where: { ...statusWhere, machine_status: "Under Maintenance" },
      }),
    };

    return res.status(200).json({
      status: "success",
      data: machine,
      statusCounts,
    });
  } catch (error) {
    logger.error(`Error fetching machine: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch machine",
      error: error.message,
    });
  }
});
// Update a machine
v1Router.put("/master/update/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Find the machine and ensure it belongs to the user's company
    const machine = await Machine.findOne({
      where: {
        id,
        company_id,
        status: "active",
      },
    });

    if (!machine) {
      return res.status(404).json({
        status: "error",
        message: "Machine not found or access denied",
      });
    }

    const {
      machine_name,
      machine_type,
      model_number,
      serial_number,
      manufacturer,
      purchase_date,
      installation_date,
      machine_status,
      location,
      last_maintenance,
      next_maintenance_due,
      assigned_operator,
      power_rating,
      connectivity_status,
      ip_address,
      warranty_expiry,
      remarks_notes,
    } = req.body;

    // Check for duplicate serial number if it's being changed
    if (serial_number && serial_number !== machine.serial_number) {
      const existingMachine = await Machine.findOne({
        where: {
          serial_number,
          id: { [Op.ne]: id },
          status: "active",
        },
      });

      if (existingMachine) {
        return res.status(409).json({
          status: "error",
          message: "Serial number already exists",
        });
      }
    }

    // Update the machine with only provided fields
    const updateData = {
      ...(machine_name && { machine_name }),
      ...(machine_type && { machine_type }),
      ...(model_number && { model_number }),
      ...(serial_number && { serial_number }),
      ...(manufacturer && { manufacturer }),
      ...(purchase_date && { purchase_date }),
      ...(installation_date && { installation_date }),
      ...(machine_status && { machine_status }),
      ...(location && { location }),
      ...(last_maintenance && { last_maintenance }),
      ...(next_maintenance_due && { next_maintenance_due }),
      ...(assigned_operator !== undefined && { assigned_operator }),
      ...(power_rating !== undefined && { power_rating }),
      ...(connectivity_status !== undefined && { connectivity_status }),
      ...(ip_address !== undefined && { ip_address }),
      ...(warranty_expiry !== undefined && { warranty_expiry }),
      ...(remarks_notes !== undefined && { remarks_notes }),
      updated_by: user_id,
    };

    await machine.update(updateData, { transaction });

    await transaction.commit();

    const updatedMachine = await Machine.findByPk(id, {
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        {
          model: User,
          as: "creator_machine",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater_machine",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
    });

    return res.status(200).json({
      status: "success",
      message: "Machine updated successfully",
      data: updatedMachine,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error updating machine: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to update machine",
      error: error.message,
    });
  }
});

// Delete (soft delete) a machine
v1Router.delete("/master/delete/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Check if the machine exists for the given company
    const machine = await Machine.findOne({
      where: {
        id,
        company_id,
        status: "active",
      },
    });

    if (!machine) {
      return res.status(404).json({
        status: "error",
        message: "Machine not found or access denied",
      });
    }

    // Soft delete related machine flows
    await MachineFlow.update(
      {
        status: "inactive",
        updated_by: user_id,
      },
      {
        where: {
          machine_id: id,
          status: "active",
        },
        transaction,
      }
    );

    // Soft delete the machine
    await machine.update(
      {
        status: "inactive",
        updated_by: user_id,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      status: "success",
      message: "Machine and related flows deleted successfully",
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error deleting machine: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete machine",
      error: error.message,
    });
  }
});
// v1Router.delete("/master/delete/:id", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();

//   try {
//     const { id } = req.params;
//     const company_id = req.user.company_id;
//     const user_id = req.user.id;

//     // Check if the machine exists for the given company
//     const machine = await Machine.findOne({
//       where: {
//         id,
//         company_id,
//         status: "active",
//       },
//     });

//     if (!machine) {
//       return res.status(404).json({
//         status: "error",
//         message: "Machine not found or access denied",
//       });
//     }

//     // Soft delete: update status to inactive
//     await machine.update(
//       {
//         status: "inactive",
//         updated_by: user_id,
//       },
//       { transaction }
//     );

//     await transaction.commit();

//     return res.status(200).json({
//       status: "success",
//       message: "Machine deleted successfully",
//     });
//   } catch (error) {
//     await transaction.rollback();
//     logger.error(`Error deleting machine: ${error.message}`);
//     return res.status(500).json({
//       status: "error",
//       message: "Failed to delete machine",
//       error: error.message,
//     });
//   }
// });
// Update machine status (Active, Inactive, Under Maintenance)
v1Router.patch("/master/:id/status", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { machine_status } = req.body;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    if (
      !machine_status ||
      !["Active", "Inactive", "Under Maintenance"].includes(machine_status)
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid machine status. Must be one of: Active, Inactive, Under Maintenance",
      });
    }

    // Find the machine
    const machine = await Machine.findOne({
      where: {
        id,
        company_id,
        status: "active",
      },
    });

    if (!machine) {
      return res.status(404).json({
        status: "error",
        message: "Machine not found or access denied",
      });
    }

    // Update machine status
    await machine.update(
      {
        machine_status,
        updated_by: user_id,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      status: "success",
      message: `Machine status updated to ${machine_status}`,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error updating machine status: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to update machine status",
      error: error.message,
    });
  }
});
// Get machines by status
v1Router.get("/machine/status/:status", authenticateJWT, async (req, res) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const company_id = req.user.company_id;

    if (!["Active", "Inactive", "Under Maintenance"].includes(status)) {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid machine status. Must be one of: Active, Inactive, Under Maintenance",
      });
    }

    const where = {
      company_id,
      machine_status: status,
      status: "active", // Only active records
    };

    // Get total count for pagination
    const count = await Machine.count({ where });

    // Fetch machines
    const machines = await Machine.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        {
          model: User,
          as: "creator",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
      order: [["updated_at", "DESC"]],
    });

    return res.status(200).json({
      status: "success",
      data: machines,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error(`Error fetching machines by status: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch machines by status",
      error: error.message,
    });
  }
});
// process crud api's
v1Router.get("/process", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    const where = {
      company_id: req.user.company_id, // Use company_id from auth context
      status: "active", // Always filter by active status only
    };

    // Apply search filter if provided
    if (search) {
      where.process_name = {
        [Op.like]: `%${search}%`,
      };
    }

    // Get total count for pagination
    const count = await ProcessName.count({ where });

    // Fetch processes with company and user info
    const processes = await ProcessName.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: User, as: "process_creator", attributes: ["id", "name"] },
        { model: User, as: "process_updater", attributes: ["id", "name"] },
      ],
      order: [["updated_at", "DESC"]],
    });

    return res.status(200).json({
      status: "success",
      data: processes,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error(`Error fetching processes: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch processes",
      error: error.message,
    });
  }
});
// Create a new process
v1Router.post("/process", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { process_name, status = "active" } = req.body;
    const company_id = req.user.company_id;
    const user_id = req.user.id;
    
    const process_generate_id = await generateId(req.user.company_id, ProcessName, "process");

    if (!process_name) {
      return res.status(400).json({
        status: "error",
        message: "Process name is required",
      });
    }
    // Check for duplicate process name within the same company
    const existingProcess = await ProcessName.findOne({
      where: {
        company_id,
        process_name,
      },
    });

    if (existingProcess) {
      return res.status(409).json({
        status: "error",
        message: "Process name already exists for this company",
      });
    }

    const process = await ProcessName.create(
      {
        process_generate_id: process_generate_id,
        company_id,
        process_name,
        status,
        created_by: user_id,
        updated_by: user_id,
      },
      { transaction }
    );

    await transaction.commit();

    const createdProcess = await ProcessName.findByPk(process.id, {
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: User, as: "process_creator", attributes: ["id", "name"] },
        { model: User, as: "process_updater", attributes: ["id", "name"] },
      ],
    });

    return res.status(201).json({
      status: "success",
      message: "Process created successfully",
      data: createdProcess,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error creating process: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to create process",
      error: error.message,
    });
  }
});
// Update a process
v1Router.put("/process/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { process_name, status } = req.body;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Find the process and ensure it belongs to the user's company
    const process = await ProcessName.findOne({
      where: {
        id,
        company_id,
      },
    });

    if (!process) {
      return res.status(404).json({
        status: "error",
        message: "Process not found or access denied",
      });
    }

    // Check for duplicate process name within the same company if process_name is changed
    if (process_name && process_name !== process.process_name) {
      const existingProcess = await ProcessName.findOne({
        where: {
          company_id,
          process_name,
          id: { [Op.ne]: id }, // Exclude current process
        },
      });

      if (existingProcess) {
        return res.status(409).json({
          status: "error",
          message: "Process name already exists for this company",
        });
      }
    }

    // Update the process
    await process.update(
      {
        ...(process_name && { process_name }),
        ...(status && { status }),
        updated_by: user_id,
      },
      { transaction }
    );

    await transaction.commit();

    const updatedProcess = await ProcessName.findByPk(id, {
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: User, as: "process_creator", attributes: ["id", "name"] },
        { model: User, as: "process_updater", attributes: ["id", "name"] },
      ],
    });

    return res.status(200).json({
      status: "success",
      message: "Process updated successfully",
      data: updatedProcess,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error updating process: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to update process",
      error: error.message,
    });
  }
});

v1Router.delete("/process/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    // Check if the process exists for the given company
    const process = await ProcessName.findOne({
      where: { id, company_id },
    });

    if (!process) {
      return res.status(404).json({
        status: "error",
        message: "Process not found or access denied",
      });
    }

    // Soft delete related records in MachineProcessValue
    await MachineProcessValue.update(
      {
        status: "inactive",
        updated_at: new Date(),
        updated_by: req.user.id,
      },
      {
        where: { process_name_id: id },
        transaction,
      }
    );

    // Soft delete related records in MachineProcessField
    await MachineProcessField.update(
      {
        status: "inactive",
        updated_at: new Date(),
        updated_by: req.user.id,
      },
      {
        where: { process_name_id: id },
        transaction,
      }
    );

    // Soft delete related records in MachineFlow
    await MachineFlow.update(
      {
        status: "inactive",
        updated_by: req.user.id,
      },
      {
        where: { process_id: id, status: "active" },
        transaction,
      }
    );

    // Soft delete the process itself
    await process.update(
      {
        status: "inactive",
        updated_at: new Date(),
        updated_by: req.user.id,
      },
      {
        transaction,
      }
    );

    await transaction.commit();

    return res.status(200).json({
      status: "success",
      message: "Process and related data marked as inactive successfully",
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error soft-deleting process: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete process",
      error: error.message,
    });
  }
});

// v1Router.delete("/process/:id", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();

//   try {
//     const { id } = req.params;
//     const company_id = req.user.company_id;

//     // Check if the process exists for the given company
//     const process = await ProcessName.findOne({
//       where: { id, company_id },
//     });

//     if (!process) {
//       return res.status(404).json({
//         status: "error",
//         message: "Process not found or access denied",
//       });
//     }

//     // Check if this process is used in MachineProcessValue
//     const processInUse = await MachineProcessValue.findOne({
//       where: {
//         process_name_id: id,
//       },
//     });

//     if (processInUse) {
//       return res.status(400).json({
//         status: "error",
//         message:
//           "Cannot delete process as it is associated with machine process values",
//       });
//     }

//     // Soft delete: explicitly update only the needed fields
//     await process.update(
//       {
//         status: "inactive",
//         updated_at: req.user.id,
//         updated_by: req.user.id,
//       },
//       { transaction }
//     );

//     await transaction.commit();

//     return res.status(200).json({
//       status: "success",
//       message: "Process marked as inactive successfully",
//     });
//   } catch (error) {
//     await transaction.rollback();
//     logger.error(`Error soft-deleting process: ${error.message}`);
//     return res.status(500).json({
//       status: "error",
//       message: "Failed to delete process",
//       error: error.message,
//     });
//   }
// });
// Get all values for a specific process
v1Router.get(
  "/process/:process_id/values",
  authenticateJWT,
  async (req, res) => {
    try {
      const { process_id } = req.params;
      const company_id = req.user.company_id;

      // Verify the process exists and belongs to the company
      const process = await ProcessName.findOne({
        where: {
          id: process_id,
          company_id,
          status: "active",
        },
      });

      if (!process) {
        return res.status(404).json({
          status: "error",
          message: "Process not found or access denied",
        });
      }

      // Fetch all active values for this process
      const processValues = await MachineProcessValue.findAll({
        where: {
          process_name_id: process_id,
          company_id,
          status: "active",
        },
        include: [
          {
            model: User,
            as: "created_by_user",
            foreignKey: "created_by",
            attributes: ["id", "name"],
          },
          {
            model: User,
            as: "updated_by_user",
            foreignKey: "updated_by",
            attributes: ["id", "name"],
          },
        ],
        order: [["updated_at", "DESC"]],
      });

      return res.status(200).json({
        status: "success",
        data: processValues,
        process: {
          id: process.id,
          name: process.process_name,
        },
      });
    } catch (error) {
      logger.error(`Error fetching process values: ${error.message}`);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch process values",
        error: error.message,
      });
    }
  }
);
// Get all machine process fields with pagination and search
v1Router.get("/process-fields", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, process_name_id } = req.query;
    const offset = (page - 1) * limit;
    const where = {
      company_id: req.user.company_id,
      status: "active",
    };

    // Apply process_name_id filter if provided
    if (process_name_id) {
      where.process_name_id = process_name_id;
    }

    // Apply search filter if provided
    if (search) {
      where.label = {
        [Op.like]: `%${search}%`,
      };
    }

    // Get total count for pagination
    const count = await MachineProcessField.count({ where });

    // Fetch process fields with related data
    const processFields = await MachineProcessField.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
        {
          model: User,
          as: "creator",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
      order: [["updated_at", "DESC"]],
    });

    return res.status(200).json({
      status: "success",
      data: processFields,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error(`Error fetching process fields: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch process fields",
      error: error.message,
    });
  }
});
// Get a specific process field by ID
v1Router.get("/process-fields/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const processField = await MachineProcessField.findOne({
      where: {
        id,
        company_id,
        status: "active",
      },
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
        {
          model: User,
          as: "creator",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!processField) {
      return res.status(404).json({
        status: "error",
        message: "Process field not found or access denied",
      });
    }

    return res.status(200).json({
      status: "success",
      data: processField,
    });
  } catch (error) {
    logger.error(`Error fetching process field: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch process field",
      error: error.message,
    });
  }
});
v1Router.post("/process-fields", authenticateJWT, async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();

    const {
      process_name_id,
      label,
      field_type,
      required = false,
      status = "active",
    } = req.body;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Validate required fields
    if (!process_name_id || !label || !field_type) {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message: "Process name ID, label and field type are required",
      });
    }

    // Check if the process exists and belongs to the company
    const process = await ProcessName.findOne({
      where: {
        id: process_name_id,
        company_id,
        status: "active",
      },
    });

    if (!process) {
      await transaction.rollback();
      return res.status(404).json({
        status: "error",
        message: "Process not found or access denied",
      });
    }

    // Check for duplicate label within the same process
    const existingField = await MachineProcessField.findOne({
      where: {
        company_id,
        process_name_id,
        label,
        status: "active",
      },
    });

    if (existingField) {
      await transaction.rollback();
      return res.status(409).json({
        status: "error",
        message: "Field label already exists for this process",
      });
    }

    // Create the process field
    const processField = await MachineProcessField.create(
      {
        company_id,
        process_name_id,
        label,
        field_type,
        required: required ? 1 : 0,
        status,
        created_by: user_id,
        updated_by: user_id,
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch the created field with related data
    const createdField = await MachineProcessField.findByPk(processField.id, {
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
        {
          model: User,
          as: "creator",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updater",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
    });

    return res.status(201).json({
      status: "success",
      message: "Process field created successfully",
      data: createdField,
    });
  } catch (error) {
    // If transaction exists and hasn't been committed yet, rollback
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error(`Rollback failed: ${rollbackError.message}`);
      }
    }
    logger.error(`Error creating process field: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to create process field",
      error: error.message,
    });
  }
});

// Update a process field (label and required status only)
v1Router.put("/process-fields/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { label, required } = req.body;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Check if the process field exists for the given company
    const processField = await MachineProcessField.findOne({
      where: {
        id,
        company_id,
      },
    });

    if (!processField) {
      return res.status(404).json({
        status: "error",
        message: "Process field not found or access denied",
      });
    }

    // Store the old label for reference
    const oldLabel = processField.label;
    const process_name_id = processField.process_name_id;

    console.log(
      `Updating field: ${oldLabel} to ${label}, process_name_id: ${process_name_id}`
    );

    // Update only the label and required fields
    await processField.update(
      {
        label: label || processField.label,
        required: required !== undefined ? required : processField.required,
        updated_by: user_id,
      },
      { transaction }
    );

    // If the label was changed, update all corresponding process values
    if (label && label !== oldLabel) {
      // Find process values related to this specific process_name_id
      const processValues = await MachineProcessValue.findAll({
        where: {
          company_id,
          process_name_id: process_name_id,
          status: "active",
        },
      });

      console.log(`Found ${processValues.length} process values to update`);

      // Update each process value that contains this field name
      for (const processValue of processValues) {
        let valuesObj = processValue.process_value;

        console.log(`Original process value:`, valuesObj);

        // Parse if it's a string
        if (typeof valuesObj === "string") {
          try {
            valuesObj = JSON.parse(valuesObj);
            console.log("Parsed JSON:", valuesObj);
          } catch (e) {
            console.log(`Error parsing JSON: ${e.message}`);
            continue; // Skip if parsing fails
          }
        }

        if (valuesObj && typeof valuesObj === "object") {
          // Check if this process value contains the old field name
          if (valuesObj.hasOwnProperty(oldLabel)) {
            console.log(`Found old label ${oldLabel} in process value`);

            // Store the value associated with the old label
            const fieldValue = valuesObj[oldLabel];
            console.log(`Value for ${oldLabel}: ${fieldValue}`);

            // Create a new object with the updated key
            const updatedValuesObj = {};

            // Copy all existing keys except the old label
            for (const key in valuesObj) {
              if (key !== oldLabel) {
                updatedValuesObj[key] = valuesObj[key];
              }
            }

            // Add the new label with the same value
            updatedValuesObj[label] = fieldValue;

            console.log(`Updated values object:`, updatedValuesObj);

            // Update the process value
            await processValue.update(
              {
                process_value: updatedValuesObj,
                updated_by: user_id,
              },
              { transaction }
            );

            console.log(`Updated process value with id ${processValue.id}`);
          } else {
            console.log(`Old label ${oldLabel} not found in process value`);
          }
        }
      }
    }

    await transaction.commit();

    return res.status(200).json({
      status: "success",
      message: "Process field updated successfully",
      data: processField,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error updating process field: ${error.message}`);
    console.error(error);
    return res.status(500).json({
      status: "error",
      message: "Failed to update process field",
      error: error.message,
    });
  }
});

// v1Router.put("/process-fields/:id", authenticateJWT, async (req, res) => {
//   let transaction;

//   try {
//     transaction = await sequelize.transaction();

//     const { id } = req.params;
//     const { process_name_id, label, field_type, required, status } = req.body;
//     const company_id = req.user.company_id;
//     const user_id = req.user.id;

//     // Find the process field and ensure it belongs to the user's company
//     const processField = await MachineProcessField.findOne({
//       where: {
//         id,
//         company_id,
//       },
//     });

//     if (!processField) {
//       await transaction.rollback();
//       return res.status(404).json({
//         status: "error",
//         message: "Process field not found or access denied",
//       });
//     }

//     // If process_name_id is changing, verify the new process exists
//     if (process_name_id && process_name_id !== processField.process_name_id) {
//       const process = await ProcessName.findOne({
//         where: {
//           id: process_name_id,
//           company_id,
//           status: "active",
//         },
//       });

//       if (!process) {
//         await transaction.rollback();
//         return res.status(404).json({
//           status: "error",
//           message: "New process not found or access denied",
//         });
//       }
//     }

//     // Check for duplicate label within the same process
//     if (
//       (label && label !== processField.label) ||
//       (process_name_id && process_name_id !== processField.process_name_id)
//     ) {
//       const existingField = await MachineProcessField.findOne({
//         where: {
//           company_id,
//           process_name_id: process_name_id || processField.process_name_id,
//           label: label || processField.label,
//           id: { [Op.ne]: id },
//           status: "active",
//         },
//       });

//       if (existingField) {
//         await transaction.rollback();
//         return res.status(409).json({
//           status: "error",
//           message: "Field label already exists for this process",
//         });
//       }
//     }

//     // Prepare the update data
//     const updateData = {
//       ...(process_name_id && { process_name_id }),
//       ...(label && { label }),
//       ...(field_type && { field_type }),
//       ...(required !== undefined && { required: required ? 1 : 0 }),
//       ...(status && { status }),
//       updated_by: user_id,
//     };

//     // Update the field
//     await processField.update(updateData, { transaction });
//     await transaction.commit();

//     // Fetch the updated field
//     const updatedField = await MachineProcessField.findByPk(id, {
//       include: [
//         { model: Company, attributes: ["id", "company_name"] },
//         { model: ProcessName, attributes: ["id", "process_name"] },
//         {
//           model: User,
//           as: "creator",
//           foreignKey: "created_by",
//           attributes: ["id", "name"],
//         },
//         {
//           model: User,
//           as: "updater",
//           foreignKey: "updated_by",
//           attributes: ["id", "name"],
//         },
//       ],
//     });

//     return res.status(200).json({
//       status: "success",
//       message: "Process field updated successfully",
//       data: updatedField,
//     });
//   } catch (error) {
//     if (transaction) {
//       try {
//         await transaction.rollback();
//       } catch (rollbackError) {
//         logger.error(`Rollback failed: ${rollbackError.message}`);
//       }
//     }

//     logger.error(`Error updating process field: ${error.message}`);
//     return res.status(500).json({
//       status: "error",
//       message: "Failed to update process field",
//       error: error.message,
//     });
//   }
// });

// Delete (soft delete) a process field
v1Router.delete("/process-fields/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Check if the process field exists for the given company
    const processField = await MachineProcessField.findOne({
      where: {
        id,
        company_id,
      },
    });

    if (!processField) {
      return res.status(404).json({
        status: "error",
        message: "Process field not found or access denied",
      });
    }

    // Get the field name from the process field and the process_name_id
    const fieldName = processField.label;
    const process_name_id = processField.process_name_id;

    // Soft delete the process field
    await processField.update(
      {
        status: "inactive",
        updated_by: user_id,
      },
      { transaction }
    );

    // Find process values related to this specific process_name_id
    const processValues = await MachineProcessValue.findAll({
      where: {
        company_id,
        process_name_id: process_name_id,
        status: "active",
      },
    });

    // Update each process value that contains this field name
    for (const processValue of processValues) {
      let valuesObj = processValue.process_value;

      // Parse if it's a string
      if (typeof valuesObj === "string") {
        try {
          valuesObj = JSON.parse(valuesObj);
        } catch (e) {
          continue; // Skip if parsing fails
        }
      }

      if (valuesObj && typeof valuesObj === "object") {
        // Check if this process value contains the deleted field name
        if (valuesObj.hasOwnProperty(fieldName)) {
          // Remove the field from the JSON object
          delete valuesObj[fieldName];

          // Update the process value
          await processValue.update(
            {
              process_value: valuesObj,
              updated_by: user_id,
            },
            { transaction }
          );
        }
      }
    }

    await transaction.commit();

    return res.status(200).json({
      status: "success",
      message:
        "Process field and associated values marked as inactive successfully",
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error soft-deleting process field: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete process field",
      error: error.message,
    });
  }
});

// // Delete (soft delete) a process field
// v1Router.delete("/process-fields/:id", authenticateJWT, async (req, res) => {
//   const transaction = await sequelize.transaction();

//   try {
//     const { id } = req.params;
//     const company_id = req.user.company_id;
//     const user_id = req.user.id;

//     // Check if the process field exists for the given company
//     const processField = await MachineProcessField.findOne({
//       where: {
//         id,
//         company_id,
//       },
//     });

//     if (!processField) {
//       return res.status(404).json({
//         status: "error",
//         message: "Process field not found or access denied",
//       });
//     }

//     // Soft delete: explicitly update only the needed fields
//     await processField.update(
//       {
//         status: "inactive",
//         updated_by: user_id,
//       },
//       { transaction }
//     );

//     await transaction.commit();

//     return res.status(200).json({
//       status: "success",
//       message: "Process field marked as inactive successfully",
//     });
//   } catch (error) {
//     await transaction.rollback();
//     logger.error(`Error soft-deleting process field: ${error.message}`);
//     return res.status(500).json({
//       status: "error",
//       message: "Failed to delete process field",
//       error: error.message,
//     });
//   }
// });
// Get all fields for a specific process
v1Router.get(
  "/process/:process_id/fields",
  authenticateJWT,
  async (req, res) => {
    try {
      const { process_id } = req.params;
      const company_id = req.user.company_id;

      // Verify the process exists and belongs to the company
      const process = await ProcessName.findOne({
        where: {
          id: process_id,
          company_id,
          status: "active",
        },
      });

      if (!process) {
        return res.status(404).json({
          status: "error",
          message: "Process not found or access denied",
        });
      }

      // Fetch all active fields for this process
      const processFields = await MachineProcessField.findAll({
        where: {
          process_name_id: process_id,
          company_id,
          status: "active",
        },
        include: [
          {
            model: User,
            as: "creator",
            foreignKey: "created_by",
            attributes: ["id", "name"],
          },
          {
            model: User,
            as: "updater",
            foreignKey: "updated_by",
            attributes: ["id", "name"],
          },
        ],
        order: [["updated_at", "ASC"]],
      });

      return res.status(200).json({
        status: "success",
        data: processFields,
        process: {
          id: process.id,
          name: process.process_name,
        },
      });
    } catch (error) {
      logger.error(`Error fetching process fields: ${error.message}`);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch process fields",
        error: error.message,
      });
    }
  }
);
// Get all machine process values with pagination and search
v1Router.get("/process-values", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, process_name_id } = req.query;
    const offset = (page - 1) * limit;
    const where = {
      company_id: req.user.company_id,
      status: "active",
    };

    // Apply process_name_id filter if provided
    if (process_name_id) {
      where.process_name_id = process_name_id;
    }

    // Get total count for pagination
    const count = await MachineProcessValue.count({ where });

    // Fetch process values with related data
    const processValues = await MachineProcessValue.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
        {
          model: User,
          as: "created_by_user",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updated_by_user",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
      order: [["updated_at", "DESC"]],
    });

    // Parse process_value for each result
    processValues.forEach((value) => {
      if (value && typeof value.process_value === "string") {
        try {
          value.process_value = JSON.parse(value.process_value);
        } catch (parseError) {
          logger.error(
            `Error parsing process_value for ID ${value.id}: ${parseError.message}`
          );
          // Continue even if parsing fails
        }
      }
    });

    return res.status(200).json({
      status: "success",
      data: processValues,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error(`Error fetching process values: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch process values",
      error: error.message,
    });
  }
});
// Get a specific process value by ID
v1Router.get("/process-values/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const processValue = await MachineProcessValue.findOne({
      where: {
        id,
        company_id,
        status: "active",
      },
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
        {
          model: User,
          as: "created_by_user",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updated_by_user",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!processValue) {
      return res.status(404).json({
        status: "error",
        message: "Process value not found or access denied",
      });
    }

    // Parse process_value if it's a string
    if (processValue && typeof processValue.process_value === "string") {
      try {
        processValue.process_value = JSON.parse(processValue.process_value);
      } catch (parseError) {
        logger.error(
          `Error parsing process_value for ID ${processValue.id}: ${parseError.message}`
        );
        // Continue even if parsing fails
      }
    }

    return res.status(200).json({
      status: "success",
      data: processValue,
    });
  } catch (error) {
    logger.error(`Error fetching process value: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch process value",
      error: error.message,
    });
  }
});
v1Router.post("/process-values", authenticateJWT, async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();

    const { process_name_id, process_value, status = "active" } = req.body;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Validate required fields
    if (!process_name_id || !process_value) {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message: "Process name ID and process value are required",
      });
    }

    // Check if the process exists and belongs to the company
    const process = await ProcessName.findOne({
      where: {
        id: process_name_id,
        company_id,
        status: "active",
      },
    });

    if (!process) {
      await transaction.rollback();
      return res.status(404).json({
        status: "error",
        message: "Process not found or access denied",
      });
    }

    // Check if a process value already exists for this process_name_id
    const existingProcessValue = await MachineProcessValue.findOne({
      where: {
        process_name_id,
        company_id,
      },
      transaction,
    });

    if (existingProcessValue) {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message:
          "A value already exists for this process. Please update the existing value instead.",
      });
    }

    // Create the process value
    const newProcessValue = await MachineProcessValue.create(
      {
        company_id,
        process_name_id,
        process_value,
        status,
        created_by: user_id,
        updated_by: user_id,
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch the created value with related data
    const createdValue = await MachineProcessValue.findByPk(
      newProcessValue.id,
      {
        include: [
          { model: Company, attributes: ["id", "company_name"] },
          { model: ProcessName, attributes: ["id", "process_name"] },
          {
            model: User,
            as: "created_by_user",
            foreignKey: "created_by",
            attributes: ["id", "name"],
          },
          {
            model: User,
            as: "updated_by_user",
            foreignKey: "updated_by",
            attributes: ["id", "name"],
          },
        ],
      }
    );

    // Parse the process_value if it's a string
    if (createdValue && typeof createdValue.process_value === "string") {
      try {
        createdValue.process_value = JSON.parse(createdValue.process_value);
      } catch (parseError) {
        logger.error(`Error parsing process_value: ${parseError.message}`);
        // Continue even if parsing fails
      }
    }

    return res.status(201).json({
      status: "success",
      message: "Process value created successfully",
      data: createdValue,
    });
  } catch (error) {
    // If transaction exists and hasn't been committed yet, rollback
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error(`Rollback failed: ${rollbackError.message}`);
      }
    }
    logger.error(`Error creating process value: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to create process value",
      error: error.message,
    });
  }
});

// Update a process value
v1Router.put("/process-values/:id", authenticateJWT, async (req, res) => {
  let transaction;

  try {
    transaction = await sequelize.transaction();

    const { id } = req.params;
    const { process_name_id, process_value, status } = req.body;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Find the process value and ensure it belongs to the user's company
    const processValue = await MachineProcessValue.findOne({
      where: {
        id,
        company_id,
      },
    });

    if (!processValue) {
      await transaction.rollback();
      return res.status(404).json({
        status: "error",
        message: "Process value not found or access denied",
      });
    }

    // If process_name_id is changing, verify the new process exists
    if (process_name_id && process_name_id !== processValue.process_name_id) {
      const process = await ProcessName.findOne({
        where: {
          id: process_name_id,
          company_id,
          status: "active",
        },
      });

      if (!process) {
        await transaction.rollback();
        return res.status(404).json({
          status: "error",
          message: "New process not found or access denied",
        });
      }
    }

    // Prepare the update data
    const updateData = {
      ...(process_name_id && { process_name_id }),
      ...(process_value && { process_value }),
      ...(status && { status }),
      updated_by: user_id,
    };

    // Update the value
    await processValue.update(updateData, { transaction });
    await transaction.commit();

    // Fetch the updated value
    const updatedValue = await MachineProcessValue.findByPk(id, {
      include: [
        { model: Company, attributes: ["id", "company_name"] },
        { model: ProcessName, attributes: ["id", "process_name"] },
        {
          model: User,
          as: "created_by_user",
          foreignKey: "created_by",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "updated_by_user",
          foreignKey: "updated_by",
          attributes: ["id", "name"],
        },
      ],
    });

    // Parse the JSON string in process_value if it's a valid JSON string
    if (
      updatedValue.process_value &&
      typeof updatedValue.process_value === "string"
    ) {
      try {
        updatedValue.process_value = JSON.parse(updatedValue.process_value);
      } catch (e) {
        // If it's not valid JSON, leave it as is
        logger.warn(`Could not parse process_value as JSON: ${e.message}`);
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Process value updated successfully",
      data: updatedValue,
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error(`Rollback failed: ${rollbackError.message}`);
      }
    }

    logger.error(`Error updating process value: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to update process value",
      error: error.message,
    });
  }
});

// Delete (soft delete) a process value
v1Router.delete("/process-values/:id", authenticateJWT, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    // Check if the process value exists for the given company
    const processValue = await MachineProcessValue.findOne({
      where: {
        id,
        company_id,
      },
    });

    if (!processValue) {
      await transaction.rollback();
      return res.status(404).json({
        status: "error",
        message: "Process value not found or access denied",
      });
    }

    // Soft delete: update only the needed fields
    await processValue.update(
      {
        status: "inactive",
        updated_by: user_id,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      status: "success",
      message: "Process value marked as inactive successfully",
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error soft-deleting process value: ${error.message}`);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete process value",
      error: error.message,
    });
  }
});

// ✅ Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
  });
});

process.on("SIGINT", async () => {
  logger.info("Shutting down...");

  process.exit(0);
});

// Use Version 1 Router
app.use("/api/machines", v1Router);

await db.sequelize.sync();
const PORT = 3007;
const service = "Machine Service";
app.listen(PORT, () => {
  console.log(`${service} running on port ${PORT}`);
});

export default app;
