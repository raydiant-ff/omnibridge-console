"use server";

import { prisma, Prisma } from "@omnibridge/db";

export interface SfContactRow {
  Id: string;
  AccountId: string;
  FirstName?: string;
  LastName: string;
  Email?: string;
  Phone?: string;
  MobilePhone?: string;
  Title?: string;
  Department?: string;
  MailingCity?: string;
  MailingState?: string;
  MailingCountry?: string;
  LastModifiedDate?: string;
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Upsert a Salesforce Contact into the local mirror.
 * Safe to call from backfill scripts.
 */
export async function upsertSfContact(
  row: SfContactRow,
  options?: { isBillTo?: boolean; isPrimary?: boolean },
) {
  const data: Prisma.SfContactUncheckedCreateInput = {
    id: row.Id,
    accountId: row.AccountId,
    firstName: row.FirstName ?? null,
    lastName: row.LastName,
    email: row.Email ?? null,
    phone: row.Phone ?? null,
    mobilePhone: row.MobilePhone ?? null,
    title: row.Title ?? null,
    department: row.Department ?? null,
    mailingCity: row.MailingCity ?? null,
    mailingState: row.MailingState ?? null,
    mailingCountry: row.MailingCountry ?? null,
    isBillTo: options?.isBillTo ?? false,
    isPrimary: options?.isPrimary ?? false,
    sfLastModified: parseDate(row.LastModifiedDate),
    syncedAt: new Date(),
  };

  await prisma.sfContact.upsert({
    where: { id: row.Id },
    create: data,
    update: { ...data, id: undefined },
  });
}
