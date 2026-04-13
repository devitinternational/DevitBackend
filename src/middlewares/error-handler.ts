import { Request, Response, NextFunction } from "express";
import { ApiError } from "../config/api.config.js";
export const error_handler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
    });
  }

  console.error("Unhandled error", err);
  return res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong",
  });
};

