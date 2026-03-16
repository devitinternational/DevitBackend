export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp: string;
  path?: string;
}

export type LogLevel = "error" | "warn" | "info" | "debug";
