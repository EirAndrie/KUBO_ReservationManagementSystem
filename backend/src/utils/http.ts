import { z, ZodError, ZodType } from "zod";
import logger from "./logger";
import { Pagination } from "./pagination";
import type { Request, Response, NextFunction } from "express";

export class AppError extends Error {
      statusCode: number;

      constructor(statusCode: number, message: string) {
            super(message);
            this.statusCode = statusCode;
      }
}

export const validateBody = <T>(schema: ZodType<T>) => {
      return (req: Request, _res: Response, next: NextFunction) => {
            const result = schema.safeParse(req.body);

            if (!result.success) {
                  return next(new AppError(400, formatZodError(result.error)));
            }

            req.body = result.data;

            next();
      };
};

export const PaginationQuerySchema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(10),
});

export const getPagination = (query: unknown): Pagination => {
      const result = PaginationQuerySchema.safeParse(query);

      if (!result.success) {
            throw new AppError(400, formatZodError(result.error));
      }

      return {
            ...result.data,
            offset: (result.data.page - 1) * result.data.limit,
      };
};

export const requireUuidParam = (paramName: string) => {
      return (req: Request, res: Response, next: NextFunction) => {
            try {
                  const value = req.params[paramName];

                  if (!value) {
                        throw new AppError(
                              400,
                              `Missing UUID for ${paramName}, parameter is required, cannot proceed`,
                        );
                  }

                  const uuidPattern =
                        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

                  if (Array.isArray(value) || !uuidPattern.test(value)) {
                        throw new AppError(400, `Invalid ${paramName} format`);
                  }

                  next(); // Validation passed, proceed to the controller
            } catch (error: any) {
                  logger.error(
                        "UUID not found at the parameters, cannot proceed",
                        { message: error.message, stack: error.stack },
                  );
                  handleControllerError(res, error, error.message);
            }
      };
};

export const getStringParam = (value: string | string[], field: string) => {
      if (Array.isArray(value) || !value) {
            throw new AppError(400, `Invalid ${field}`);
      }

      return value;
};

export const handleControllerError = (
      res: Response,
      error: unknown,
      message = "Internal server error",
) => {
      if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                  success: false,
                  message: error.message,
            });
      }

      logger.error(message, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
      });

      return res.status(500).json({
            success: false,
            message,
      });
};

const formatZodError = (error: ZodError) =>
      error.issues
            .map((issue) => {
                  const path = issue.path.join(".");
                  return path ? `${path}: ${issue.message}` : issue.message;
            })
            .join("; ");
