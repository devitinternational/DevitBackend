// Minimal config for prisma generate (no DB URL needed for generation)
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
});
