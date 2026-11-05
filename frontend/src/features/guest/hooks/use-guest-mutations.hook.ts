import { useQueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { guestService } from '../services/guest.service';
import { guestKeys } from './use-guests.hook';
import type { CreateGuestDTO, UpdateGuestDTO } from '../types/guest.types';

/**
 * Hook to register a new guest with automatic reuse notification (BR-013).
 */
export function useCreateGuest() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: (data: CreateGuestDTO) => guestService.create(data),
    successMessage: (result) =>
      result.reused
        ? `Existing profile for "${result.guest.first_name} ${result.guest.last_name}" found and reused (BR-013).`
        : `Guest "${result.guest.first_name} ${result.guest.last_name}" registered successfully.`,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: guestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: guestKeys.detail(result.guest.guest_id) });
    },
  });
}

/**
 * Hook to update an existing guest's profile, contact, or address (BR-014).
 */
export function useUpdateGuest() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGuestDTO }) =>
      guestService.update(id, data),
    successMessage: (updated) =>
      `Guest "${updated.first_name} ${updated.last_name}" updated successfully.`,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: guestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: guestKeys.detail(updated.guest_id) });
    },
  });
}

/**
 * Hook to delete an unused guest record (BR-015).
 */
export function useDeleteGuest() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: (guestId: string) => guestService.delete(guestId),
    successMessage: 'Guest record removed successfully.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guestKeys.lists() });
    },
  });
}
