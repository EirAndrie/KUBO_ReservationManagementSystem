import type { Request, Response } from "express";
import type {
      CreateReservationDTO,
      UpdateReservationDTO,
      CancelReservationDTO,
} from "./repository/reservation.schema";
import { ReservationFilterSchema } from "./repository/reservation.schema";
import { AppError, getPagination, handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import {
      createReservationService,
      getAllReservationsService,
      getReservationByIdService,
      updateReservationService,
      confirmReservationService,
      cancelReservationService,
      markReservationNoShowService,
      deleteReservationService,
      searchReservationsService,
} from "./reservation.services";

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

// Checked
export const createReservationController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as CreateReservationDTO;
            const reservations = await createReservationService(data);

            res.status(201).json({
                  success: true,
                  message: "Successfully created Reservation",
                  reservations,
            });
      } catch (error: any) {
            logger.error("Failed to create Reservation", {
                  error: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// checked
export const getAllReservationsController = async (
      req: Request,
      res: Response,
) => {
      try {
            const pagination = getPagination(req.query);

            const filters = ReservationFilterSchema.safeParse({
                  status: req.query.status,
                  bookingSource: req.query.bookingSource,
                  search: req.query.search,
                  guestId: req.query.guestId,
                  employeeId: req.query.employeeId,
                  checkInDate: req.query.checkInDate,
                  checkOutDate: req.query.checkOutDate,
            });

            if (!filters.success) {
                  throw new AppError(
                        400,
                        filters.error.issues
                              .map((issue) =>
                                    issue.path.length
                                          ? `${issue.path.join(".")}: ${issue.message}`
                                          : issue.message,
                              )
                              .join("; "),
                  );
            }

            const hasFilters =
                  filters.data.status !== undefined ||
                  filters.data.bookingSource !== undefined ||
                  filters.data.search !== undefined ||
                  filters.data.guestId !== undefined ||
                  filters.data.employeeId !== undefined ||
                  filters.data.checkInDate !== undefined ||
                  filters.data.checkOutDate !== undefined;

            const reservations = hasFilters
                  ? await searchReservationsService({
                          status: filters.data.status,
                          bookingSource: filters.data.bookingSource,
                          search: filters.data.search,
                          guestId: filters.data.guestId,
                          employeeId: filters.data.employeeId,
                          checkInDate: filters.data.checkInDate
                                ? toDateOnly(filters.data.checkInDate)
                                : undefined,
                          checkOutDate: filters.data.checkOutDate
                                ? toDateOnly(filters.data.checkOutDate)
                                : undefined,
                          pagination,
                    })
                  : await getAllReservationsService(pagination);

            res.status(200).json({
                  success: true,
                  count: reservations.length,
                  message: "Successfully listed all Reservations",
                  reservations,
            });
      } catch (error: any) {
            logger.error("Failed to list Reservations", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// Checked
export const getReservationByIdController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservations = await getReservationByIdService(
                  req.params.reservationId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched Reservation by its ID",
                  reservations,
            });
      } catch (error: any) {
            logger.error("Failed to get Reservation by ID", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};


// Checked
export const updateReservationController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservationId = String(req.params.reservationId);
            const data = req.body as UpdateReservationDTO;
            const reservations = await updateReservationService(
                  reservationId,
                  data,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully updated Reservation",
                  reservations,
            });
      } catch (error: any) {
            logger.error("Failed to update Reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};


export const confirmReservationController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservations = await confirmReservationService(
                  req.params.reservationId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully confirmed Reservation",
                  reservations,
            });
      } catch (error: any) {
            logger.error("Failed to confirm Reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const cancelReservationController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as CancelReservationDTO;
            const reservations = await cancelReservationService(
                  req.params.reservationId as string,
                  data.reason,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully cancelled Reservation",
                  reservations,
            });
      } catch (error: any) {
            logger.error("Failed to cancel Reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const markReservationNoShowController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservations = await markReservationNoShowService(
                  req.params.reservationId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully marked Reservation as NoShow",
                  reservations,
            });
      } catch (error: any) {
            logger.error("Failed to mark Reservation as NoShow", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const deleteReservationController = async (
      req: Request,
      res: Response,
) => {
      try {
            await deleteReservationService(
                  req.params.reservationId as string,
            );

            res.status(204).json();
      } catch (error: any) {
            logger.error("Failed to delete Reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
