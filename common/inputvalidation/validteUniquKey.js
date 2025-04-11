

const validateUniqueKey = (model, uniqueKeys = []) => {
  return async (req, res, next) => {
    try {
      const company_id = req.user?.company_id;

      if (!company_id) {
        return res.status(400).json({ error: "company_id is required" });
      }

      for (const key of uniqueKeys) {
        if (req.body[key] !== undefined) {
          const whereClause = {
            [key]: req.body[key],
            company_id,
          };

          if (req.body.id) {
            whereClause.id = { [model.sequelize.Op.ne]: req.body.id };
          }

          const existing = await model.findOne({ where: whereClause });

          if (existing) {
            return res.status(409).json({
              error: `${key} must be unique for the given company`,
              field: key,
            });
          }
        }
      }

      next();
    } catch (error) {
      console.error("Validation Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
};

export default validateUniqueKey;
