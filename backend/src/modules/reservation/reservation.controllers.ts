import type { Request, Response } from "express";
import type {
      CreateReservationDTO,
      UpdateReservationDTO,
} from "./repository/reservation.schema";
import { handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import { getPagination } from "../../utils/http";
import {
      createReservationService,
      getAllReservationsService,
      getReservationByIdService,
      updateReservationService,
      deleteReservationService,
      searchReservationsService,
      cancelReservationService,
      updateReservationStatusService,
} from "./reservation.services";

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

export const getAllReservationsController = async (
      req: Request,
      res: Response,
) => {
      try {
            const pagination = getPagination(req.query);

            const status =
                  typeof req.query.status === "string"
                        ? req.query.status
                        : undefined;
            const bookingSource =
                  typeof req.query.bookingSource === "string"
                        ? req.query.bookingSource
                        : undefined;
            const search =
                  typeof req.query.search === "string"
                        ? req.query.search
                        : undefined;
            const guestId =
                  typeof req.query.guestId === "string"
                        ? req.query.guestId
                        : undefined;
            const employeeId =
                  typeof req.query.employeeId === "string"
                        ? req.query.employeeId
                        : undefined;
            const checkInDate =
                  typeof req.query.checkInDate === "string"
                        ? req.query.checkInDate
                        : undefined;
            const checkOutDate =
                  typeof req.query.checkOutDate === "string"
                        ? req.query.checkOutDate
                        : undefined;

            let reservations;
            if (
                  status ||
                  bookingSource ||
                  search ||
                  guestId ||
                  employeeId ||
                  checkInDate ||
                  checkOutDate
            ) {
                  reservations = await searchReservationsService({
                        status,
                        bookingSource,
                        search,
                        guestId,
                        employeeId,
                        checkInDate,
                        checkOutDate,
                        pagination,
                  });
            } else {
                  reservations = await getAllReservationsService();
            }

            res.status(200).json({
                  success: true,
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

export const updateReservationController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = req.body as UpdateReservationDTO;
            const reservations = await updateReservationService({
                  ...data,
                  reservationId: req.params.reservationId as string,
            });

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

export const deleteReservationController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservations = await deleteReservationService(
                  req.params.reservationId as string,
            );

            res.status(204).json({
                  success: true,
                  message: "Successfully deleted Reservation",
                  reservations,
            });
      } catch (error: any) {
            logger.error("Failed to delete Reservation", {
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
            const reason =
                  typeof req.body.reason === "string"
                        ? req.body.reason
                        : undefined;
            const reservations = await cancelReservationService(
                  req.params.reservationId as string,
                  reason,
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

export const updateReservationStatusController = async (
      req: Request,
      res: Response,
) => {
      try {
            const status =
                  typeof req.body.status === "string"
                        ? req.body.status
                        : undefined;
            if (!status) {
                  throw new Error("Missing status in request body");
            }

            const reservations = await updateReservationStatusService(
                  req.params.reservationId as string,
                  status,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully updated Reservation Status",
                  reservations,
            });
      } catch (error: any) {
            logger.error("Failed to update Reservation status", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
