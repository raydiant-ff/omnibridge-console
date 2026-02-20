import { PrismaClient } from "../generated/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { PrismaClient, Prisma } from "../generated/client";

export type {
  User,
  Account,
  Session,
  CustomerIndex,
  WorkItem,
  AuditLog,
  IdempotencyKey,
} from "../generated/client";

export { Role, WorkItemStatus } from "../generated/client";
