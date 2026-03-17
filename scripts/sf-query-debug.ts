import * as dotenv from "dotenv";
import * as path from "path";

// Load env from apps/console/.env.local
dotenv.config({ path: path.resolve(__dirname, "../apps/console/.env.local") });

import { soql } from "@omnibridge/salesforce";

async function runQuery(label: string, query: string) {
  console.log(`\n=== ${label} ===`);
  try {
    const result = await soql(query);
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error(`ERROR: ${err.message}`);
  }
}

async function main() {
  await runQuery(
    "1. Quote",
    `SELECT Id, Name, SBQQ__Status__c, SBQQ__Account__c, SBQQ__StartDate__c, SBQQ__EndDate__c, SBQQ__Type__c, SBQQ__SubscriptionTerm__c, SBQQ__Primary__c, SBQQ__Ordered__c, SBQQ__OrderByQuoteLineGroup__c, Stripe_Subscription_ID__c, Stripe_Customer_ID__c, CreatedDate, LastModifiedDate FROM SBQQ__Quote__c WHERE Id = 'a2fWQ000008IMWvYAO'`
  );

  await runQuery(
    "2. Quote Lines",
    `SELECT Id, SBQQ__Quote__c, SBQQ__Product__c, SBQQ__ProductName__c, SBQQ__Quantity__c, SBQQ__ListPrice__c, SBQQ__NetPrice__c, SBQQ__StartDate__c, SBQQ__EndDate__c, SBQQ__BillingFrequency__c, Stripe_Price_ID__c, Stripe_Product_ID__c, CreatedDate FROM SBQQ__QuoteLine__c WHERE SBQQ__Quote__c = 'a2fWQ000008IMWvYAO'`
  );

  await runQuery(
    "3. Account",
    `SELECT Id, Name, Stripe_Customer_ID__c, OwnerId, Owner.Name FROM Account WHERE Id = '0018W00002fpjk3QAA'`
  );

  await runQuery(
    "4. Contracts",
    `SELECT Id, ContractNumber, Status, StartDate, EndDate, Stripe_Subscription_ID__c, Stripe_Customer_ID__c, Stripe_Status__c, SBQQ__Quote__c, CreatedDate, LastModifiedDate FROM Contract WHERE AccountId = '0018W00002fpjk3QAA' ORDER BY CreatedDate DESC LIMIT 10`
  );

  await runQuery(
    "5. CPQ Subscriptions",
    `SELECT Id, SBQQ__Quote__c, SBQQ__Contract__c, SBQQ__Active__c, CreatedDate FROM SBQQ__Subscription__c WHERE SBQQ__Account__c = '0018W00002fpjk3QAA' ORDER BY CreatedDate DESC LIMIT 20`
  );
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
