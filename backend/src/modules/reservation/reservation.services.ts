import {
      createReservation,
      getReservations,
      getReservationById,
      updateReservation,
      deleteReservation,
      searchReservations,
      cancelReservation,
      updateReservationStatus,
} from "./repository/reservation.repository";
import { AppError } from "../../utils/http";
import logger from "../../utils/logger";
import type {
      CreateReservationDTO,
      UpdateReservationDTO,
} from "./repository/reservation.schema";
import type { Pagination } from "../../utils/pagination";

export const createReservationService = async (data: CreateReservationDTO) => {
      // No uniqueness checks defined
      return createReservation(data);
};

export const getAllReservationsService = async () => {
      return getReservations();
};

export const getReservationByIdService = async (reservationId: string) => {
      const res = await getReservationById(reservationId);
      if (!res) {
            throw new AppError(404, "Reservation not found");
      }
      return res;
};

export const updateReservationService = async (data: UpdateReservationDTO) => {
      const existing = await getReservationById(data.reservationId);
      if (!existing) {
            throw new AppError(404, "Reservation not found");
      }
      return updateReservation(data);
};

export const deleteReservationService = async (reservationId: string) => {
      const existing = await getReservationById(reservationId);
      if (!existing) {
            throw new AppError(404, "Reservation not found");
      }
      await deleteReservation(reservationId);
};

export const searchReservationsService = async (params: {
      status?: string;
      bookingSource?: string;
      search?: string;
      guestId?: string;
      employeeId?: string;
      checkInDate?: string;
      checkOutDate?: string;
      pagination: Pagination;
}) => {
      return searchReservations({
            status: params.status,
            bookingSource: params.bookingSource,
            search: params.search,
            guestId: params.guestId,
            employeeId: params.employeeId,
            checkInDate: params.checkInDate,
            checkOutDate: params.checkOutDate,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};

export const cancelReservationService = async (
      reservationId: string,
      reason?: string,
) => {
      const existing = await getReservationById(reservationId);
      if (!existing) {
            throw new AppError(404, "Reservation not found");
      }
      return cancelReservation(reservationId, reason);
};

export const updateReservationStatusService = async (
      reservationId: string,
      status: string,
) => {
      const existing = await getReservationById(reservationId);
      if (!existing) {
            throw new AppError(404, "Reservation not found");
      }
      return updateReservationStatus(reservationId, status);
};
