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
  ProductLog,
  IdempotencyKey,
  QuoteRecord,
  StripeSubscription,
  StripeSubscriptionItem,
  SyncJob,
  SyncEvent,
  StripeCustomer,
  StripeProduct,
  StripePrice,
  SfAccount,
  SfContract,
  SfContractLine,
  StripeInvoice,
  StripePayment,
  StripePaymentMethod,
  SfContact,
  SfQuote,
  SupportChannelAccount,
  SupportChannelEndpoint,
  SupportAgentChannelAccess,
  SupportConversation,
  SupportMessage,
  SupportParticipant,
  SupportConversationEvent,
} from "../generated/client";

export {
  Role,
  WorkItemStatus,
  SupportExternalSystem,
  SupportChannel,
  SupportConversationStatus,
  SupportPriority,
  SupportWaitingOn,
  SupportMessageDirection,
  SupportMessageType,
  SupportParticipantRole,
  SupportConversationEventType,
} from "../generated/client";
