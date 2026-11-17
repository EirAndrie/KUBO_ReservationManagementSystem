import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { resortToday } from '@/lib/time';
import { checkInOutService } from '../services/check-in-out.service';
import type { ArrivalRecord, DepartureRecord, InHouseRecord } from '../types/check-in-out.types';

export const checkInOutKeys = {
  all: ['check-in-out'] as const,
  timeFees: (reservationId: string, kuboId: string) =>
    ['check-in-out', 'time-fees', reservationId, kuboId] as const,
  operationalQueue: () => [...checkInOutKeys.all, 'queue'] as const,
  queueForDate: (date: string) => [...checkInOutKeys.operationalQueue(), date] as const,
};

/**
 * Early check-in / late check-out fee preview for one kubo (issue #107). Short
 * stale time because the fee depends on the current hour.
 */
export function useTimeFees(reservationId?: string, kuboId?: string) {
  return useQuery({
    queryKey: checkInOutKeys.timeFees(reservationId ?? '', kuboId ?? ''),
    queryFn: () => checkInOutService.getTimeFees(reservationId as string, kuboId as string),
    enabled: Boolean(reservationId && kuboId),
    staleTime: 1000 * 30,
  });
}

/**
 * Front-desk queues for one operational date, derived from Confirmed and
 * CheckedIn reservations:
 * - Arrivals: assignments still `Reserved` whose check-in date is the target
 *   date. Checking in before the assignment's check-in date (i.e. when it is
 *   later than today) is an early check-in and needs approval (BR-059).
 * - Departures: `CheckedIn` assignments whose check-out date is the target date.
 * - In-house: every `CheckedIn` assignment.
 *
 * Overdue work (a `Reserved` assignment whose check-in date has passed, or a
 * `CheckedIn` assignment past its check-out date) still needs action today, so
 * it is carried onto today's queue only, flagged `isOverdue`. Past and future
 * dates show just the items scheduled for that date.
 *
 * The API call does not take a date; filtering happens here, so every date
 * shares the same active-reservation list.
 */
export function useCheckInOutQueue(
  targetDate: string = resortToday(),
  options: { enabled?: boolean } = {},
) {
  const query = useQuery({
    queryKey: checkInOutKeys.queueForDate(targetDate),
    queryFn: () => checkInOutService.getActiveReservations(),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    enabled: options.enabled ?? true,
  });

  const reservations = query.data ?? [];
  const target = dayjs(targetDate).startOf('day');
  // "Today" is the resort's date (Asia/Manila), the same day CheckInOutPage
  // passes in; parsed like targetDate so the two compare as calendar days.
  const today = dayjs(resortToday()).startOf('day');
  const isTodayView = target.isSame(today, 'day');
  /** Scheduled for the target date, or overdue and carried onto today's view. */
  const isDue = (day: dayjs.Dayjs) => day.isSame(target, 'day') || (isTodayView && day.isBefore(today, 'day'));

  const arrivals: ArrivalRecord[] = [];
  const departures: DepartureRecord[] = [];
  const inHouse: InHouseRecord[] = [];

  reservations.forEach((res) => {
    const balance = Number(res.outstanding_balance) || 0;
    (res.assignments || []).forEach((assignment) => {
      const checkIn = dayjs(assignment.check_in_date).startOf('day');
      const checkOut = dayjs(assignment.check_out_date).startOf('day');

      if (
        ['Confirmed', 'CheckedIn'].includes(res.status) &&
        assignment.status === 'Reserved' &&
        isDue(checkIn)
      ) {
        const isEarly = checkIn.isAfter(today);
        arrivals.push({
          reservation: res,
          assignment,
          isEarly,
          isOverdue: checkIn.isBefore(today, 'day'),
          canCheckIn: res.status !== 'Pending' && (!isEarly || Boolean(assignment.early_check_in_approved)),
        });
      }

      if (res.status === 'CheckedIn' && (assignment.status === 'CheckedIn' || !assignment.status)) {
        inHouse.push({ reservation: res, assignment, outstandingBalance: balance });
        if (isDue(checkOut)) {
          departures.push({
            reservation: res,
            assignment,
            isOverdue: checkOut.isBefore(today, 'day'),
            outstandingBalance: balance,
            isSettled: balance <= 0,
            canCheckOut: balance <= 0,
          });
        }
      }
    });
  });

  return {
    ...query,
    arrivals,
    departures,
    inHouse,
  };
}
