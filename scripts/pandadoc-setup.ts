/**
 * PandaDoc Setup Script
 *
 * Creates a quote agreement template in PandaDoc and registers the webhook.
 * Run once: npx tsx scripts/pandadoc-setup.ts
 *
 * Prerequisites:
 *   - PANDADOC_API_KEY set in apps/console/.env.local
 *   - Source env: export $(grep -v '^#' apps/console/.env.local | xargs)
 */

const API_KEY = process.env.PANDADOC_API_KEY;
if (!API_KEY) {
  console.error("Set PANDADOC_API_KEY before running this script.");
  process.exit(1);
}

const BASE = "https://api.pandadoc.com/public/v1";
const headers = {
  Authorization: `API-Key ${API_KEY}`,
  "Content-Type": "application/json",
};

async function main() {
  console.log("=== PandaDoc Setup ===\n");

  // 1. Create template
  console.log("1. Creating quote agreement template...");
  const templateRes = await fetch(`${BASE}/templates`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Displai Omni — Quote Agreement",
      metadata: { source: "displai_omni", type: "quote_agreement" },
    }),
  });

  if (!templateRes.ok) {
    const err = await templateRes.text();
    console.error(`Failed to create template: ${templateRes.status} ${err}`);
    process.exit(1);
  }

  const template = (await templateRes.json()) as { id: string; name: string };
  console.log(`   Template created: ${template.id}`);
  console.log(`   Name: ${template.name}\n`);

  // 2. Register webhook (if BASE_URL is available)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (baseUrl) {
    console.log("2. Registering webhook subscription...");
    const webhookUrl = `${baseUrl}/api/pandadoc/webhook`;
    const whRes = await fetch(`${BASE}/webhook-subscriptions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Displai Omni Quote Events",
        url: webhookUrl,
        triggers: [
          "document_state_changed",
          "recipient_completed",
          "document_completed",
        ],
        active: true,
      }),
    });

    if (whRes.ok) {
      const wh = (await whRes.json()) as { uuid: string };
      console.log(`   Webhook registered: ${wh.uuid}`);
      console.log(`   URL: ${webhookUrl}\n`);
    } else {
      const err = await whRes.text();
      console.log(`   Webhook registration failed (configure manually): ${err}\n`);
    }
  } else {
    console.log("2. Skipped webhook (set NEXT_PUBLIC_BASE_URL for auto-registration)\n");
  }

  // 3. Print next steps
  console.log("=== Next Steps ===\n");
  console.log(`Add this to apps/console/.env.local:`);
  console.log(`  PANDADOC_TEMPLATE_ID=${template.id}\n`);
  console.log(`Open the PandaDoc template editor and configure it:`);
  console.log(`  https://app.pandadoc.com/a/#/templates/${template.id}/edit\n`);
  console.log(`Add these merge fields (Variables) to the template body:`);
  console.log(`  {{customer_name}}       — Customer / account name`);
  console.log(`  {{quote_total}}         — Total amount`);
  console.log(`  {{payment_terms}}       — Prepay / Due on receipt / Net X`);
  console.log(`  {{effective_date}}      — Subscription start date`);
  console.log(`  {{expiration_date}}     — Quote expiration date`);
  console.log(`  {{line_items_summary}}  — Formatted line items table`);
  console.log(`  {{stripe_quote_id}}     — Stripe Quote reference\n`);
  console.log(`Add these fields to the signing area:`);
  console.log(`  - Signature field (assigned to "Customer" role)`);
  console.log(`  - Date Signed field (assigned to "Customer" role)\n`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
