import { Router } from "express";
import {
      loginController,
      logoutController,
      getMeController,
} from "./auth.controllers";
import { LoginSchema } from "./repository/auth.schema";
import { validateBody } from "../../utils/http";
import { authenticate } from "./auth.middleware";
import { loginRateLimiter } from "./auth.rate-limit";

const router = Router();

// Failed attempts are limited per client IP and username (429 when exceeded).
router.post(
      "/login",
      validateBody(LoginSchema),
      loginRateLimiter,
      loginController,
);
// Revokes the presented token (by jti) and audits the logout.
router.post("/logout", authenticate, logoutController);
// Checked
router.get("/me", authenticate, getMeController);

export default router;
