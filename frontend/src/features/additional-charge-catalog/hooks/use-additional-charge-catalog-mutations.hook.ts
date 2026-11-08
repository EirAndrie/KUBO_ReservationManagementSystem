import { useQueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { additionalChargeCatalogService } from '../services/additional-charge-catalog.service';
import type {
  AdditionalChargeCatalogItem,
  AdditionalChargeCatalogPayload,
  ChargeType,
} from '../types/additional-charge-catalog.types';
import { additionalChargeCatalogKeys } from './use-additional-charge-catalog.hook';

export interface CreateCatalogItemPayload {
  chargeType: ChargeType;
  name: string;
  description?: string;
  unitPrice: number;
  isActive: boolean;
}

export function useCreateCatalogItem() {
  const queryClient = useQueryClient();
  return useAppMutation({
    mutationFn: (payload: CreateCatalogItemPayload) => additionalChargeCatalogService.create(payload),
    successMessage: (item) => `“${item.name}” added to the charge catalog.`,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: additionalChargeCatalogKeys.lists() }),
  });
}

export function useUpdateCatalogItem() {
  const queryClient = useQueryClient();
  return useAppMutation({
    mutationFn: ({ catalogId, payload }: { catalogId: string; payload: AdditionalChargeCatalogPayload }) =>
      additionalChargeCatalogService.update(catalogId, payload),
    successMessage: (item: AdditionalChargeCatalogItem) => `“${item.name}” updated.`,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: additionalChargeCatalogKeys.lists() }),
  });
}

export function useDeleteCatalogItem() {
  const queryClient = useQueryClient();
  return useAppMutation({
    mutationFn: (catalogId: string) => additionalChargeCatalogService.delete(catalogId),
    successMessage: 'Catalog item deleted.',
    onSuccess: () => queryClient.invalidateQueries({ queryKey: additionalChargeCatalogKeys.lists() }),
  });
}
