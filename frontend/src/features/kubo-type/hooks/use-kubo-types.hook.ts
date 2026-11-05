import { useQuery } from '@tanstack/react-query';
import { kuboTypeService } from '../services/kubo-type.service';
import type { KuboTypeFilterParams } from '../types/kubo-type.types';

/**
 * Standardized Query Key Factory for Kubo Types.
 * Enables granular cache invalidation across lists and details.
 */
export const kuboTypeKeys = {
  all: ['kubo-types'] as const,
  lists: () => [...kuboTypeKeys.all, 'list'] as const,
  list: (params?: KuboTypeFilterParams) => [...kuboTypeKeys.lists(), params] as const,
  details: () => [...kuboTypeKeys.all, 'detail'] as const,
  detail: (id: string) => [...kuboTypeKeys.details(), id] as const,
};

/**
 * Hook to retrieve all kubo types with optional search and capacity filters.
 */
export function useKuboTypes(params?: KuboTypeFilterParams) {
  return useQuery({
    queryKey: kuboTypeKeys.list(params),
    queryFn: () => kuboTypeService.getAll(params),
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to retrieve a single kubo type by UUID.
 */
export function useKuboType(kuboTypeId?: string) {
  return useQuery({
    queryKey: kuboTypeKeys.detail(kuboTypeId ?? ''),
    queryFn: () => kuboTypeService.getById(kuboTypeId!),
    enabled: Boolean(kuboTypeId),
  });
}
