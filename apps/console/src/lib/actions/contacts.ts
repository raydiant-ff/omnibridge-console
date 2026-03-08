"use server";

import { requireSession } from "@omnibridge/auth";
import { flags } from "@/lib/feature-flags";

export interface CreateContactInput {
  sfAccountId: string;
  firstName: string;
  lastName: string;
  email: string;
  title?: string;
  phone?: string;
}

export interface CreateContactResult {
  success: boolean;
  contactId?: string;
  error?: string;
}

export async function createContact(input: CreateContactInput): Promise<CreateContactResult> {
  await requireSession();

  if (flags.useMockSalesforce) {
    return {
      success: true,
      contactId: `003mock${Date.now().toString(36)}`,
    };
  }

  try {
    const { createSObject } = await import("@omnibridge/salesforce");
    
    const contactFields = {
      AccountId: input.sfAccountId,
      FirstName: input.firstName.trim(),
      LastName: input.lastName.trim(),
      Email: input.email.trim().toLowerCase(),
      ...(input.title ? { Title: input.title.trim() } : {}),
      ...(input.phone ? { Phone: input.phone.trim() } : {}),
    };

    const result = await createSObject("Contact", contactFields);
    
    return {
      success: true,
      contactId: result.id,
    };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to create contact: ${message}`,
    };
  }
}

export interface SetBillToContactResult {
  success: boolean;
  error?: string;
}

export async function setBillToContact(
  sfAccountId: string, 
  contactId: string
): Promise<SetBillToContactResult> {
  await requireSession();

  if (flags.useMockSalesforce) {
    return { success: true };
  }

  try {
    const { updateSObject } = await import("@omnibridge/salesforce");
    
    await updateSObject("Account", sfAccountId, {
      blng__BillToContact__c: contactId,
    });

    return { success: true };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to set Bill-To Contact: ${message}`,
    };
  }
}