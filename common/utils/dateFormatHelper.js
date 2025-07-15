import moment from 'moment-timezone';
import appSettings from '../../config/appSettings.js';

export function formatDateTime(rawValue) {
  if (!rawValue) return null;
  return moment(rawValue)
    .tz(appSettings.timezone)
    .format(`${appSettings.dateFormat} ${appSettings.timeFormat === '12-hour' ? 'hh:mm A' : 'HH:mm'}`);
} 