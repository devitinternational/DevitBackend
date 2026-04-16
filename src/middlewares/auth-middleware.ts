import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string;
  };
}

export async function verifyToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.authSecret) as any;

    if (!payload?.id || !payload?.email) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role ?? "LEARNER",
      name: payload.name,
    };

    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}