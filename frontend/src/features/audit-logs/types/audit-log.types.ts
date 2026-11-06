/**
 * Domain types for the read-only audit log (BR-067 to BR-070, BR-078).
 * Action values match the backend `kubo.audit_action` enum exactly.
 */

export const AUDIT_ACTIONS = [
  'Create',
  'Update',
  'Delete',
  'Login',
  'Logout',
  'Cancel',
  'Approve',
  'Reject',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLog {
  auditLogId: string;
  employeeId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  dateTime: string;
}

export interface AuditLogFilterParams {
  action?: AuditAction;
  entityType?: string;
  employeeId?: string;
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
  offset?: number;
}
