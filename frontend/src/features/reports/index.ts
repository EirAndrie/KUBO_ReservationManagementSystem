/**
 * Public barrel for the Administrator reports feature (read-only).
 */
export { DailyReportPage } from './pages/daily-report.page';
export { useDailyReport, reportKeys } from './hooks/use-daily-report.hook';
export { reportService } from './services/report.service';
export type {
  DailyReport,
  DailyCollectionRow,
  DailyCollectionTotals,
  DailyDeparture,
  DailyOccupancy,
} from './types/report.types';
