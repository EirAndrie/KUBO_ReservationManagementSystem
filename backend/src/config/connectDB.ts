import { Pool } from "pg";
import logger from "../utils/logger";
import { AppError } from "../utils/http";
import ENV from "./env";

export const db = new Pool({
      host: ENV.DB_HOST,
      port: Number(ENV.DB_PORT),
      user: ENV.DB_USERNAME,
      password: ENV.DB_PASSWORD,
      database: ENV.DB_NAME,
});

export const connectDB = async () => {
      try {
            const res = await db.query("SELECT NOW()");
            console.log("Dataase connected successfully:", res.rows[0]);
      } catch (error: any) {
            logger.error("Failed to establish database connection", {
                  message: error.message,
                  stack: error.stack,
            });
            throw new AppError(500, "Failed to establish database connection");
      }
};
