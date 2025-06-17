import express, { json, Router } from "express";
import cors from "cors";
import db from "../../common/models/index.js";
import dotenv from "dotenv";
import logger from "../../common/helper/logger.js";
import { Op } from "sequelize";
import sequelize from "../../common/database/database.js";
import { authenticateJWT } from "../../common/middleware/auth.js";
import Country from "../../common/models/country.model.js";
import { sendEmail } from "../../common/helper/emailService.js";
import { DemoRequestCustomerTemplate } from "../../common/services/email/templates/demoRequestCustomer.js";
import { DemoRequestAdminTemplate } from "../../common/services/email/templates/demoRequestAdmin.js";
import { ForgotPasswordTemplate } from "../../common/services/email/templates/forgotPassword.js";
import { PasswordResetSuccessTemplate } from "../../common/services/email/templates/passwordResetSuccess.js";
import { ContactFormCustomerTemplate } from "../../common/services/email/templates/contactFormCustomer.js";
import { ContactFormAdminTemplate } from "../../common/services/email/templates/contactFormAdmin.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
app.use(json());
app.use(cors());

const v1Router = Router();

const DropdownName = db.DropdownName;
const DropdownValue = db.DropdownValue;
const Currency = db.Currency;
const Flute = db.Flute;
const ModuleSettings = db.ModuleSettings;
const Module = db.Module;
const Company = db.Company;
const Die = db.Die;
const States = db.States;
const Color = db.Color;
const WorkOrderStatus = db.WorkOrderStatus;
const User = db.User;
const UserAuth = db.UserAuth;
const DemoRequest = db.DemoRequest;
const PasswordReset = db.PasswordReset;
const ContactMessage = db.ContactMessage;
const Package = db.Package;

// 🔹 Packages/Pricing APIs (Public - No Authentication Required)

// GET: Get all active packages for pricing page
v1Router.get("/packages", async (req, res) => {
  try {
    const {
      billing_cycle, // 'monthly' or 'annual' or 'both'
      is_recommended,
      sort_by = 'sort',
      sort_order = 'ASC'
    } = req.query;

    const whereClause = {
      status: 'active',
      is_private: 0 // Only show public packages
    };

    // Filter by recommended packages if requested
    if (is_recommended === 'true') {
      whereClause.is_recommended = 1;
    }

    // Get packages with currency information
    const packages = await Package.findAll({
      where: whereClause,
      include: [
        {
          model: Currency,
          as: 'currency',
          attributes: ['id', 'currency_name', 'currency_symbol', 'currency_code'],
          required: false
        }
      ],
      order: [[sort_by, sort_order.toUpperCase()]],
      attributes: [
        'id',
        'name', 
        'description',
        'monthly_price',
        'annual_price',
        'max_employees',
        'module_in_package',
        'is_recommended',
        'is_free',
        'billing_cycle',
        'monthly_status',
        'annual_status',
        'max_storage_size',
        'storage_unit',
        'sort'
      ]
    });

    // Format packages for frontend
    const formattedPackages = packages.map(pkg => {
      const packageData = pkg.toJSON();
      
      // Parse module_in_package if it's a JSON string
      let features = [];
      try {
        if (packageData.module_in_package) {
          // If it's a JSON string, parse it
          if (typeof packageData.module_in_package === 'string') {
            features = JSON.parse(packageData.module_in_package);
          } else {
            features = packageData.module_in_package;
          }
        }
      } catch (error) {
        // If parsing fails, split by comma or newline
        features = packageData.module_in_package
          ? packageData.module_in_package.split(/[,\n]/).map(f => f.trim()).filter(f => f)
          : [];
      }

      // Format pricing based on billing cycle filter
      const pricing = {};
      
      if (!billing_cycle || billing_cycle === 'both' || billing_cycle === 'monthly') {
        if (packageData.monthly_status === '1' && packageData.monthly_price !== null) {
          pricing.monthly = {
            price: parseFloat(packageData.monthly_price),
            currency: packageData.currency?.currency_symbol || '$',
            billing_cycle: 'monthly'
          };
        }
      }
      
      if (!billing_cycle || billing_cycle === 'both' || billing_cycle === 'annual') {
        if (packageData.annual_status === '1' && packageData.annual_price !== null) {
          pricing.annual = {
            price: parseFloat(packageData.annual_price),
            currency: packageData.currency?.currency_symbol || '$',
            billing_cycle: 'annual',
            savings: packageData.monthly_price 
              ? Math.round((parseFloat(packageData.monthly_price) * 12 - parseFloat(packageData.annual_price)) / (parseFloat(packageData.monthly_price) * 12) * 100)
              : 0
          };
        }
      }

      return {
        id: packageData.id,
        name: packageData.name,
        description: packageData.description,
        features: features,
        pricing: pricing,
        maxUsers: packageData.max_employees,
        maxStorage: {
          size: packageData.max_storage_size,
          unit: packageData.storage_unit
        },
        isRecommended: packageData.is_recommended === 1,
        isFree: packageData.is_free === 1,
        sort: packageData.sort
      };
    });

    // Filter out packages that don't have pricing for the requested billing cycle
    const filteredPackages = formattedPackages.filter(pkg => {
      if (billing_cycle === 'monthly') {
        return pkg.pricing.monthly;
      } else if (billing_cycle === 'annual') {
        return pkg.pricing.annual;
      }
      return Object.keys(pkg.pricing).length > 0;
    });

    return res.status(200).json({
      status: true,
      message: 'Packages fetched successfully',
      data: {
        packages: filteredPackages,
        count: filteredPackages.length
      }
    });

  } catch (error) {
    logger.error('Error fetching packages:', error);
    return res.status(500).json({
      status: false,
      message: 'Internal Server Error',
      error: error.message,
      data: []
    });
  }
});

