import { useQueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { reservationKeys } from '@/features/reservation';
import { checkInOutService } from '../services/check-in-out.service';
import { checkInOutKeys } from './use-check-in-out.hook';
import type { CheckInOutActionParams } from '../types/check-in-out.types';

/**
 * The guest list's stay stats (`guestKeys.stayStatsAll()` in the guest feature).
 * Check-in and check-out change `last_stay` and the Returning badge. The key is
 * written out, like `['kubos']` below, so this feature does not import the guest
 * barrel and add another cross-feature cycle.
 */
const GUEST_STAY_STATS_KEY = ['guests', 'stay-stats'] as const;

/**
 * Mutation hook to check in a reserved kubo assignment (BR-058, BR-060).
 */
export function useCheckInKubo() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ reservationId, kuboId }: CheckInOutActionParams) =>
      checkInOutService.checkInKubo(reservationId, kuboId),
    successMessage: 'Guest checked in. The kubo is now occupied.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInOutKeys.operationalQueue() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['kubos'] });
      queryClient.invalidateQueries({ queryKey: GUEST_STAY_STATS_KEY });
    },
  });
}

/**
 * Mutation hook to approve early check-in (BR-059).
 */
export function useApproveEarlyCheckIn() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ reservationId, kuboId }: CheckInOutActionParams) =>
      checkInOutService.approveEarlyCheckIn(reservationId, kuboId),
    successMessage: 'Early check-in approved.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInOutKeys.operationalQueue() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['kubos'] });
      queryClient.invalidateQueries({ queryKey: GUEST_STAY_STATS_KEY });
    },
  });
}

/**
 * Mutation hook to mark one never-checked-in assignment as NoShow after its
 * stay dates have passed (issue #67).
 */
export function useMarkKuboNoShow() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ reservationId, kuboId }: CheckInOutActionParams) =>
      checkInOutService.markKuboNoShow(reservationId, kuboId),
    successMessage: 'Kubo marked as no-show.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInOutKeys.operationalQueue() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['kubos'] });
      queryClient.invalidateQueries({ queryKey: GUEST_STAY_STATS_KEY });
    },
  });
}

/**
 * Mutation hook to check out a reserved kubo assignment (BR-062, BR-063).
 * Kubo is transitioned to 'Cleaning'.
 */
export function useCheckOutKubo() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ reservationId, kuboId }: CheckInOutActionParams) =>
      checkInOutService.checkOutKubo(reservationId, kuboId),
    successMessage: 'Guest checked out. The kubo is marked for cleaning.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInOutKeys.operationalQueue() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['kubos'] });
      queryClient.invalidateQueries({ queryKey: GUEST_STAY_STATS_KEY });
    },
  });
}
