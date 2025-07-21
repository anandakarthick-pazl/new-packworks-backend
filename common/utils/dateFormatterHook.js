// utils/dateFormatterHook.js
import { formatDateTime } from './dateFormatHelper.js';

// Universal date formatter function
export const addDateFormatterHook = (model, dateFields = ['created_at', 'updated_at']) => {
  model.addHook("afterFind", (result) => {
    const formatRecordDates = (record) => {
      if (!record) return;

      // Check if it's a raw query result (plain object) or Sequelize instance
      const isRawResult = !record.getDataValue;
      
      if (isRawResult) {
        // Handle raw query results (plain objects)
        dateFields.forEach(field => {
          if (record[field]) {
            record[field] = formatDateTime(record[field]);
          }
        });
      } else {
        // Handle Sequelize model instances
        const dataValues = record.dataValues || {};
        
        // Only format fields that exist in the dataValues
        dateFields.forEach(field => {
          if (field in dataValues && dataValues[field]) {
            record.dataValues[field] = formatDateTime(dataValues[field]);
          }
        });
      }
    };

    if (Array.isArray(result)) {
      result.forEach(formatRecordDates);
    } else if (result) {
      formatRecordDates(result);
    }
  });
};


