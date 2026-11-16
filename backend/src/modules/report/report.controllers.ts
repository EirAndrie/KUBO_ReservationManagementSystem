import type { Request, Response } from "express";
import { AppError, handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import { DailyReportQuerySchema } from "./repository/report.schema";
import { getDailyReportService } from "./report.services";

/** `GET /reports/daily?date=YYYY-MM-DD` (date optional; resort calendar day). */
export const getDailyReportController = async (req: Request, res: Response) => {
      try {
            const query = DailyReportQuerySchema.safeParse({
                  date: req.query.date === "" ? undefined : req.query.date,
            });
            if (!query.success) {
                  throw new AppError(
                        400,
                        query.error.issues
                              .map((issue) =>
                                    issue.path.length
                                          ? `${issue.path.join(".")}: ${issue.message}`
                                          : issue.message,
                              )
                              .join("; "),
                  );
            }

            const data = await getDailyReportService(query.data.date);

            res.status(200).json({
                  success: true,
                  message: "Daily report loaded",
                  data,
            });
      } catch (error: any) {
            logger.error("Failed to load daily report", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
