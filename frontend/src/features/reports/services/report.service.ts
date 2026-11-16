import { apiClient } from '@/lib/api';
import type { DailyReport } from '../types/report.types';

/** Read-only Administrator reports. */
export const reportService = {
  /**
   * End-of-day report for one resort calendar day (`YYYY-MM-DD`); omit the
   * date for today in Asia/Manila.
   */
  getDaily: async (date?: string): Promise<DailyReport> => {
    const response = await apiClient.get('/reports/daily', { params: date ? { date } : undefined });
    const data = (response as unknown as { data?: DailyReport })?.data;
    if (!data || !data.collections || !data.occupancy || !Array.isArray(data.departures)) {
      throw new Error('The server returned an invalid daily report.');
    }
    return data;
  },
};
