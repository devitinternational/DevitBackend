export const api_codes = {
  success: "SUCCESS",
  created: "CREATED",
  bad_request: "BAD_REQUEST",
  unauthorized: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  not_found: "NOT_FOUND",
  internal_server_error: "INTERNAL_SERVER_ERROR",
  conflict: "CONFLICT",
  invalid: "INVALID",
};

// Base REST error class
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// REST throw helpers
export const throw_invalid = (message: string): never => {
  console.log("invalid", message);
  throw new ApiError(400, api_codes.invalid, message);
};

export const throw_bad_request = (message: string): never => {
  console.log("bad_request", message);
  throw new ApiError(400, api_codes.bad_request, message);
};

export const throw_unauthorized = (message: string): never => {
  console.log("unauthorized", message);
  throw new ApiError(401, api_codes.unauthorized, message);
};

export const throw_forbidden = (message: string): never => {
  console.log("forbidden", message);
  throw new ApiError(403, api_codes.forbidden, message);
};

export const throw_not_found = (message: string): never => {
  console.log("not_found", message);
  throw new ApiError(404, api_codes.not_found, message);
};

export const throw_conflict = (message: string): never => {
  console.log("conflict", message);
  throw new ApiError(409, api_codes.conflict, message);
};

export const throw_internal_server_error = (message: string): never => {
  console.log("internal_server_error", message);
  throw new ApiError(500, api_codes.internal_server_error, message);
};