import type { Request, Response } from "express";
import type {
      CreateReservedKuboDTO,
      UpdateReservedKuboDTO,
} from "./repository/reserved-kubo.schema";
import { handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import {
      assignKuboService,
      getReservedKubosService,
      getReservedKuboService,
      updateReservedKuboService,
      deleteReservedKuboService,
      checkInReservedKuboService,
      checkOutReservedKuboService,
      approveEarlyCheckInService,
} from "./reserved-room_kubo.services";

export const assignKuboController = async (req: Request, res: Response) => {
      try {
            const reservationId = String(req.params.reservationId);
            const data = req.body as CreateReservedKuboDTO;
            const reservedKubos = await assignKuboService(
                  reservationId,
                  data,
            );

            res.status(201).json({
                  success: true,
                  message: "Successfully assigned a Kubo to Reservation",
                  reservedKubos,
            });
      } catch (error: any) {
            logger.error("Failed to assign kubo to reservation", {
                  error: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getReservedKubosController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservedKubos = await getReservedKubosService(
                  req.params.reservationId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched reserved kubos",
                  reservedKubos,
            });
      } catch (error: any) {
            logger.error("Failed to list reserved kubos", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getReservedKuboController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservedKubos = await getReservedKuboService(
                  req.params.reservationId as string,
                  req.params.kuboId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched reserved kubo",
                  reservedKubos,
            });
      } catch (error: any) {
            logger.error("Failed to get reserved kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const updateReservedKuboController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservationId = String(req.params.reservationId);
            const kuboId = String(req.params.kuboId);
            const data = req.body as UpdateReservedKuboDTO;
            const reservedKubos = await updateReservedKuboService(
                  reservationId,
                  kuboId,
                  data,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully updated reserved kubo",
                  reservedKubos,
            });
      } catch (error: any) {
            logger.error("Failed to update reserved kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const deleteReservedKuboController = async (
      req: Request,
      res: Response,
) => {
      try {
            await deleteReservedKuboService(
                  req.params.reservationId as string,
                  req.params.kuboId as string,
            );

            res.status(204).json();
      } catch (error: any) {
            logger.error("Failed to delete reserved kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const checkInReservedKuboController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservedKubos = await checkInReservedKuboService(
                  req.params.reservationId as string,
                  req.params.kuboId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully checked in reserved kubo",
                  reservedKubos,
            });
      } catch (error: any) {
            logger.error("Failed to check in reserved kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const checkOutReservedKuboController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservedKubos = await checkOutReservedKuboService(
                  req.params.reservationId as string,
                  req.params.kuboId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully checked out reserved kubo",
                  reservedKubos,
            });
      } catch (error: any) {
            logger.error("Failed to check out reserved kubo", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const approveEarlyCheckInController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservedKubos = await approveEarlyCheckInService(
                  req.params.reservationId as string,
                  req.params.kuboId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully approved early check-in",
                  reservedKubos,
            });
      } catch (error: any) {
            logger.error("Failed to approve early check-in", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
