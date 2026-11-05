/**
 * Public barrel export for the System Audit Logs feature module.
 * Direct access to internal paths from outside this module is prohibited.
 */

// Pages
export { AuditLogListPage } from './pages/audit-log-list.page';

// Components
export { AuditDetailModal } from './components/audit-detail-modal.component';
export type { AuditDetailModalProps } from './components/audit-detail-modal.component';

// Hooks
export {
  useAuditLogs,
  useAuditLog,
  auditLogKeys,
} from './hooks/use-audit-logs.hook';

// Services
export { auditLogService } from './services/audit-log.service';

// Types
export type {
  AuditLog,
  AuditLogFilterParams,
  AuditAction,
} from './types/audit-log.types';

export { AUDIT_ACTIONS } from './types/audit-log.types';

// Constants
export {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_TAGS,
  AUDIT_ACTION_OPTIONS,
  AUDIT_POLICIES,
} from './constants/audit-log.constants';
