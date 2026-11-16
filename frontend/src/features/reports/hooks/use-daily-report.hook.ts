import { useQuery } from '@tanstack/react-query';
import { reportService } from '../services/report.service';

export const reportKeys = {
  all: ['reports'] as const,
  daily: (date: string) => [...reportKeys.all, 'daily', date] as const,
};

/** End-of-day report for a resort calendar day (`YYYY-MM-DD`). */
export function useDailyReport(date: string) {
  return useQuery({
    queryKey: reportKeys.daily(date),
    queryFn: () => reportService.getDaily(date),
    placeholderData: (previous) => previous,
    staleTime: 1000 * 60,
  });
}
