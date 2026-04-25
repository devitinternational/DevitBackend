// Re-export the generated Prisma client and all types/enums.
// Consumers import from "@devitinternational/db" instead of "@prisma/client".
//
// Example usage:
//   import { PrismaClient, Role } from "@devitinternational/db";
//   import type { User, Domain } from "@devitinternational/db";

export { PrismaClient } from "../prisma/generated/prisma";
export * from "../prisma/generated/prisma";
