import { createApp } from "./app.js";
import { env } from "./config/env.js";
import "dotenv/config";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
