import express, { Express } from "express";
import { existsSync } from "fs";
import path from "path";
import cors from "cors";
import logger from "./logger";
import ENV from "../config/env";

// Check port validity
export function validateServerPort(port: string | undefined): number {
      if (!port) {
            logger.info("Error: PORT is not defined in environment variables.");
            process.exit(1);
      }

      const parsedPort = Number(port);

      if (
            Number.isNaN(parsedPort) ||
            parsedPort < 0 ||
            parsedPort > 65535 ||
            !Number.isInteger(parsedPort)
      ) {
            logger.info("Error: PORT is not a valid port number.");
            process.exit(1);
      }

      return parsedPort;
}

// Check Frontend Origin validity
export function validateFrontendOrigin(frOrigin: string | undefined): string {
      if (!frOrigin) {
            logger.info(
                  "Error: FR_ORIGIN is not defined in environment variables.",
            );
            process.exit(1);
      }

      return frOrigin;
}

// Validate the JWT signing secret. Fails fast when absent, and enforces a
// minimum length in production so a weak secret cannot reach a live host.
export function validateJwtSecret(
      secret: string | undefined,
      isProduction: boolean,
): string {
      if (!secret) {
            logger.info("Error: JWT_SECRET is not defined in environment variables.");
            process.exit(1);
      }

      if (isProduction && secret.length < 32) {
            logger.info(
                  "Error: JWT_SECRET must be at least 32 characters in production.",
            );
            process.exit(1);
      }

      return secret;
}

// Check if server is in production mode
export function validateProductionMode(mode: string | undefined): boolean {
      if (!mode) {
            logger.info(
                  "Error: NODE_ENV is not defined in environment variables.",
            );
            process.exit(1);
      }

      return mode === "production";
}

// Configure CORS based on frontend origin and production mode
export function configureCors(
      app: Express,
      frontendOrigin: string,
      isProduction: boolean,
) {
      app.use(
            cors({
                  origin: frontendOrigin,
                  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
                  credentials: true,
            }),
      );

      return logger.info(
            `CORS: ${frontendOrigin} Running in ${isProduction ? "Production" : "Development"} Mode`,
      );
}

// Configure environment routes based on production mode
export function configureEnvironmentRoutes(
      app: Express,
      isProduction: boolean,
) {
      if (isProduction) {
            // Resolves to <repo>/frontend/dist from both source (`src/utils`)
            // and build (`dist/utils`) layouts.
            const frontendPath = path.resolve(
                  __dirname,
                  "../../../frontend/dist",
            );
            const indexHtml = path.join(frontendPath, "index.html");

            if (!existsSync(indexHtml)) {
                  logger.error(
                        `Production frontend build not found at ${indexHtml}. ` +
                              `Run "npm run build" in frontend/ before starting the server.`,
                  );
                  process.exit(1);
            }

            app.use(express.static(frontendPath));

            app.get(/.*/, (req, res) => {
                  const isApiRequest =
                        req.path === ENV.API_BASE_PATH ||
                        req.path.startsWith(`${ENV.API_BASE_PATH}/`);

                  if (isApiRequest) {
                        res.status(404).json({
                              message: "API endpoint not found",
                        });
                        return;
                  }

                  res.sendFile(indexHtml);
            });
            return;
      }

      logger.info("App running in Development mode");
      app.get("/", (_req, res) => {
            res.send("API running successfully...");
      });
}
