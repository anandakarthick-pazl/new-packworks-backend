import moment from 'moment-timezone';
import db from "../../common/models/index.js";

const GlobalSettings = db.GlobalSettings;
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export async function getTimezone() {
  try {
    const globalSettings = await GlobalSettings.findOne();
    return globalSettings?.timezone || DEFAULT_TIMEZONE;
  } catch (error) {
    console.error('Error fetching timezone:', error);
    return DEFAULT_TIMEZONE;
  }
}

export function formatDate(date, timezone, format = 'DD-MM-YYYY') {
  if (!date) return '';
  return moment(date).tz(timezone).format(format);
}
