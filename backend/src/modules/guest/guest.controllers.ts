import type { Request, Response } from "express";
import type { CreateGuestDTO, UpdateGuestDTO } from "./repository/guest.schema";
import { GuestFilterSchema } from "./repository/guest.schema";
import { AppError, getPagination, handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import {
      createGuestService,
      getAllGuestsService,
      getGuestByIdService,
      updateGuestService,
      deleteGuestService,
      searchGuestsService,
} from "./guest.services";

export const createGuestController = async (req: Request, res: Response) => {
      try {
            const data = req.body as CreateGuestDTO;
            const result = await createGuestService(data);

            res.status(result.reused ? 200 : 201).json({
                  success: true,
                  message: result.reused
                        ? "Existing guest reused"
                        : "Guest created successfully",
                  reused: result.reused,
                  guests: result.guest,
            });
      } catch (error: any) {
            logger.error("Failed to create Guest", {
                  error: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getAllGuestsController = async (req: Request, res: Response) => {
      try {
            const pagination = getPagination(req.query);

            const filters = GuestFilterSchema.safeParse({
                  search: req.query.search,
                  validIdType: req.query.validIdType,
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

            const guests =
                  filters.data.search || filters.data.validIdType
                        ? await searchGuestsService({
                                search: filters.data.search,
                                validIdType: filters.data.validIdType,
                                pagination,
                          })
                        : await getAllGuestsService(pagination);

            res.status(200).json({
                  success: true,
                  count: guests.length,
                  message: "Guests listed successfully",
                  guests,
            });
      } catch (error: any) {
            logger.error("Failed to list Guests", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getGuestByIdController = async (req: Request, res: Response) => {
      try {
            const guests = await getGuestByIdService(
                  req.params.guestId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Guest fetched successfully by its ID",
                  guests,
            });
      } catch (error: any) {
            logger.error("Failed to get Guest by ID", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const updateGuestController = async (req: Request, res: Response) => {
      try {
            const guestId = String(req.params.guestId);
            const data = req.body as UpdateGuestDTO;
            const guests = await updateGuestService(guestId, data);

            res.status(200).json({
                  success: true,
                  message: "Guest updated successfully",
                  guests,
            });
      } catch (error: any) {
            logger.error("Failed to update Guest", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const deleteGuestController = async (req: Request, res: Response) => {
      try {
            const guests = await deleteGuestService(
                  req.params.guestId as string,
            );

            res.status(204).json({
                  success: true,
                  message: "Guest deleted successfully",
                  guests,
            });
      } catch (error: any) {
            logger.error("Failed to delete Guest", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
