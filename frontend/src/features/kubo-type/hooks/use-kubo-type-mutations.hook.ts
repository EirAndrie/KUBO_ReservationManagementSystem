import { useQueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { kuboTypeService } from '../services/kubo-type.service';
import { kuboTypeKeys } from './use-kubo-types.hook';
import type { CreateKuboTypeDTO, UpdateKuboTypeDTO } from '../types/kubo-type.types';

/**
 * Hook to create a new kubo type with automatic cache invalidation and notification.
 */
export function useCreateKuboType() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: (data: CreateKuboTypeDTO) => kuboTypeService.create(data),
    successMessage: (created) => `Kubo type "${created.type_name}" created successfully.`,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kuboTypeKeys.lists() });
    },
  });
}

/**
 * Hook to update an existing kubo type's name, capacity, rate, or description.
 */
export function useUpdateKuboType() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateKuboTypeDTO }) =>
      kuboTypeService.update(id, data),
    successMessage: (updated) => `Kubo type "${updated.type_name}" updated successfully.`,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: kuboTypeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: kuboTypeKeys.detail(updated.kubo_type_id) });
    },
  });
}

/**
 * Hook to delete an unused kubo type.
 */
export function useDeleteKuboType() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: (kuboTypeId: string) => kuboTypeService.delete(kuboTypeId),
    successMessage: 'Kubo type deleted successfully.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kuboTypeKeys.lists() });
    },
  });
}
