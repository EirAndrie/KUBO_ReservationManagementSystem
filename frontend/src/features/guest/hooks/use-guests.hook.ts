import { useQuery } from '@tanstack/react-query';
import { guestService } from '../services/guest.service';
import type { GuestFilterParams } from '../types/guest.types';

/**
 * Standardized Query Key Factory for Guests.
 */
export const guestKeys = {
  all: ['guests'] as const,
  lists: () => [...guestKeys.all, 'list'] as const,
  list: (params?: GuestFilterParams) => [...guestKeys.lists(), params] as const,
  details: () => [...guestKeys.all, 'detail'] as const,
  detail: (id: string) => [...guestKeys.details(), id] as const,
  reservations: (id: string) => [...guestKeys.detail(id), 'reservations'] as const,
};

/**
 * Hook to retrieve a list of guests matching search and ID-type filters.
 */
export function useGuests(params?: GuestFilterParams) {
  return useQuery({
    queryKey: guestKeys.list(params),
    queryFn: () => guestService.getAll(params),
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

/**
 * Hook to retrieve a single guest's comprehensive details by UUID.
 */
export function useGuest(guestId?: string) {
  return useQuery({
    queryKey: guestKeys.detail(guestId ?? ''),
    queryFn: () => guestService.getById(guestId!),
    enabled: Boolean(guestId),
  });
}

/**
 * Hook to retrieve the historical and active reservations for a given guest.
 */
export function useGuestReservations(guestId?: string) {
  return useQuery({
    queryKey: guestKeys.reservations(guestId ?? ''),
    queryFn: () => guestService.getReservations(guestId!),
    enabled: Boolean(guestId),
  });
}
