import { useQuery } from '@tanstack/react-query';
import { additionalChargeCatalogService } from '../services/additional-charge-catalog.service';

export const additionalChargeCatalogKeys = {
  all: ['additional-charge-catalog'] as const,
  lists: () => [...additionalChargeCatalogKeys.all, 'list'] as const,
};

/** Includes active and inactive items so Administrators can manage the full catalog. */
export function useAdditionalChargeCatalog() {
  return useQuery({
    queryKey: additionalChargeCatalogKeys.lists(),
    queryFn: () => additionalChargeCatalogService.getAll(),
    staleTime: 1000 * 60,
  });
}
