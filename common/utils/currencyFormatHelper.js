import moment from 'moment-timezone';
import appSettings from '../../config/appSettings.js';

export function currencyHelper(rawValue) {
  if (!rawValue) return null;
  return moment(rawValue)
    .tz(appSettings.currency)
} 