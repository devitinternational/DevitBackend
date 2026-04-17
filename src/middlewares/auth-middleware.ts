// src/middlewares/auth-middleware.ts
import { Request, Response, NextFunction } from "express";

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
    const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3000";
    const response = await fetch(`${dashboardUrl}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const user = await response.json();
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    next();
  } catch (err) {
    res.status(401).json({ error: "Auth service unreachable" });
  }
}