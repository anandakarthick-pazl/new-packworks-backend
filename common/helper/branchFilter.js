// // middleware/branchFilter.js (FINAL WORKING VERSION)
// import { Op } from "sequelize";

// let globalBranchId = null;

// /**
//  * Branch Filter Middleware for Microservice
//  * Extracts branch ID from headers and sets up automatic filtering
//  */
// export const branchFilterMiddleware = (req, res, next) => {
//   try {
//     // Extract company_branch_id from headers
//     const branchId = req.headers['company-branch-id'] || 
//                      req.headers['company_branch_id'] || 
//                      req.headers['x-branch-id'];

//     // Store globally for this request
//     globalBranchId = branchId;
//     req.branchId = branchId;

//     // Add branch info to response for debugging
//     const originalJson = res.json;
//     res.json = function(data) {
//       if (data && typeof data === 'object' && !Array.isArray(data)) {
//         data.appliedBranchFilter = branchId || null;
//       }
//       return originalJson.call(this, data);
//     };

//     next();
//   } catch (error) {
//     console.error('Branch Filter Error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error processing branch filter',
//       error: error.message
//     });
//   }
// };

// /**
//  * Reset branch filter after request
//  */
// export const resetBranchFilter = (req, res, next) => {
//   res.on('finish', () => {
//     globalBranchId = null;
//   });
//   next();
// };

// /**
//  * Setup automatic branch filtering for this microservice
//  * Call this once after importing your models
//  */
// export const setupBranchFiltering = (sequelize) => {
//   // Only add the basic hooks that exist in all Sequelize versions
//   sequelize.addHook('beforeFind', (options) => {
//     if (globalBranchId) {
//       options.where = addBranchToWhere(options.where, globalBranchId);
//     }
//   });

//   sequelize.addHook('beforeCreate', (instance, options) => {
//     if (globalBranchId && instance.dataValues) {
//       instance.dataValues.company_branch_id = globalBranchId;
//     }
//   });

//   sequelize.addHook('beforeBulkCreate', (instances, options) => {
//     if (globalBranchId && Array.isArray(instances)) {
//       instances.forEach(instance => {
//         if (instance.dataValues) {
//           instance.dataValues.company_branch_id = globalBranchId;
//         } else if (instance) {
//           instance.company_branch_id = globalBranchId;
//         }
//       });
//     }
//   });

//   sequelize.addHook('beforeUpdate', (instance, options) => {
//     if (globalBranchId && instance.dataValues) {
//       instance.dataValues.company_branch_id = globalBranchId;
//     }
//   });

//   sequelize.addHook('beforeBulkUpdate', (options) => {
//     if (globalBranchId) {
//       options.where = addBranchToWhere(options.where, globalBranchId);
//     }
//   });

//   sequelize.addHook('beforeBulkDestroy', (options) => {
//     if (globalBranchId) {
//       options.where = addBranchToWhere(options.where, globalBranchId);
//     }
//   });
// };

// /**
//  * Patch specific models for branch filtering (RECOMMENDED APPROACH)
//  * Call this for each model that needs branch filtering
//  */
// export const patchModelForBranchFiltering = (Model) => {
//   // Store original methods
//   if (!Model._originalFindAndCountAll) {
//     Model._originalFindAndCountAll = Model.findAndCountAll;
//     Model._originalFindAll = Model.findAll;
//     Model._originalCount = Model.count;
//     Model._originalFindOne = Model.findOne;
    
//     // Override findAndCountAll
//     Model.findAndCountAll = function(options = {}) {
//       if (globalBranchId) {
//         options.where = addBranchToWhere(options.where, globalBranchId);
        
//         // Ensure distinct count for joins
//         if (options.include && options.include.length > 0) {
//           options.distinct = true;
//         }
//       }
//       return Model._originalFindAndCountAll.call(this, options);
//     };
    
//     // Override findAll
//     Model.findAll = function(options = {}) {
//       if (globalBranchId) {
//         options.where = addBranchToWhere(options.where, globalBranchId);
//       }
//       return Model._originalFindAll.call(this, options);
//     };
    
//     // Override count
//     Model.count = function(options = {}) {
//       if (globalBranchId) {
//         options.where = addBranchToWhere(options.where, globalBranchId);
//       }
//       return Model._originalCount.call(this, options);
//     };
    
//     // Override findOne
//     Model.findOne = function(options = {}) {
//       if (globalBranchId) {
//         options.where = addBranchToWhere(options.where, globalBranchId);
//       }
//       return Model._originalFindOne.call(this, options);
//     };
//   }
// };

// /**
//  * Helper function to add branch filter to where clause
//  */
// const addBranchToWhere = (where, branchId) => {
//   if (!where) {
//     return { company_branch_id: branchId };
//   }

