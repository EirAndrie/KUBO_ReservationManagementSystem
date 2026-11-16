import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/** The resort's local time zone. Audit timestamps are grouped and shown in it. */
export const RESORT_TZ = 'Asia/Manila';

/** Converts an ISO timestamp to resort-local time (no off-by-one at midnight UTC). */
export function resortTime(value: string | Date) {
  return dayjs(value).tz(RESORT_TZ);
}

/**
 * Today's calendar date at the resort as `YYYY-MM-DD`, whatever the browser's
 * time zone. Compare it as a string with API dates (`check_in_date`, etc.);
 * `offsetDays` shifts it (1 = tomorrow).
 */
export function resortToday(offsetDays = 0): string {
  return resortTime(new Date()).add(offsetDays, 'day').format('YYYY-MM-DD');
}
