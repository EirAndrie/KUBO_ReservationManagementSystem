import { useQuery } from '@tanstack/react-query';
import { auditLogService } from '../services/audit-log.service';
import type { AuditLog, AuditLogFilterParams } from '../types/audit-log.types';

export const auditLogKeys = {
  all: ['audit-logs'] as const,
  lists: () => [...auditLogKeys.all, 'list'] as const,
  list: (filters?: AuditLogFilterParams) => [...auditLogKeys.lists(), filters ?? {}] as const,
  detail: (id: string) => [...auditLogKeys.all, 'detail', id] as const,
};

/**
 * Hook to retrieve the system audit logs ledger.
 */
export function useAuditLogs(filters?: AuditLogFilterParams) {
  return useQuery<AuditLog[], Error>({
    queryKey: auditLogKeys.list(filters),
    queryFn: () => auditLogService.getAll(filters),
    staleTime: 1000 * 30,
  });
}

/**
 * Hook to retrieve an individual audit log record with state diff.
 */
export function useAuditLog(auditId: string) {
  return useQuery<AuditLog, Error>({
    queryKey: auditLogKeys.detail(auditId),
    queryFn: () => auditLogService.getById(auditId),
    enabled: Boolean(auditId),
  });
}