//   // If where clause already has company_branch_id, don't override it
//   if (where.company_branch_id !== undefined) {
//     return where;
//   }

//   if (typeof where === 'object' && !Array.isArray(where) && where.constructor === Object) {
//     return {
//       ...where,
//       company_branch_id: branchId
//     };
//   }

//   return {
//     [Op.and]: [
//       where,
//       { company_branch_id: branchId }
//     ]
//   };
// };

// export { globalBranchId };


// middleware/branchFilter.js (FIXED - NO CONTROLLER CHANGES NEEDED)
import { Op } from "sequelize";

let globalBranchId = null;

/**
 * Branch Filter Middleware for Microservice
 * Extracts branch ID from headers and sets up automatic filtering
 */
export const branchFilterMiddleware = (req, res, next) => {
  try {
    // Extract company_branch_id from headers
    const branchId = req.headers['company-branch-id'] || 
                     req.headers['company_branch_id'] || 
                     req.headers['x-branch-id'];

    console.log('🔹 Branch Filter Middleware - Branch ID:', branchId);
    console.log('🔹 Request URL:', req.url);
    console.log('🔹 Request Method:', req.method);

    // Store globally for this request
    globalBranchId = branchId;
    req.branchId = branchId;

    // Add branch info to response for debugging
    const originalJson = res.json;
    res.json = function(data) {
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        data.appliedBranchFilter = branchId || null;
      }
      return originalJson.call(this, data);
    };

    next();
  } catch (error) {
    console.error('Branch Filter Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing branch filter',
      error: error.message
    });
  }
};

/**
 * Reset branch filter after request
 */
export const resetBranchFilter = (req, res, next) => {
  res.on('finish', () => {
    console.log('🔹 Resetting branch filter');
    globalBranchId = null;
  });
  next();
};

/**
 * Setup automatic branch filtering for this microservice
 * Call this once after importing your models
 */
export const setupBranchFiltering = (sequelize) => {
  console.log('🔹 Setting up branch filtering hooks');

  // Hook for all find operations
  sequelize.addHook('beforeFind', (options) => {
    if (globalBranchId) {
      console.log('🔹 beforeFind - Adding branch filter:', globalBranchId);
      options.where = addBranchToWhere(options.where, globalBranchId);
    }
  });

  // CRITICAL FIX: beforeValidate runs before beforeCreate and is more reliable
  sequelize.addHook('beforeValidate', (instance, options) => {
    if (globalBranchId && instance && !instance.company_branch_id) {
      console.log('🔹 beforeValidate - Setting branch ID:', globalBranchId);
      console.log('🔹 Instance type:', instance.constructor.name);
      
      // Set the branch ID using all possible methods
      try {
        if (instance.dataValues) {
          instance.dataValues.company_branch_id = globalBranchId;
          console.log('🔹 Set via dataValues');
        }
        
        if (typeof instance.setDataValue === 'function') {
          instance.setDataValue('company_branch_id', globalBranchId);
          console.log('🔹 Set via setDataValue');
        }
        
        if (typeof instance.set === 'function') {
          instance.set('company_branch_id', globalBranchId);
          console.log('🔹 Set via set method');
        }
        
        // Direct property assignment
        instance.company_branch_id = globalBranchId;
        console.log('🔹 Set via direct assignment');
        
        // For extra safety, also set it in _previousDataValues if it exists
        if (instance._previousDataValues) {
          instance._previousDataValues.company_branch_id = globalBranchId;
        }
        
      } catch (error) {
        console.error('🔹 Error setting branch ID in beforeValidate:', error);
      }
    }
  });

  // Keep the original beforeCreate as a backup
  sequelize.addHook('beforeCreate', (instance, options) => {
    if (globalBranchId && instance) {
      console.log('🔹 beforeCreate - Ensuring branch ID is set:', globalBranchId);
      console.log('🔹 Current instance company_branch_id:', instance.company_branch_id);
      
      // Only set if not already set
      if (!instance.company_branch_id) {
        try {
          if (instance.dataValues) {
            instance.dataValues.company_branch_id = globalBranchId;
          }
          if (typeof instance.setDataValue === 'function') {
            instance.setDataValue('company_branch_id', globalBranchId);
          }
          if (typeof instance.set === 'function') {
            instance.set('company_branch_id', globalBranchId);
          }
          instance.company_branch_id = globalBranchId;
        } catch (error) {
          console.error('🔹 Error in beforeCreate hook:', error);
        }
      }
    }
  });

  // Fix for bulk create operations
  sequelize.addHook('beforeBulkCreate', (instances, options) => {
    if (globalBranchId && Array.isArray(instances)) {
      console.log('🔹 beforeBulkCreate - Setting branch ID for', instances.length, 'instances');
      
      instances.forEach((instance, index) => {
        if (instance && !instance.company_branch_id) {
          try {
            if (instance.dataValues) {
              instance.dataValues.company_branch_id = globalBranchId;
            }
            if (typeof instance.setDataValue === 'function') {
              instance.setDataValue('company_branch_id', globalBranchId);
            }
            if (typeof instance.set === 'function') {
              instance.set('company_branch_id', globalBranchId);
            }
            instance.company_branch_id = globalBranchId;
            console.log(`🔹 Set branch ID for instance ${index}`);
          } catch (error) {
            console.error(`🔹 Error setting branch ID for instance ${index}:`, error);
          }
        }
      });
    }
  });

  // Don't modify existing records' branch IDs on update
  sequelize.addHook('beforeUpdate', (instance, options) => {
    // Only log, don't change branch ID on updates
    if (globalBranchId && instance) {
      console.log('🔹 beforeUpdate - Current branch ID:', instance.company_branch_id);
    }
  });

  sequelize.addHook('beforeBulkUpdate', (options) => {
    if (globalBranchId) {
      console.log('🔹 beforeBulkUpdate - Adding branch filter');
      options.where = addBranchToWhere(options.where, globalBranchId);
    }
  });

  sequelize.addHook('beforeBulkDestroy', (options) => {
    if (globalBranchId) {
      console.log('🔹 beforeBulkDestroy - Adding branch filter');
      options.where = addBranchToWhere(options.where, globalBranchId);
    }
  });
};

