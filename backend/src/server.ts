import ENV from "./config/env";
import express from "express";
import logger from "./utils/logger";
import { connectDB } from "./config/connectDB";
import {
      validateServerPort,
      validateFrontendOrigin,
      validateProductionMode,
      configureCors,
      configureEnvironmentRoutes,
} from "./utils/serverValidation";
import apiRoutes from "./modules/index";
import { runMigrations } from "./utils/migrate";

const app = express();
const PORT = validateServerPort(ENV.PORT);
const FR_ORIGIN = validateFrontendOrigin(ENV.FR_ORIGIN);
const isProduction = validateProductionMode(ENV.NODE_ENV);

// --- MIDDLEWARE ---
app.use(express.json());
configureCors(app, FR_ORIGIN, isProduction);

// ROUTES SECTION
app.use("/KUBO_Resort/Management-System/v0.0.1", apiRoutes);
configureEnvironmentRoutes(app, isProduction);

connectDB()
      .then(async () => {
            await runMigrations();
      })
      .then(() => {
            app.listen(PORT, () => {
                  logger.info(`Server is running on port ${PORT}`);
            });
      })
      .catch((err) => {
            logger.error("Failed to connect to the database:", {
                  message: err.message,
                  stack: err.stack,
            });
            process.exit(1);
      });
