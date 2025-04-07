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



// Get Packages
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
await db.sequelize.sync();
const PORT = 3016;
app.listen(PORT, () => {
  console.log(`packages Service running on port ${PORT}`);
});