import { useQueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { kuboService } from '../services/kubo.service';
import { kuboKeys } from './use-kubos.hook';
import type {
  Kubo,
  CreateKuboPayload,
  UpdateKuboPayload,
  KuboStatus,
} from '../types/kubo.types';

export function useCreateKubo() {
  const queryClient = useQueryClient();

  return useAppMutation<Kubo, CreateKuboPayload>({
    mutationFn: (payload) => kuboService.create(payload),
    successMessage: 'Kubo added.',
    errorMessage: (error) => error.message || 'Failed to register kubo.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kuboKeys.all });
    },
  });
}

export function useUpdateKubo() {
  const queryClient = useQueryClient();

  return useAppMutation<Kubo, { kuboId: string; payload: UpdateKuboPayload }>({
    mutationFn: ({ kuboId, payload }) => kuboService.update(kuboId, payload),
    successMessage: 'Kubo updated.',
    errorMessage: (error) => error.message || 'Failed to update kubo.',
    onSuccess: (_data, { kuboId }) => {
      queryClient.invalidateQueries({ queryKey: kuboKeys.all });
      queryClient.invalidateQueries({ queryKey: kuboKeys.detail(kuboId) });
    },
  });
}

export function useChangeKuboStatus() {
  const queryClient = useQueryClient();

  return useAppMutation<Kubo, { kuboId: string; status: KuboStatus }>({
    mutationFn: ({ kuboId, status }) => kuboService.changeStatus(kuboId, status),
    successMessage: 'Kubo status updated.',
    errorMessage: (error) => error.message || 'Failed to update kubo status.',
    onSuccess: (_data, { kuboId }) => {
      queryClient.invalidateQueries({ queryKey: kuboKeys.all });
      queryClient.invalidateQueries({ queryKey: kuboKeys.detail(kuboId) });
      queryClient.invalidateQueries({ queryKey: ['check-in-out'] });
    },
  });
}

export function useDeleteKubo() {
  const queryClient = useQueryClient();

  return useAppMutation<void, string>({
    mutationFn: (kuboId) => kuboService.delete(kuboId),
    successMessage: 'Kubo deleted.',
    errorMessage: (error) => {
      if (
        error.message?.includes('foreign key') ||
        error.message?.includes('history') ||
        error.message?.includes('reserved') ||
        error.message?.includes('reference')
      ) {
        return 'This kubo has bookings, so it can’t be deleted. Mark it out of service instead.';
      }
      return error.message || 'Failed to delete kubo cottage.';
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kuboKeys.all });
    },
  });
}
