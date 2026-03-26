"use server";

import { requireSession } from "@omnibridge/auth";
import { soql, escapeSoql } from "@omnibridge/salesforce";
import { flags } from "@/lib/feature-flags";

export interface AccountContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title?: string;
  phone?: string;
  isBillTo: boolean;
}

export async function getAccountContacts(sfAccountId: string): Promise<AccountContact[]> {
  await requireSession();

  if (flags.useMockSalesforce) {
    return [
      {
        id: "003MOCK001",
        firstName: "John",
        lastName: "Smith",
        email: "john.smith@testaccount.com",
        title: "Finance Manager",
        phone: "(555) 123-4567",
        isBillTo: true,
      },
      {
        id: "003MOCK002", 
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe@testaccount.com",
        title: "Procurement Lead",
        isBillTo: false,
      },
    ];
  }

  try {
    const safeId = escapeSoql(sfAccountId);
    
    const [contacts, accounts] = await Promise.all([
      soql<{
        Id: string;
        FirstName: string;
        LastName: string;
        Email: string;
        Title?: string;
        Phone?: string;
      }>(`
        SELECT Id, FirstName, LastName, Email, Title, Phone
        FROM Contact
        WHERE AccountId = '${safeId}'
          AND Email != null
          AND IsDeleted = false
        ORDER BY LastName, FirstName
        LIMIT 50
      `),
      soql<{
        blng__BillToContact__c?: string;
      }>(`
        SELECT blng__BillToContact__c
        FROM Account
        WHERE Id = '${safeId}'
        LIMIT 1
      `),
    ]);
    
    const currentBillToId = accounts[0]?.blng__BillToContact__c;

    return contacts.map(contact => ({
      id: contact.Id,
      firstName: contact.FirstName || "",
      lastName: contact.LastName || "",
      email: contact.Email,
      title: contact.Title || undefined,
      phone: contact.Phone || undefined,
      isBillTo: contact.Id === currentBillToId,
    }));

  } catch (err) {
    console.error("[getAccountContacts] error:", err);
    throw new Error(err instanceof Error ? err.message : "Failed to fetch contacts");
  }
}
