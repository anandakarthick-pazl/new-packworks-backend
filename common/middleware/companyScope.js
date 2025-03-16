// middleware/companyScope.js
import db from "../models/index.js";

const companyScope = (req, res, next) => {
  // Assuming you have company_id in your request (from JWT token, session, etc.)
  const companyId = req.user?.company_id;

  if (!companyId) {
    return res.status(403).json({ error: "Company ID is required." });
  }

  // Function to add company_id scope to queries
  const addCompanyScope = (model) => {
    if (!model || !model.rawAttributes?.company_id) return;

    const originalFindAll = model.findAll;
    const originalFindOne = model.findOne;
    const originalCreate = model.create;

    // Override findAll
    model.findAll = function (options = {}) {
      options.where = { ...options.where, company_id: companyId };
      return originalFindAll.call(this, options);
    };

    // Override findOne
    model.findOne = function (options = {}) {
      options.where = { ...options.where, company_id: companyId };
      return originalFindOne.call(this, options);
    };

    // Override create
    model.create = function (data, options = {}) {
      data.company_id = companyId;
      return originalCreate.call(this, data, options);
    };
  };

  // Apply scope to all models
  Object.values(db).forEach((model) => {
    if (typeof model === "function") {
      addCompanyScope(model);
    }
  });

  next();
};

export default companyScope;
