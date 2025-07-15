const appSettings = {
  dateFormat: process.env.DATE_FORMAT || 'DD-MM-YYYY',
  timeFormat: process.env.TIME_FORMAT || '12-hour',
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  currency: process.env.CURRENCY || 'INR',
  language: process.env.LANGUAGE || 'English'
};

export default appSettings; 