# Stripe API — Credit Notes

> Source: https://docs.stripe.com/api/credit_notes

Issue a credit note to adjust an invoice's amount after the invoice is finalized.

Related guide: [Credit notes](https://docs.stripe.com/docs/billing/invoices/credit-notes)

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/credit_notes` | [Create a credit note](https://docs.stripe.com/api/credit_notes/create) |
| POST | `/v1/credit_notes/:id` | [Update a credit note](https://docs.stripe.com/api/credit_notes/update) |
| GET | `/v1/credit_notes/:id` | [Retrieve a credit note](https://docs.stripe.com/api/credit_notes/retrieve) |
| GET | `/v1/credit_notes/preview/lines` | [Preview line items](https://docs.stripe.com/api/credit_notes/preview_lines) |
| GET | `/v1/credit_notes/:id/lines` | [Retrieve line items](https://docs.stripe.com/api/credit_notes/lines) |
| GET | `/v1/credit_notes` | [List all credit notes](https://docs.stripe.com/api/credit_notes/list) |
| GET | `/v1/credit_notes/preview` | [Preview a credit note](https://docs.stripe.com/api/credit_notes/preview) |
| POST | `/v1/credit_notes/:id/void` | [Void a credit note](https://docs.stripe.com/api/credit_notes/void) |

---

## The Credit Note Object

### Core Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string | Unique identifier. |
| `object` | string | `"credit_note"` |
| `number` | string | Unique credit note number. |
| `status` | enum | `issued` or `void`. |
| `type` | enum | `pre_payment` (issued when invoice was open), `post_payment` (issued when invoice was paid), or `mixed`. |
| `invoice` | string | ID of the related invoice. |
| `customer` | string | ID of the customer. |
| `currency` | enum | Three-letter ISO currency code. |
| `created` | timestamp | Time created. |
| `livemode` | boolean | Live or test mode. |
| `metadata` | object | Key-value pairs. |
| `memo` | string, nullable | Memo displayed on the PDF. |
| `reason` | enum, nullable | `duplicate`, `fraudulent`, `order_change`, or `product_unsatisfactory`. |
| `effective_at` | timestamp, nullable | Date of issue (replaces system-generated date on PDF). |
| `voided_at` | timestamp, nullable | When voided. |
| `pdf` | string | URL to the credit note PDF. |

### Amounts

| Attribute | Type | Description |
|-----------|------|-------------|
| `amount` | integer | Total credit note amount in cents. |
| `subtotal` | integer | Amount excluding exclusive tax and invoice-level discounts. |
| `subtotal_excluding_tax` | integer, nullable | Subtotal excluding all tax. |
| `total` | integer | Total including tax and discounts. |
| `total_excluding_tax` | integer, nullable | Total excluding tax but including discounts. |
| `discount_amount` | integer | Total discount amount. |
| `discount_amounts` | array | Per-discount breakdown. |
| `amount_shipping` | integer | Shipping amount. |

### Credit Distribution

| Attribute | Type | Description |
|-----------|------|-------------|
| `pre_payment_amount` | integer | Amount reducing the invoice's `amount_remaining`. |
| `post_payment_amount` | integer | Excess amount distributed as refund, customer balance credit, or out-of-band credit. |
| `credit_amount` | integer | Amount credited to customer balance. |
| `out_of_band_amount` | integer | Amount credited outside of Stripe. |
| `refunds` | array | Linked refunds. |
| `customer_balance_transaction` | string, nullable | Customer balance transaction ID. |

### Tax

| Attribute | Type | Description |
|-----------|------|-------------|
| `total_taxes` | array, nullable | Aggregate tax info (amount, tax_behavior, tax_rate_details, taxability_reason, taxable_amount). |

### Line Items

| Attribute | Type | Description |
|-----------|------|-------------|
| `lines` | object | List of credit note line items (id, amount, description, quantity, type, unit_amount, tax_rates, invoice_line_item, etc.). |

### Shipping

| Attribute | Type | Description |
|-----------|------|-------------|
| `shipping_cost` | object, nullable | Shipping cost details (amount_subtotal, amount_tax, amount_total, shipping_rate, taxes). |

### Example Object

```json
{
  "id": "cn_1MxvRqLkdIwHu7ixY0xbUcxk",
  "object": "credit_note",
  "amount": 1099,
  "amount_shipping": 0,
  "created": 1681750958,
  "currency": "usd",
  "customer": "cus_NjLgPhUokHubJC",
  "customer_balance_transaction": null,
  "discount_amount": 0,
  "discount_amounts": [],
  "invoice": "in_1MxvRkLkdIwHu7ixABNtI99m",
  "lines": {
    "object": "list",
    "data": [
      {
        "id": "cnli_1MxvRqLkdIwHu7ixFpdhBFQf",
        "object": "credit_note_line_item",
        "amount": 1099,
        "description": "T-shirt",
        "discount_amount": 0,
        "discount_amounts": [],
        "invoice_line_item": "il_1MxvRlLkdIwHu7ixnkbntxUV",
        "livemode": false,
        "quantity": 1,
        "tax_rates": [],
        "taxes": [],
        "type": "invoice_line_item",
        "unit_amount": 1099,
        "unit_amount_decimal": "1099"
      }
    ],
    "has_more": false,
    "url": "/v1/credit_notes/cn_1MxvRqLkdIwHu7ixY0xbUcxk/lines"
  },
  "livemode": false,
  "memo": null,
  "metadata": {},
  "number": "C9E0C52C-0036-CN-01",
  "out_of_band_amount": null,
  "pdf": "https://pay.stripe.com/credit_notes/.../pdf?s=ap",
  "pre_payment_amount": 1099,
  "post_payment_amount": 0,
  "reason": null,
  "refunds": [],
  "shipping_cost": null,
  "status": "issued",
  "subtotal": 1099,
  "subtotal_excluding_tax": 1099,
  "total": 1099,
  "total_excluding_tax": 1099,
  "total_taxes": [],
  "type": "pre_payment",
  "voided_at": null
}
```

---

## Create a Credit Note

`POST /v1/credit_notes`

Issue a credit note to adjust the amount of a finalized invoice. A credit note will first reduce the invoice's `amount_remaining` (and `amount_due`), but not below zero. This amount is indicated by `pre_payment_amount`. The excess (`post_payment_amount`) can be distributed as:

- **Outside of Stripe credit**: `out_of_band_amount`
- **Customer balance credit**: `credit_amount` (auto-applied to next invoice)
- **Refunds**: `refund_amount` (new refund) or `refunds` (link existing)

The sum of refunds + customer balance credits + outside credits must equal `post_payment_amount`.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `invoice` | string | **Yes** | ID of the invoice. |
| `amount` | integer | Conditional* | Total credit note amount in cents. One of `amount`, `lines`, or `shipping_cost` required. |
| `lines` | array | Conditional* | Line items for the credit note. Each has: `type` (`invoice_line_item` or `custom_line_item`), `invoice_line_item`, `amount`, `quantity`, `unit_amount`, `description`, `tax_rates`, `tax_amounts`. |
| `shipping_cost` | object | Conditional* | Shipping cost to include (shipping_rate). |
| `reason` | enum | No | `duplicate`, `fraudulent`, `order_change`, or `product_unsatisfactory`. |
| `memo` | string | No | Memo on the credit note PDF. |
| `metadata` | object | No | Key-value pairs. |
| `effective_at` | timestamp | No | Date of issue on PDF. |
| `email_type` | enum | No | `credit_note` (default) or `none`. |
| `credit_amount` | integer | No | Amount to credit to customer balance. |
| `refund_amount` | integer | No | Amount to refund (creates a new refund). |
| `refunds` | array | No | Link existing refunds (type, refund/payment_record_refund, amount_refunded). |
| `out_of_band_amount` | integer | No | Amount credited outside Stripe. |

### Example

```bash
curl https://api.stripe.com/v1/credit_notes \
  -u "sk_test_..." \
  -d invoice=in_1MxvRkLkdIwHu7ixABNtI99m
```

### Returns

The credit note object.

---

## Key Concepts

### Credit Note Types
- **pre_payment**: Issued when the invoice is still open. Reduces `amount_remaining`.
- **post_payment**: Issued after the invoice is paid. The `post_payment_amount` must be distributed among refunds, customer balance, or out-of-band credits.
- **mixed**: Combination of both.

### Voiding
- Use `POST /v1/credit_notes/:id/void` to void a credit note.
- Voided credit notes can no longer be edited or used.
- Original invoice amounts are restored.

### Multiple Credit Notes
- You may issue multiple credit notes for a single invoice.
- Each may increment `pre_payment_credit_notes_amount`, `post_payment_credit_notes_amount`, or both.