// GET: Get single package by ID
v1Router.get("/packages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const packageResult = await Package.findOne({
      where: {
        id: id,
        status: 'active',
        is_private: 0
      },
      include: [
        {
          model: Currency,
          as: 'currency',
          attributes: ['id', 'currency_name', 'currency_symbol', 'currency_code'],
          required: false
        }
      ]
    });
    
    if (!packageResult) {
      return res.status(404).json({
        status: false,
        message: 'Package not found',
        data: []
      });
    }

    const packageData = packageResult.toJSON();
    
    // Parse features
    let features = [];
    try {
      if (packageData.module_in_package) {
        if (typeof packageData.module_in_package === 'string') {
          features = JSON.parse(packageData.module_in_package);
        } else {
          features = packageData.module_in_package;
        }
      }
    } catch (error) {
      features = packageData.module_in_package
        ? packageData.module_in_package.split(/[,\n]/).map(f => f.trim()).filter(f => f)
        : [];
    }

    const formattedPackage = {
      id: packageData.id,
      name: packageData.name,
      description: packageData.description,
      features: features,
      pricing: {
        monthly: packageData.monthly_status === '1' ? {
          price: parseFloat(packageData.monthly_price || 0),
          currency: packageData.currency?.currency_symbol || '$',
          billing_cycle: 'monthly'
        } : null,
        annual: packageData.annual_status === '1' ? {
          price: parseFloat(packageData.annual_price || 0),
          currency: packageData.currency?.currency_symbol || '$',
          billing_cycle: 'annual',
          savings: packageData.monthly_price 
            ? Math.round((parseFloat(packageData.monthly_price) * 12 - parseFloat(packageData.annual_price)) / (parseFloat(packageData.monthly_price) * 12) * 100)
            : 0
        } : null
      },
      maxUsers: packageData.max_employees,
      maxStorage: {
        size: packageData.max_storage_size,
        unit: packageData.storage_unit
      },
      isRecommended: packageData.is_recommended === 1,
      isFree: packageData.is_free === 1
    };

    return res.status(200).json({
      status: true,
      message: 'Package fetched successfully',
      data: formattedPackage
    });

  } catch (error) {
    logger.error('Error fetching package:', error);
    return res.status(500).json({
      status: false,
      message: 'Internal Server Error',
      error: error.message,
      data: []
    });
  }
});

// Basic Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Service is running",
    timestamp: new Date(),
  });
});

// Use Version 1 Router
app.use("/api/common-service", v1Router);

// Start the server
const PORT = 3008;
app.listen(process.env.PORT_COMMON,'0.0.0.0', () => {
  console.log(`Common Service running on port ${process.env.PORT_COMMON}`);
});

export default app;
