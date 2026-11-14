import { Router } from "express";
import {
      loginController,
      logoutController,
      getMeController,
} from "./auth.controllers";
import { LoginSchema } from "./repository/auth.schema";
import { validateBody } from "../../utils/http";
import { authenticate } from "./auth.middleware";

const router = Router();

// Checked
router.post("/login", validateBody(LoginSchema), loginController);
// Revokes the presented token (by jti) and audits the logout.
router.post("/logout", authenticate, logoutController);
// Checked
router.get("/me", authenticate, getMeController);

export default router;
