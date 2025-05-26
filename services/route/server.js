import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import { generateId } from "../../common/inputvalidation/generateId.js";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const Route = db.Route;
const MachineRouteProcess = db.MachineRouteProcess;
const ProcessName = db.ProcessName;
const Machine = db.Machine;

// POST create new machine route process
v1Router.post("/machine-route-process", authenticateJWT, async (req, res) => {
  const machineRouteProcessDetails = req.body;

  if (
    !machineRouteProcessDetails ||
    !machineRouteProcessDetails.machine_id ||
    !machineRouteProcessDetails.machine_route_process
  ) {
    return res.status(400).json({
      message: "Invalid input data. Machine ID and route processes are required.",
    });
  }

  try {
    // Create Machine Route Process
    const newMachineRouteProcess = await MachineRouteProcess.create({
      company_id: req.user.company_id,
      machine_id: machineRouteProcessDetails.machine_id,
      machine_route_process: machineRouteProcessDetails.machine_route_process, // Array of process_ids [1,2,3]
      status: machineRouteProcessDetails.status || "active",
      created_by: req.user.id,
      updated_by: req.user.id,
    });

    res.status(201).json({
      message: "Machine route process created successfully",
      data: newMachineRouteProcess,
    });
  } catch (error) {
    logger.error("Error creating machine route process:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET all machine route processes
v1Router.get("/machine-route-process", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status = "active", machine_id } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const whereClause = {
      company_id: req.user.company_id,
    };

    // Status filtering
    if (status !== "all") {
      whereClause.status = status;
    }

    // Machine ID filtering
    if (machine_id) {
      whereClause.machine_id = machine_id;
    }

    // Search functionality (if you have machine names to search by)
    if (search && Machine) {
      // Include machine table for search
      const machineSearch = await Machine.findAll({
        where: {
          company_id: req.user.company_id,
          machine_name: { [Op.like]: `%${search}%` }
        },
        attributes: ['id']
      });
      
      if (machineSearch.length > 0) {
        whereClause.machine_id = {
          [Op.in]: machineSearch.map(m => m.id)
        };
      }
    }

    // Fetch from database with pagination and filters
    const { count, rows } = await MachineRouteProcess.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset: offset,
      order: [["updated_at", "DESC"]],
    });

    // Process each machine route process to include process names and count
    const processedMachineRouteProcesses = await Promise.all(
      rows.map(async (machineRouteProcess) => {
        const machineRouteProcessData = machineRouteProcess.get({ plain: true });

        // Parse machine_route_process from JSON string to array of IDs (similar to route service)
        let processIds;
        try {
          // If it's already an array, use it directly; if it's a string, parse it
          if (Array.isArray(machineRouteProcessData.machine_route_process)) {
            processIds = machineRouteProcessData.machine_route_process;
          } else if (typeof machineRouteProcessData.machine_route_process === 'string') {
            processIds = JSON.parse(machineRouteProcessData.machine_route_process);
          } else {
            processIds = machineRouteProcessData.machine_route_process || [];
          }
        } catch (err) {
          logger.error("Error parsing machine_route_process JSON:", err);
          processIds = [];
        }

        // Ensure it's an array
        if (!Array.isArray(processIds)) {
          logger.error("machine_route_process is not an array:", processIds);
          processIds = [];
        }

        // Calculate process count
        const processCount = processIds.length;

        // Only proceed with fetching process names if we have process IDs
        let processDetails = [];
        if (processIds.length > 0) {
          // Fetch all processes
          const processes = await ProcessName.findAll({
            where: {
              id: {
                [Op.in]: processIds,
              },
            },
            attributes: ["id", "process_name"],
          });

          // Create a map of id -> process for quick lookup
          const processMap = {};
          processes.forEach((process) => {
            processMap[process.id] = {
              id: process.id,
              process_name: process.process_name,
            };
          });

          // Map processes in the ORIGINAL order from machine_route_process
          processDetails = processIds.map(
            (id) => processMap[id] || { id, process_name: "Unknown" }
          );
        }

        // Replace machine_route_process array with the array of process objects
        machineRouteProcessData.machine_route_process = processDetails;
        
        // Add process count
        machineRouteProcessData.process_count = processCount;

        return machineRouteProcessData;
      })
    );

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / limitNum);

    res.json({
      machineRouteProcesses: processedMachineRouteProcesses,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (error) {
    logger.error("Error fetching machine route processes:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET single machine route process by ID
v1Router.get("/machine-route-process/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;

  try {
    const machineRouteProcess = await MachineRouteProcess.findOne({
      where: {
        id,
        company_id: req.user.company_id,
      },
    });

    if (!machineRouteProcess) {
      return res.status(404).json({ message: "Machine route process not found" });
    }

    const machineRouteProcessData = machineRouteProcess.get({ plain: true });

    // Parse machine_route_process from JSON string to array of IDs (similar to route service)
    let processIds;
    try {
      // If it's already an array, use it directly; if it's a string, parse it
      if (Array.isArray(machineRouteProcessData.machine_route_process)) {
        processIds = machineRouteProcessData.machine_route_process;
      } else if (typeof machineRouteProcessData.machine_route_process === 'string') {
        processIds = JSON.parse(machineRouteProcessData.machine_route_process);
      } else {
        processIds = machineRouteProcessData.machine_route_process || [];
      }
    } catch (err) {
      logger.error("Error parsing machine_route_process JSON:", err);
      processIds = [];
    }

    // Ensure it's an array
    if (!Array.isArray(processIds)) {
      logger.error("machine_route_process is not an array:", processIds);
      processIds = [];
    }

    // Only proceed with fetching process names if we have process IDs
    let processDetails = [];
    if (processIds.length > 0) {
      // Fetch process names for the process IDs
      const processes = await ProcessName.findAll({
        where: {
          id: {
            [Op.in]: processIds,
          },
        },
        attributes: ["id", "process_name"],
      });

      // Create a map of id -> process for quick lookup
      const processMap = {};
      processes.forEach((process) => {
        processMap[process.id] = {
          id: process.id,
          process_name: process.process_name,
        };
      });

      // Map processes in the ORIGINAL order from machine_route_process
      processDetails = processIds.map(
        (id) => processMap[id] || { id, process_name: "Unknown" }
      );
    }

    // Replace machine_route_process array with the array of process objects
    machineRouteProcessData.machine_route_process = processDetails;

    res.json({
      data: machineRouteProcessData,
    });
  } catch (error) {
    logger.error("Error fetching machine route process:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// PUT update machine route process
v1Router.put("/machine-route-process/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const machineRouteProcessDetails = req.body;

  if (!machineRouteProcessDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  try {
    // Find the machine route process
    const machineRouteProcess = await MachineRouteProcess.findOne({
      where: {
        id,
        company_id: req.user.company_id,
      },
    });

    if (!machineRouteProcess) {
      return res.status(404).json({ message: "Machine route process not found" });
    }

    // Update machine route process
    await machineRouteProcess.update({
      machine_id: machineRouteProcessDetails.machine_id || machineRouteProcess.machine_id,
      machine_route_process: machineRouteProcessDetails.machine_route_process || machineRouteProcess.machine_route_process,
      status: machineRouteProcessDetails.status || machineRouteProcess.status,
      updated_by: req.user.id,
    });

    // Get updated machine route process with process names
    const updatedMachineRouteProcess = machineRouteProcess.get({ plain: true });

    // Parse machine_route_process from JSON string to array of IDs (similar to route service)
    let processIds;
    try {
      // If it's already an array, use it directly; if it's a string, parse it
      if (Array.isArray(updatedMachineRouteProcess.machine_route_process)) {
        processIds = updatedMachineRouteProcess.machine_route_process;
      } else if (typeof updatedMachineRouteProcess.machine_route_process === 'string') {
        processIds = JSON.parse(updatedMachineRouteProcess.machine_route_process);
      } else {
        processIds = updatedMachineRouteProcess.machine_route_process || [];
      }
    } catch (err) {
      logger.error("Error parsing machine_route_process JSON:", err);
      processIds = [];
    }

    // Ensure it's an array
    if (!Array.isArray(processIds)) {
      logger.error("machine_route_process is not an array:", processIds);
      processIds = [];
    }

    // Only proceed with fetching process names if we have process IDs
    let processDetails = [];
    if (processIds.length > 0) {
      // Fetch process names for the process IDs
      const processes = await ProcessName.findAll({
        where: {
          id: {
            [Op.in]: processIds,
          },
        },
        attributes: ["id", "process_name"],
      });

      // Create a map of id -> process for quick lookup
      const processMap = {};
      processes.forEach((process) => {
        processMap[process.id] = {
          id: process.id,
          process_name: process.process_name,
        };
      });

      // Map processes in the ORIGINAL order from machine_route_process
      processDetails = processIds.map(
        (id) => processMap[id] || { id, process_name: "Unknown" }
      );
    }

    // Replace machine_route_process array with the array of process objects for response
    updatedMachineRouteProcess.machine_route_process = processDetails;

    res.json({
      message: "Machine route process updated successfully",
      data: updatedMachineRouteProcess,
    });
  } catch (error) {
    logger.error("Error updating machine route process:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// DELETE machine route process (soft delete)
v1Router.delete("/machine-route-process/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;

  try {
    // Find the machine route process
    const machineRouteProcess = await MachineRouteProcess.findOne({
      where: {
        id,
        company_id: req.user.company_id,
      },
    });

    if (!machineRouteProcess) {
      return res.status(404).json({ message: "Machine route process not found" });
    }

    // Soft delete - update status to inactive
    await machineRouteProcess.update({
      status: "inactive",
      updated_by: req.user.id,
      updated_at: new Date(),
    });

    res.json({
      message: "Machine route process successfully marked as inactive",
      data: machineRouteProcess.get({ plain: true }),
    });
  } catch (error) {
    logger.error("Error soft deleting machine route process:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET machine route processes by machine ID
// v1Router.get("/machine/:machineId/route-process", authenticateJWT, async (req, res) => {
//   const { machineId } = req.params;

//   try {
//     const machineRouteProcesses = await MachineRouteProcess.findAll({
//       where: {
//         machine_id: machineId,
//         company_id: req.user.company_id,
//         status: "active",
//       },
//       order: [["updated_at", "DESC"]],
//     });

//     // Process each machine route process to include process names
//     const processedMachineRouteProcesses = await Promise.all(
//       machineRouteProcesses.map(async (machineRouteProcess) => {
//         const machineRouteProcessData = machineRouteProcess.get({ plain: true });

//         // Parse machine_route_process from JSON string to array of IDs (similar to route service)
//         let processIds;
//         try {
//           // If it's already an array, use it directly; if it's a string, parse it
//           if (Array.isArray(machineRouteProcessData.machine_route_process)) {
//             processIds = machineRouteProcessData.machine_route_process;
//           } else if (typeof machineRouteProcessData.machine_route_process === 'string') {
//             processIds = JSON.parse(machineRouteProcessData.machine_route_process);
//           } else {
//             processIds = machineRouteProcessData.machine_route_process || [];
//           }
//         } catch (err) {
//           logger.error("Error parsing machine_route_process JSON:", err);
//           processIds = [];
//         }

//         // Ensure it's an array
//         if (!Array.isArray(processIds)) {
//           logger.error("machine_route_process is not an array:", processIds);
//           processIds = [];
//         }

//         // Only proceed with fetching process names if we have process IDs
//         let processDetails = [];
//         if (processIds.length > 0) {
//           // Fetch process names for the process IDs
//           const processes = await ProcessName.findAll({
//             where: {
//               id: {
//                 [Op.in]: processIds,
//               },
//             },
//             attributes: ["id", "process_name"],
//           });

//           // Create a map of id -> process for quick lookup
//           const processMap = {};
//           processes.forEach((process) => {
//             processMap[process.id] = {
//               id: process.id,
//               process_name: process.process_name,
//             };
//           });

//           // Map processes in the ORIGINAL order from machine_route_process
//           processDetails = processIds.map(
//             (id) => processMap[id] || { id, process_name: "Unknown" }
//           );
//         }

//         // Replace machine_route_process array with the array of process objects
//         machineRouteProcessData.machine_route_process = processDetails;

//         return machineRouteProcessData;
//       })
//     );

//     res.json({
//       data: processedMachineRouteProcesses,
//     });
//   } catch (error) {
//     logger.error("Error fetching machine route processes by machine ID:", error);
//     res
//       .status(500)
//       .json({ message: "Internal Server Error", error: error.message });
//   }
// });

// POST create new route
v1Router.post("/route", authenticateJWT, async (req, res) => {
  const routeDetails = req.body;

  if (
    !routeDetails ||
    !routeDetails.route_name ||
    !routeDetails.route_process
  ) {
    return res.status(400).json({
      message: "Invalid input data. Route name and processes are required.",
    });
  }

  try {

    const route_generate_id = await generateId(req.user.company_id, Route, "route");
    // Create Route
    const newRoute = await Route.create({
      route_generate_id: route_generate_id,
      company_id: req.user.company_id,
      route_name: routeDetails.route_name,
      route_process: routeDetails.route_process, // Array of process_ids [1,2,3]
      status: routeDetails.status || "active",
      created_by: req.user.id,
      updated_by: req.user.id,
    });

    res.status(201).json({
      message: "Route created successfully",
      data: newRoute,
    });
  } catch (error) {
    logger.error("Error creating route:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// Modify the GET all routes endpoint
v1Router.get("/route", authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status = "active" } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const whereClause = {
      company_id: req.user.company_id,
    };

    // Status filtering
    if (status !== "all") {
      whereClause.status = status;
    }

    // Search functionality
    if (search) {
      whereClause[Op.or] = [{ route_name: { [Op.like]: `%${search}%` } }];
    }

    // Fetch from database with pagination and filters
    const { count, rows } = await Route.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset: offset,
      order: [["updated_at", "DESC"]],
    });

    // Process each route to include process names and count
    const processedRoutes = await Promise.all(
      rows.map(async (route) => {
        const routeData = route.get({ plain: true });

        // Parse route_process from JSON string to array of IDs
        let processIds;
        try {
          processIds = JSON.parse(routeData.route_process);
        } catch (err) {
          logger.error("Error parsing route_process JSON:", err);
          processIds = [];
        }

        // Calculate process count
        const processCount = Array.isArray(processIds) ? processIds.length : 0;

        // Only proceed with fetching process names if we have process IDs
        let processDetails = [];
        if (Array.isArray(processIds) && processIds.length > 0) {
          // Fetch all processes
          const processes = await ProcessName.findAll({
            where: {
              id: {
                [Op.in]: processIds,
              },
            },
            attributes: ["id", "process_name"],
          });

          // Create a map of id -> process for quick lookup
          const processMap = {};
          processes.forEach((process) => {
            processMap[process.id] = {
              id: process.id,
              process_name: process.process_name,
            };
          });

          // Map processes in the ORIGINAL order from route_process
          processDetails = processIds.map(
            (id) => processMap[id] || { id, process_name: "Unknown" }
          );
        }

        // Replace route_process string with the array of process objects
        routeData.route_process = processDetails;
        
        // Add process count
        routeData.process_count = processCount;

        // Remove the separate processes field if it exists
        if (routeData.processes) {
          delete routeData.processes;
        }

        return routeData;
      })
    );

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / limitNum);

    res.json({
      routes: processedRoutes,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (error) {
    logger.error("Error fetching routes:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// GET single route by ID - Apply the same fix
v1Router.get("/route/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;

  try {
    const route = await Route.findOne({
      where: {
        id,
        company_id: req.user.company_id,
      },
    });

    if (!route) {
      return res.status(404).json({ message: "Route not found" });
    }

    const routeData = route.get({ plain: true });

    // Parse route_process from JSON string to array of IDs
    let processIds;
    try {
      processIds = JSON.parse(routeData.route_process);
    } catch (err) {
      logger.error("Error parsing route_process JSON:", err);
      processIds = [];
    }

    // Only proceed with fetching process names if we have process IDs
    let processDetails = [];
    if (Array.isArray(processIds) && processIds.length > 0) {
      // Fetch process names for the process IDs
      const processes = await ProcessName.findAll({
        where: {
          id: {
            [Op.in]: processIds,
          },
        },
        attributes: ["id", "process_name"],
      });

      // Create a map of id -> process for quick lookup
      const processMap = {};
      processes.forEach((process) => {
        processMap[process.id] = {
          id: process.id,
          process_name: process.process_name,
        };
      });

      // Map processes in the ORIGINAL order from route_process
      processDetails = processIds.map(
        (id) => processMap[id] || { id, process_name: "Unknown" }
      );
    }

    // Replace route_process string with the array of process objects
    routeData.route_process = processDetails;

    // Remove the separate processes field if it exists
    if (routeData.processes) {
      delete routeData.processes;
    }

    res.json({
      data: routeData,
    });
  } catch (error) {
    logger.error("Error fetching route:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// Also fix the PUT route update to maintain consistency
v1Router.put("/route/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const routeDetails = req.body;

  if (!routeDetails) {
    return res.status(400).json({ message: "Invalid input data" });
  }

  try {
    // Find the route
    const route = await Route.findOne({
      where: {
        id,
        company_id: req.user.company_id,
      },
    });

    if (!route) {
      return res.status(404).json({ message: "Route not found" });
    }

    // Update route
    await route.update({
      route_name: routeDetails.route_name || route.route_name,
      route_process: routeDetails.route_process || route.route_process,
      status: routeDetails.status || route.status,
      updated_by: req.user.id,
    });

    // Get updated route with process names
    const updatedRoute = route.get({ plain: true });

    // Parse route_process
    let processIds;
    try {
      processIds = JSON.parse(updatedRoute.route_process);
    } catch (err) {
      logger.error("Error parsing route_process JSON:", err);
      processIds = [];
    }

    // Fetch process names for the process IDs
    const processes = await ProcessName.findAll({
      where: {
        id: {
          [Op.in]: processIds,
        },
      },
      attributes: ["id", "process_name"],
    });

    // Create a map of id -> process for quick lookup
    const processMap = {};
    processes.forEach((process) => {
      processMap[process.id] = {
        process_id: process.id,
        process_name: process.process_name,
      };
    });

    // Map processes in the ORIGINAL order from route_process
    updatedRoute.processes = processIds.map(
      (id) => processMap[id] || { process_id: id, process_name: "Unknown" }
    );

    res.json({
      message: "Route updated successfully",
      data: updatedRoute,
    });
  } catch (error) {
    logger.error("Error updating route:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// DELETE route (soft delete)
v1Router.delete("/route/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;

  try {
    // Find the route
    const route = await Route.findOne({
      where: {
        id,
        company_id: req.user.company_id,
      },
    });

    if (!route) {
      return res.status(404).json({ message: "Route not found" });
    }

    // Soft delete - update status to inactive
    await route.update({
      status: "inactive",
      updated_by: req.user.id,
      updated_at: new Date(),
    });

    res.json({
      message: "Route successfully marked as inactive",
      data: route.get({ plain: true }),
    });
  } catch (error) {
    logger.error("Error soft deleting route:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});









// Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
  });
});

// Use Version 1 Router
app.use("/api/mapping", v1Router);

await db.sequelize.sync();
const PORT = 3027;
app.listen(process.env.PORT_ROUTE,'0.0.0.0', () => {
  console.log(`Route Service running on port ${process.env.PORT_ROUTE}`);
});
