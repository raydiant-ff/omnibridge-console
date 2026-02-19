"use server";

import { prisma } from "@omnibridge/db";

export async function searchCustomers(query: string) {
  if (!query || query.length < 2) return [];

  return prisma.customerIndex.findMany({
    where: {
      OR: [
        { sfAccountName: { contains: query, mode: "insensitive" } },
        { domain: { contains: query, mode: "insensitive" } },
        { stripeCustomerId: { contains: query, mode: "insensitive" } },
        { sfAccountId: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { sfAccountName: "asc" },
    take: 50,
  });
}

export async function getCustomerById(id: string) {
  return prisma.customerIndex.findUnique({ where: { id } });
}

export async function getCustomerWorkItems(customerId: string) {
  return prisma.workItem.findMany({
    where: { customerId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getCustomerAuditLogs(customerId: string) {
  return prisma.auditLog.findMany({
    where: { customerId },
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
