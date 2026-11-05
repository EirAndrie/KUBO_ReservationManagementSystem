/**
 * Domain types and DTO contracts for the System Audit Logs feature module.
 * Strictly adheres to BR-067 through BR-070, and BR-078.
 */

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'cancel',
  'approve',
  'reject',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLog {
  auditLogId: string;
  employeeId: string;
  employeeName?: string;
  action: AuditAction;
  entityType?: string;
  entityId: string;
  description: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  dateTime: string;
}

export interface AuditLogFilterParams {
  action?: AuditAction | string;
  entityType?: string;
  employeeId?: string;
  createdFrom?: string;
  createdTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
