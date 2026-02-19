import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { PrismaClient, Prisma } from "@prisma/client";

export type {
  User,
  Account,
  Session,
  CustomerIndex,
  WorkItem,
  AuditLog,
  IdempotencyKey,
} from "@prisma/client";

export { Role, WorkItemStatus } from "@prisma/client";
