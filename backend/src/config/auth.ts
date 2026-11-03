import ENV from "./env";

/**
 * Centralized authentication configuration.
 *
 * The signing secret and token lifetime come from the environment (see
 * `example.env`). `server.ts` validates them at startup before the server
 * listens, so a missing or weak secret fails fast rather than producing
 * unsigned tokens at runtime.
 */
export const AUTH_CONFIG = {
      jwtSecret: ENV.JWT_SECRET ?? "",
      jwtExpiresIn: ENV.JWT_EXPIRES_IN ?? "8h",
      issuer: "kubo-api",
      audience: "kubo-client",
} as const;
