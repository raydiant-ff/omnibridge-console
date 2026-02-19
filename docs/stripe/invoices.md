# Stripe API — Invoices

> Source: https://docs.stripe.com/api/invoices

Invoices are statements of amounts owed by a customer, and are either generated one-off, or generated periodically from a subscription.

They contain [invoice items](https://docs.stripe.com/api/invoiceitems), and proration adjustments that may be caused by subscription upgrades/downgrades (if necessary).

If your invoice is configured to be billed through automatic charges, Stripe automatically finalizes your invoice and attempts payment. Note that finalizing the invoice, [when automatic](https://docs.stripe.com/docs/invoicing/integration/automatic-advancement-collection), does not happen immediately as the invoice is created. Stripe waits until one hour after the last webhook was successfully sent (or the last webhook timed out after failing).

If your invoice is configured to be billed by sending an email, then based on your [email settings](https://dashboard.stripe.com/account/billing/automatic), Stripe will email the invoice to your customer and await payment.

Stripe applies any customer credit on the account before determining the amount due for the invoice (the amount that will actually be charged). If the amount due is less than Stripe's [minimum allowed charge per currency](https://docs.stripe.com/docs/currencies#minimum-and-maximum-charge-amounts), the invoice is automatically marked paid.

Related guide: [Send invoices to customers](https://docs.stripe.com/docs/billing/invoices/sending)

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/invoices/create_preview` | [Create a preview invoice](https://docs.stripe.com/api/invoices/create_preview) |
| POST | `/v1/invoices` | [Create an invoice](https://docs.stripe.com/api/invoices/create) |
| POST | `/v1/invoices/:id` | [Update an invoice](https://docs.stripe.com/api/invoices/update) |
| GET | `/v1/invoices/:id` | [Retrieve an invoice](https://docs.stripe.com/api/invoices/retrieve) |
| GET | `/v1/invoices` | [List all invoices](https://docs.stripe.com/api/invoices/list) |
| DELETE | `/v1/invoices/:id` | [Delete a draft invoice](https://docs.stripe.com/api/invoices/delete) |
| POST | `/v1/invoices/:id/attach_payment` | [Attach a payment](https://docs.stripe.com/api/invoices/attach_payment) |
| POST | `/v1/invoices/:id/finalize` | [Finalize an invoice](https://docs.stripe.com/api/invoices/finalize) |
| POST | `/v1/invoices/:id/mark_uncollectible` | [Mark as uncollectible](https://docs.stripe.com/api/invoices/mark_uncollectible) |
| POST | `/v1/invoices/:id/pay` | [Pay an invoice](https://docs.stripe.com/api/invoices/pay) |
| GET | `/v1/invoices/search` | [Search invoices](https://docs.stripe.com/api/invoices/search) |
| POST | `/v1/invoices/:id/send` | [Send for manual payment](https://docs.stripe.com/api/invoices/send) |
| POST | `/v1/invoices/:id/void` | [Void an invoice](https://docs.stripe.com/api/invoices/void) |

---

## The Invoice Object

### Core Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string | Unique identifier. |
| `object` | string | `"invoice"` |
| `status` | enum, nullable | `draft`, `open`, `paid`, `uncollectible`, or `void`. |
| `customer` | string | Customer ID. |
| `currency` | enum | Three-letter ISO currency code. |
| `created` | timestamp | Time created. |
| `livemode` | boolean | Live or test mode. |
| `metadata` | object, nullable | Key-value pairs. |
| `number` | string, nullable | Unique invoice number. |
| `description` | string, nullable | Arbitrary description. |

### Amounts

| Attribute | Type | Description |
|-----------|------|-------------|
| `amount_due` | integer | Final amount due in cents. |
| `amount_paid` | integer | Amount paid in cents. |
| `amount_remaining` | integer | Amount remaining in cents. |
| `amount_shipping` | integer | Shipping amount in cents. |
| `subtotal` | integer | Total before discounts/taxes. |
| `subtotal_excluding_tax` | integer, nullable | Subtotal excluding tax. |
| `total` | integer | Total after discounts and taxes. |
| `total_excluding_tax` | integer, nullable | Total excluding tax. |
| `total_discount_amounts` | array, nullable | Discount amounts per discount. |
| `total_taxes` | array, nullable | Aggregate tax info for all line items. |
| `total_pretax_credit_amounts` | array, nullable | Pretax credit amounts. |
| `starting_balance` | integer | Customer balance before finalization. |
| `ending_balance` | integer, nullable | Customer balance after finalization. |

### Billing Configuration

| Attribute | Type | Description |
|-----------|------|-------------|
| `collection_method` | enum | `charge_automatically` or `send_invoice`. |
| `billing_reason` | enum, nullable | Why the invoice was created (subscription_create, subscription_cycle, subscription_update, subscription_threshold, upcoming, manual). |
| `due_date` | timestamp, nullable | Due date (for `send_invoice`). |
| `auto_advance` | boolean | Whether Stripe performs auto-collection. |
| `automatically_finalizes_at` | timestamp, nullable | Scheduled finalization time. |
| `period_start` | timestamp | Start of the billing period. |
| `period_end` | timestamp | End of the billing period. |

### Payment

| Attribute | Type | Description |
|-----------|------|-------------|
| `default_payment_method` | string, nullable | Default PaymentMethod ID. |
| `default_source` | string, nullable | Default source ID. |
| `payment_intent` | string, nullable | PaymentIntent ID. |
| `payment_settings` | object | Payment method options and types. |
| `charge` | string, nullable | Charge ID for paid invoices. |
| `paid` | boolean | Whether the invoice has been paid. |
| `paid_out_of_band` | boolean | Whether paid outside Stripe. |
| `attempt_count` | integer | Number of payment attempts. |
| `attempted` | boolean | Whether payment has been attempted. |
| `next_payment_attempt` | timestamp, nullable | Next auto-payment attempt time. |

### Line Items & Discounts

| Attribute | Type | Description |
|-----------|------|-------------|
| `lines` | object | List of invoice line items. |
| `default_tax_rates` | array | Tax rates applied to line items without explicit tax_rates. |
| `discounts` | array | Discounts applied to the invoice. |

### Subscription Info

| Attribute | Type | Description |
|-----------|------|-------------|
| `subscription` | string, nullable | Subscription ID that generated this invoice. |
| `subscription_details` | object, nullable | Subscription metadata. |

### Status Transitions

| Attribute | Type | Description |
|-----------|------|-------------|
| `status_transitions.finalized_at` | timestamp, nullable | When finalized. |
| `status_transitions.paid_at` | timestamp, nullable | When paid. |
| `status_transitions.marked_uncollectible_at` | timestamp, nullable | When marked uncollectible. |
| `status_transitions.voided_at` | timestamp, nullable | When voided. |

### Rendering & Delivery

| Attribute | Type | Description |
|-----------|------|-------------|
| `hosted_invoice_url` | string, nullable | URL for the hosted invoice page. |
| `invoice_pdf` | string, nullable | URL for the invoice PDF. |
| `statement_descriptor` | string, nullable | Credit card statement descriptor. |
| `footer` | string, nullable | Invoice footer. |
| `custom_fields` | array, nullable | Custom fields on the invoice. |
| `rendering` | object, nullable | Rendering options (amount_tax_display, pdf, template). |
| `shipping_details` | object, nullable | Shipping details for PDF. |
| `shipping_cost` | object, nullable | Shipping cost details. |

### Other

| Attribute | Type | Description |
|-----------|------|-------------|
| `automatic_tax` | object | Auto tax (enabled, liability, status). |
| `account_country` | string, nullable | Country of the Stripe account. |
| `account_name` | string, nullable | Name of the Stripe account. |
| `customer_email` | string, nullable | Customer's email at invoice time. |
| `customer_name` | string, nullable | Customer's name at invoice time. |
| `customer_address` | object, nullable | Customer's address at invoice time. |
| `customer_phone` | string, nullable | Customer's phone at invoice time. |
| `customer_shipping` | object, nullable | Customer's shipping info at invoice time. |
| `customer_tax_exempt` | enum, nullable | Tax exempt status at invoice time. |
| `customer_tax_ids` | array, nullable | Tax IDs at invoice time. |
| `effective_at` | timestamp, nullable | When the invoice is in effect. |
| `webhooks_delivered_at` | timestamp, nullable | When webhooks were delivered. |
| `last_finalization_error` | object, nullable | Error from last finalization attempt. |
| `pre_payment_credit_notes_amount` | integer | Pre-payment credit note amount. |
| `post_payment_credit_notes_amount` | integer | Post-payment credit note amount. |
| `application` | string, nullable | Connect Application ID. |
| `application_fee_amount` | integer, nullable | Application fee in cents. |
| `on_behalf_of` | string, nullable | Account charges are on behalf of. |
| `transfer_data` | object, nullable | Transfer destination. |
| `issuer` | object | Account that issues the invoice. |
| `test_clock` | string, nullable | Test clock ID. |
| `threshold_reason` | object, nullable | Threshold trigger details. |

---

## Create an Invoice

`POST /v1/invoices`

Creates a draft invoice. The invoice remains a draft until you [finalize](https://docs.stripe.com/api/invoices/finalize) it.

### Key Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer` | string | Yes* | Customer ID (required unless `from_invoice` provided). |
| `collection_method` | enum | No | `charge_automatically` (default) or `send_invoice`. |
| `currency` | enum | No | Defaults to customer's currency. |
| `auto_advance` | boolean | No | Auto-collection (default false). |
| `description` | string | No | Arbitrary description ("memo" in Dashboard). |
| `metadata` | object | No | Key-value pairs. |
| `due_date` | timestamp | No | For `send_invoice` only. |
| `days_until_due` | integer | No | For `send_invoice` only. |
| `default_payment_method` | string | No | PaymentMethod ID. |
| `default_source` | string | No | Source ID. |
| `default_tax_rates` | array | No | Tax Rate IDs. |
| `discounts` | array | No | Coupons/promotion codes. |
| `custom_fields` | array | No | Up to 4 custom fields (name, value). |
| `footer` | string | No | Invoice footer. |
| `number` | string | No | Custom invoice number. |
| `statement_descriptor` | string | No | Credit card statement text. |
| `effective_at` | timestamp | No | Replaces 'Date of issue' on PDF. |
| `automatically_finalizes_at` | timestamp | No | Scheduled finalization (up to 5 years). |
| `automatic_tax` | object | No | enabled (required), liability. |
| `issuer` | object | No | Account that issues the invoice. |
| `account_tax_ids` | array | No | Account tax IDs. |
| `application_fee_amount` | integer | No | Connect fee in cents. |
| `on_behalf_of` | string | No | Connected account. |
| `from_invoice` | object | No* | Clone/revise an existing invoice (action, invoice). |
| `rendering` | object | No | PDF rendering options. |
| `shipping_cost` | object | No | Shipping cost. |
| `shipping_details` | object | No | Shipping details for PDF. |
| `transfer_data` | object | No | Transfer destination. |

### Returns

The invoice object. Raises an error if the customer ID is invalid.
