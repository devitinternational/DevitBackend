import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth-middleware";

export function requireRole(...roles: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: "Forbidden",
        required: roles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
}