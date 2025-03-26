import { DataTypes, Model } from "sequelize";
import sequelize from "../database/database.js";

class BaseModel extends Model {
  static init(attributes, options) {
    // Ensure company_id is added to model if not already present
    if (!attributes.company_id) {
      attributes.company_id = {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "companies",
          key: "id",
        },
      };
    }

    super.init(attributes, { ...options, sequelize });

    // Global Hook Before Create - Set company_id
    this.addHook("beforeCreate", (instance, options) => {
      const companyId = this.extractCompanyId(options);
      if (companyId) {
        instance.company_id = companyId;
      }
      console.log("object123", instance);
    });

    // Global Hook Before Update - Enforce company_id
    this.addHook("beforeUpdate", (instance, options) => {
      const companyId = this.extractCompanyId(options);
      if (companyId) {
        instance.company_id = companyId;
      }
    });

    // Global Hook Before Find - Apply company scope
    this.addHook("beforeFind", (options) => {
      const companyId = this.extractCompanyId(options);

      // Respect existing where conditions
      options.where = options.where || {};

      // Add company_id to where clause if not explicitly bypassed
      if (companyId && options.bypassCompanyScope !== true) {
        options.where.company_id = companyId;
      }
    });

    // Global Hook Before Destroy - Enforce company_id
    this.addHook("beforeDestroy", (instance, options) => {
      const companyId = this.extractCompanyId(options);
      if (companyId) {
        instance.company_id = companyId;
      }
    });
  }

  // Static method to extract company ID from various sources
  static extractCompanyId(options) {
    // Priority order for company_id:
    // 1. Explicitly passed companyId in options
    // 2. Global COMPANY_ID
    // 3. User's company_id from authentication context
    return (
      options?.companyId ||
      global.COMPANY_ID ||
      options?.context?.user?.company_id
    );
  }

  // Method to bypass company scope for specific queries
  static async findAllWithoutScope(options = {}) {
    return this.findAll({
      ...options,
      bypassCompanyScope: true,
    });
  }

  // Method to find by primary key with company scope
  static async findByPkInCompany(id, options = {}) {
    return this.findByPk(id, {
      ...options,
      where: {
        ...options.where,
        id: id,
      },
    });
  }
}

export default BaseModel;