/**
 * Enhanced model patching that ensures branch ID is set during creation
 * Call this for each model that needs branch filtering
 */
export const patchModelForBranchFiltering = (Model) => {
  console.log('🔹 Patching model:', Model.name);
  
  // Store original methods
  if (!Model._originalCreate) {
    Model._originalFindAndCountAll = Model.findAndCountAll;
    Model._originalFindAll = Model.findAll;
    Model._originalCount = Model.count;
    Model._originalFindOne = Model.findOne;
    Model._originalCreate = Model.create;
    Model._originalBulkCreate = Model.bulkCreate;
    
    // CRITICAL FIX: Override create method to ensure branch ID is ALWAYS set
    Model.create = function(values, options = {}) {
      console.log('🔹 Model.create called for:', Model.name);
      console.log('🔹 Global branch ID:', globalBranchId);
      console.log('🔹 Values before modification:', JSON.stringify(values, null, 2));
      
      if (globalBranchId && values && !values.company_branch_id) {
        console.log('🔹 Setting branch ID in create values');
        values.company_branch_id = globalBranchId;
      }
      
      console.log('🔹 Final values:', JSON.stringify(values, null, 2));
      return Model._originalCreate.call(this, values, options);
    };
    
    // Override bulkCreate method
    Model.bulkCreate = function(records, options = {}) {
      console.log('🔹 Model.bulkCreate called for:', Model.name);
      
      if (globalBranchId && Array.isArray(records)) {
        records.forEach((record, index) => {
          if (record && !record.company_branch_id) {
            console.log(`🔹 Setting branch ID for bulk record ${index}`);
            record.company_branch_id = globalBranchId;
          }
        });
      }
      return Model._originalBulkCreate.call(this, records, options);
    };
    
    // Override findAndCountAll
    Model.findAndCountAll = function(options = {}) {
      if (globalBranchId) {
        console.log('🔹 findAndCountAll - Adding branch filter');
        options.where = addBranchToWhere(options.where, globalBranchId);
        
        // Ensure distinct count for joins
        if (options.include && options.include.length > 0) {
          options.distinct = true;
        }
      }
      return Model._originalFindAndCountAll.call(this, options);
    };
    
    // Override findAll
    Model.findAll = function(options = {}) {
      if (globalBranchId) {
        options.where = addBranchToWhere(options.where, globalBranchId);
      }
      return Model._originalFindAll.call(this, options);
    };
    
    // Override count
    Model.count = function(options = {}) {
      if (globalBranchId) {
        options.where = addBranchToWhere(options.where, globalBranchId);
      }
      return Model._originalCount.call(this, options);
    };
    
    // Override findOne
    Model.findOne = function(options = {}) {
      if (globalBranchId) {
        options.where = addBranchToWhere(options.where, globalBranchId);
      }
      return Model._originalFindOne.call(this, options);
    };
  }
};

/**
 * Helper function to add branch filter to where clause
 */
const addBranchToWhere = (where, branchId) => {
  if (!where) {
    return { company_branch_id: branchId };
  }

  // If where clause already has company_branch_id, don't override it
  if (where.company_branch_id !== undefined) {
    return where;
  }

  if (typeof where === 'object' && !Array.isArray(where) && where.constructor === Object) {
    return {
      ...where,
      company_branch_id: branchId
    };
  }

  return {
    [Op.and]: [
      where,
      { company_branch_id: branchId }
    ]
  };
};

export { globalBranchId };