// // middleware/branchFilter.js (Create this file in your client microservice)
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
//   // Add global hooks to all database operations
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
//  * Helper function to add branch filter to where clause
//  */
// const addBranchToWhere = (where, branchId) => {
//   if (!where) {
//     return { company_branch_id: branchId };
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


// middleware/branchFilter.js (FINAL WORKING VERSION)
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
    globalBranchId = null;
  });
  next();
};

/**
 * Setup automatic branch filtering for this microservice
 * Call this once after importing your models
 */
export const setupBranchFiltering = (sequelize) => {
  // Only add the basic hooks that exist in all Sequelize versions
  sequelize.addHook('beforeFind', (options) => {
    if (globalBranchId) {
      options.where = addBranchToWhere(options.where, globalBranchId);
    }
  });

  sequelize.addHook('beforeCreate', (instance, options) => {
    if (globalBranchId && instance.dataValues) {
      instance.dataValues.company_branch_id = globalBranchId;
    }
  });

  sequelize.addHook('beforeBulkCreate', (instances, options) => {
    if (globalBranchId && Array.isArray(instances)) {
      instances.forEach(instance => {
        if (instance.dataValues) {
          instance.dataValues.company_branch_id = globalBranchId;
        } else if (instance) {
          instance.company_branch_id = globalBranchId;
        }
      });
    }
  });

  sequelize.addHook('beforeUpdate', (instance, options) => {
    if (globalBranchId && instance.dataValues) {
      instance.dataValues.company_branch_id = globalBranchId;
    }
  });

  sequelize.addHook('beforeBulkUpdate', (options) => {
    if (globalBranchId) {
      options.where = addBranchToWhere(options.where, globalBranchId);
    }
  });

  sequelize.addHook('beforeBulkDestroy', (options) => {
    if (globalBranchId) {
      options.where = addBranchToWhere(options.where, globalBranchId);
    }
  });
};

/**
 * Patch specific models for branch filtering (RECOMMENDED APPROACH)
 * Call this for each model that needs branch filtering
 */
export const patchModelForBranchFiltering = (Model) => {
  // Store original methods
  if (!Model._originalFindAndCountAll) {
    Model._originalFindAndCountAll = Model.findAndCountAll;
    Model._originalFindAll = Model.findAll;
    Model._originalCount = Model.count;
    Model._originalFindOne = Model.findOne;
    
    // Override findAndCountAll
    Model.findAndCountAll = function(options = {}) {
      if (globalBranchId) {
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