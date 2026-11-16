import type { Request, Response, NextFunction } from "express";
import { AppError, handleControllerError } from "../../utils/http";

/** Failed sign-ins allowed per username and client IP inside one window. */
export const MAX_FAILED_LOGINS = 5;
/** Length of the failure window and of the lockout that follows it. */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** Upper bound on tracked keys so a flood of usernames cannot exhaust memory. */
const MAX_TRACKED_KEYS = 10_000;

interface FailureRecord {
      count: number;
      windowStartedAt: number;
}

const failures = new Map<string, FailureRecord>();

const keyFor = (req: Request): string => {
      const username =
            typeof req.body?.username === "string"
                  ? req.body.username.trim().toLowerCase()
                  : "";
      return `${req.ip ?? "unknown"}|${username}`;
};

const pruneExpired = (now: number) => {
      for (const [key, record] of failures) {
            if (now - record.windowStartedAt >= LOGIN_WINDOW_MS) {
                  failures.delete(key);
            }
      }
};

/**
 * Brute-force guard for `POST /auth/login`.
 *
 * Counts failed sign-ins per (client IP, username). After
 * `MAX_FAILED_LOGINS` failures inside `LOGIN_WINDOW_MS`, further attempts for
 * that pair get 429 until the window ends; a successful login clears the
 * count. Keying on the pair means one attacker cannot lock a real employee out
 * from another address.
 *
 * State is kept in process memory: it resets on restart and is not shared
 * between instances. That fits the single-instance deployment; a multi-instance
 * deployment would need a shared store.
 *
 * Must run after `validateBody(LoginSchema)` so `req.body.username` is a string.
 */
export const loginRateLimiter = (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      const now = Date.now();
      const key = keyFor(req);
      const record = failures.get(key);

      if (record && now - record.windowStartedAt >= LOGIN_WINDOW_MS) {
            failures.delete(key);
      } else if (record && record.count >= MAX_FAILED_LOGINS) {
            const retryAfterSeconds = Math.ceil(
                  (record.windowStartedAt + LOGIN_WINDOW_MS - now) / 1000,
            );
            res.setHeader("Retry-After", String(retryAfterSeconds));
            const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
            return handleControllerError(
                  res,
                  new AppError(
                        429,
                        `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
                  ),
            );
      }

      // Record the outcome once the login controller has answered.
      res.on("finish", () => {
            const finishedAt = Date.now();

            if (res.statusCode === 200) {
                  failures.delete(key);
                  return;
            }

            // Only wrong credentials count; inactive accounts (403) and
            // server errors do not.
            if (res.statusCode !== 401) {
                  return;
            }

            if (failures.size >= MAX_TRACKED_KEYS) {
                  pruneExpired(finishedAt);
            }

            const current = failures.get(key);
            if (
                  !current ||
                  finishedAt - current.windowStartedAt >= LOGIN_WINDOW_MS
            ) {
                  if (failures.size < MAX_TRACKED_KEYS) {
                        failures.set(key, {
                              count: 1,
                              windowStartedAt: finishedAt,
                        });
                  }
                  return;
            }

            current.count += 1;
      });

      next();
};
