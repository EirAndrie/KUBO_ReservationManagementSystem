import { useQuery } from '@tanstack/react-query';
import { kuboService } from '../services/kubo.service';
import type { Kubo, KuboFilterParams } from '../types/kubo.types';

export const kuboKeys = {
  all: ['kubos'] as const,
  lists: () => [...kuboKeys.all, 'list'] as const,
  list: (filters?: KuboFilterParams) => [...kuboKeys.lists(), filters ?? {}] as const,
  detail: (id: string) => [...kuboKeys.all, 'detail', id] as const,
};

/**
 * Hook to retrieve all cottages with optional status and search filters.
 */
export function useKubos(filters?: KuboFilterParams) {
  return useQuery<Kubo[], Error>({
    queryKey: kuboKeys.list(filters),
    queryFn: () => kuboService.getAll(filters),
    staleTime: 1000 * 30,
  });
}

/**
 * Hook to retrieve single kubo cottage by ID.
 */
export function useKubo(kuboId: string) {
  return useQuery<Kubo, Error>({
    queryKey: kuboKeys.detail(kuboId),
    queryFn: () => kuboService.getById(kuboId),
    enabled: Boolean(kuboId),
  });
}
