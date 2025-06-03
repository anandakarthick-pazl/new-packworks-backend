import express, { json, Router } from "express";
import cors from "cors";
import { Op } from "sequelize";
import db from "../../common/models/index.js"; 
import dotenv from "dotenv";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
const Package = db.Package;
const Currency =db.Currency;
const Module = db.Module;



dotenv.config();
const app = express();
app.use(json());
app.use(cors());
const v1Router = Router();

//Swagger



// Get Packages
/**
 * @swagger
 * /packages:
 *   get:
 *     summary: Fetch all active packages with module availability
 *     tags:
 *       - Package
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by package name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: Packages fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Packages Fetched Successfully
 *                 total:
 *                   type: integer
 *                   example: 25
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 totalPages:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       package:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           name:
 *                             type: string
 *                             example: Basic Plan
 *                           module_in_package:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["user", "report", "settings"]
 *                           status:
 *                             type: string
 *                             example: active
 *                       availableModules:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["user", "report"]
 *                       notAvailableModules:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["inventory", "billing"]
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

v1Router.get("/", authenticateJWT, async (req, res) => {
  try {
      const { search = "", page = "1", limit = "10" } = req.query;

      const pageNumber = Math.max(1, parseInt(page)) || 1;
      const limitNumber = Math.max(1, parseInt(limit)) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      let whereCondition = { status: "active" };

      if (search) {   
          whereCondition = {
              ...whereCondition,
              name: { [Op.like]: `%${search}%` }, 
          };
      }

      const packages = await Package.findAll({
          where: whereCondition, 
          limit: limitNumber, 
          offset
      });

      const totalPackages = await Package.count({ where: whereCondition });

      const formattedPackages = packages.map(pkg => ({
          ...pkg.toJSON(), 
          module_in_package: JSON.parse(pkg.module_in_package || "[]") 
      }));

      const modules = await Module.findAll({
          where: {
              status: "active",
              is_superadmin: 0,
              module_name: { [Op.ne]: "dashboards" }
          },
          attributes: ["module_name"]
      });
      
      const responsePackages = formattedPackages.map(pkg => {
          const packageModules = pkg.module_in_package || [];

          
          
          const availableModules = [];
          const notAvailableModules = [];

          modules.forEach(mod => {
              const isAvailable = packageModules.some(pkgModule =>
                mod.module_name.toLowerCase().startsWith(pkgModule.toLowerCase())
              );          
              if (isAvailable) {
                  availableModules.push(mod.module_name);
              } else {
                  notAvailableModules.push(mod.module_name);
              }
          });
          return {

              package: {
                  ...pkg,
                  
              },
              availableModules,
              notAvailableModules
          };
      });

      return res.status(200).json({
          success: true,
          message: "Packages Fetched Successfully",
          total: totalPackages, 
          page: pageNumber, 
          limit: limitNumber,
          totalPages: Math.ceil(totalPackages / limitNumber), 
          data: responsePackages
      }); 
  } catch (error) {
      console.error("Error fetching packages:", error);
      return res.status(500).json({ 
          success: false, 
          message: "Internal server error",
      });
  }
});



// Create Package   
/**
 * @swagger
 * /packages/create:
 *   post:
 *     summary: Create a new package
 *     tags:
 *       - Package
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - currency_id
 *             properties:
 *               name:
 *                 type: string
 *                 example: Premium Package
 *               description:
 *                 type: string
 *                 example: Full access to all modules
 *               currency_id:
 *                 type: integer
 *                 example: 1
 *               module_in_package:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["user", "inventory", "reports"]
 *               price:
 *                 type: number
 *                 format: float
 *                 example: 499.99
 *               duration_in_days:
 *                 type: integer
 *                 example: 30
 *               default:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Package created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Package created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: Premium Package
 *                     description:
 *                       type: string
 *                       example: Full access to all modules
 *                     currency_id:
 *                       type: integer
 *                       example: 1
 *                     module_in_package:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["user", "inventory", "reports"]
 *                     price:
 *                       type: number
 *                       example: 499.99
 *                     duration_in_days:
 *                       type: integer
 *                       example: 30
 *                     isDefault:
 *                       type: boolean
 *                       example: true
 *                     created_by:
 *                       type: integer
 *                       example: 2
 *                     updated_by:
 *                       type: integer
 *                       example: 2
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request (e.g., invalid currency_id)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid currency_id
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */

    v1Router.post("/create", authenticateJWT, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const userId = req.user.id;

      const { module_in_package, default: isDefault, ...rest } = req.body;

      const currency = await Currency.findByPk(rest.currency_id, { transaction });
      if (!currency) {
        await transaction.rollback();
        return res.status(400).json({ status: false, message: "Invalid currency_id" });
      }

      if (Array.isArray(module_in_package)) {
        rest.module_in_package = JSON.stringify(module_in_package);
      }

      rest.created_by= userId;
      rest.updated_by= userId;
      rest.created_at = new Date();
      rest.updated_at = new Date();


      rest.isDefault = isDefault;

      const packages = await Package.create(rest, { transaction });

      await transaction.commit();

      return res.status(201).json({
        success: true,
        message: "Package created successfully",
        data: {
          ...packages.toJSON(),
          module_in_package: JSON.parse(packages.module_in_package),
        },
      });
    } catch (error) {
      await transaction.rollback();
      console.error("Error creating Package:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });




//Get id based packages    
/**
 * @swagger
 * /packages/edit/{packagesId}:
 *   get:
 *     summary: Get package details by ID
 *     tags:
 *       - Package
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: packagesId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the package to fetch
 *     responses:
 *       200:
 *         description: Package fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Package fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     package:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: Premium Package
 *                         description:
 *                           type: string
 *                           example: Full access to all modules
 *                         currency_id:
 *                           type: integer
 *                           example: 1
 *                         module_in_package:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["user", "inventory"]
 *                         price:
 *                           type: number
 *                           example: 499.99
 *                         duration_in_days:
 *                           type: integer
 *                           example: 30
 *                         isDefault:
 *                           type: boolean
 *                           example: true
 *                         created_by:
 *                           type: integer
 *                           example: 2
 *                         updated_by:
 *                           type: integer
 *                           example: 2
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *                     availableModules:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["user", "inventory"]
 *                     notAvailableModules:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["billing", "reporting"]
 *       404:
 *         description: Package not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Package not found
 *                 data:
 *                   type: string
 *                   nullable: true
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 *                 error:
 *                   type: string
 *                   example: Error message (shown only in development)
 */

v1Router.get("/edit/:packagesId", authenticateJWT, async (req, res) => {
  try {
      const { packagesId } = req.params;
      
      // Find the package by ID
      const packages = await Package.findOne({
          where: { id: packagesId },
      });

      if (!packages) {
          return res.status(404).json({
              success: false,
              message: 'Package not found',
              data: null
          });
      }

      // Parse the module_in_package field
      const formattedPackage = {
          ...packages.toJSON(),
          module_in_package: JSON.parse(packages.module_in_package || "[]")
      };

      // Get all active modules from DB
      const modules = await Module.findAll({
          where: {
              status: "active",
              is_superadmin: 0,
              module_name: { [Op.ne]: "dashboards" }
          },
          attributes: ["module_name"]
      });
      
      // Prepare available and not available modules
      const packageModules = formattedPackage.module_in_package || [];
      const availableModules = [];
      const notAvailableModules = [];

      modules.forEach(mod => {
          const isAvailable = packageModules.some(pkgModule =>
              mod.module_name.toLowerCase().startsWith(pkgModule.toLowerCase())
          );
          
          if (isAvailable) {
              availableModules.push(mod.module_name);
          } else {
              notAvailableModules.push(mod.module_name);
          }
      });

      // Prepare the response object
      const responseData = {
          package: {
              ...formattedPackage,
              // Remove if you don't want to expose the raw module_in_package
              // module_in_package: undefined
          },
          availableModules,
          notAvailableModules
      };

      return res.json({
          success: true,
          message: 'Package fetched successfully',
          data: responseData
      });

  } catch (error) {
      console.error("Error fetching package:", error);
      return res.status(500).json({ 
          success: false, 
          message: "Internal server error",
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  }
});



// Update Package   
/**
 * @swagger
 * /packages/update/{id}:
 *   put:
 *     summary: Update an existing package
 *     tags:
 *       - Package
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the package to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Premium Package
 *               description:
 *                 type: string
 *                 example: Updated description
 *               currency_id:
 *                 type: integer
 *                 example: 1
 *               module_in_package:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["user", "billing"]
 *               price:
 *                 type: number
 *                 example: 999.99
 *               duration_in_days:
 *                 type: integer
 *                 example: 90
 *               default:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Package updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Package updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: Premium Package
 *                     description:
 *                       type: string
 *                       example: Updated description
 *                     currency_id:
 *                       type: integer
 *                       example: 1
 *                     module_in_package:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["user", "billing"]
 *                     price:
 *                       type: number
 *                       example: 999.99
 *                     duration_in_days:
 *                       type: integer
 *                       example: 90
 *                     isDefault:
 *                       type: boolean
 *                       example: false
 *                     updated_by:
 *                       type: integer
 *                       example: 2
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input (e.g., currency_id)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid currency_id
 *       404:
 *         description: Package not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Package not found
 *       500:
 *         description: Server error while updating package
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
 
  v1Router.put("/update/:id", authenticateJWT, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const packageId = req.params.id;
      const userId =req.user.id;      
      const { module_in_package, default: isDefault, ...rest } = req.body;

      const existingPackage = await Package.findByPk(packageId, { transaction });
      if (!existingPackage) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "Package not found" });
      }

      if (rest.currency_id) {
        const currency = await Currency.findByPk(rest.currency_id, { transaction });
        if (!currency) {
          await transaction.rollback();
          return res.status(400).json({ success: false, message: "Invalid currency_id" });
        }
      }

      if (Array.isArray(module_in_package)) {
        rest.module_in_package = JSON.stringify(module_in_package);
      }

      rest.updated_by=userId;

      rest.created_at = existingPackage.created_at;  

      rest.updated_at = new Date();

      rest.isDefault = isDefault;

      await Package.update(rest, { where: { id: packageId }, transaction });

      const updatedPackage = await Package.findByPk(packageId, { transaction });

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Package updated successfully",
        data: {
          ...updatedPackage.toJSON(),
          module_in_package: JSON.parse(updatedPackage.module_in_package),
        },
      });
    } catch (error) {
      await transaction.rollback();
      console.error("Error updating Package:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });






//Delete package
/**
 * @swagger
 * /packages/delete/{id}:
 *   delete:
 *     summary: Soft delete a package by setting its status to 'inactive'
 *     tags:
 *       - Package
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the package to delete
 *     responses:
 *       200:
 *         description: Package deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: packages deleted successfully
 *                 data:
 *                   type: array
 *                   items: {}
 *       404:
 *         description: Package not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Packages not found
 *       500:
 *         description: Server error while deleting package
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */

  v1Router.delete("/delete/:id",  authenticateJWT, async (req, res) => {
    const transaction = await sequelize.transaction(); 
    try{
      const { id } = req.params;
      const userId =req.user.id;


      const packages = await Package.findOne({ where: { id } });

      if (!packages) {
        return res.status(404).json({
          success: false,
          message: "Packages not found",
        });
      }

      await packages.update({
        status: 'inactive',
        updated_at: new Date(),
        updated_by: userId
      });
      await transaction.commit();
      return res.status(200).json({
        status: true,
        message: "packages deleted successfully",
        data: [],
      });

    }catch (error) {
        await transaction.rollback();
        console.error("Error Deleted Packages:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
  });


app.use("/api/packages", v1Router);
// await db.sequelize.sync();
const PORT = 3016;
app.listen(process.env.PORT_PACKAGE,'0.0.0.0', () => {
  console.log(`packages Service running on port ${process.env.PORT_PACKAGE}`);
});