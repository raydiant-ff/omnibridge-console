# Stripe API — Subscriptions

> Source: https://docs.stripe.com/api/subscriptions

Subscriptions allow you to charge a customer on a recurring basis.

Related guide: [Creating subscriptions](https://docs.stripe.com/docs/billing/subscriptions/creating)

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/subscriptions` | [Create a subscription](https://docs.stripe.com/api/subscriptions/create) |
| POST | `/v1/subscriptions/:id` | [Update a subscription](https://docs.stripe.com/api/subscriptions/update) |
| GET | `/v1/subscriptions/:id` | [Retrieve a subscription](https://docs.stripe.com/api/subscriptions/retrieve) |
| GET | `/v1/subscriptions` | [List subscriptions](https://docs.stripe.com/api/subscriptions/list) |
| DELETE | `/v1/subscriptions/:id` | [Cancel a subscription](https://docs.stripe.com/api/subscriptions/cancel) |
| POST | `/v1/subscriptions/:id/migrate` | [Migrate a subscription](https://docs.stripe.com/api/subscriptions/migrate) |
| POST | `/v1/subscriptions/:id/resume` | [Resume a subscription](https://docs.stripe.com/api/subscriptions/resume) |
| GET | `/v1/subscriptions/search` | [Search subscriptions](https://docs.stripe.com/api/subscriptions/search) |

---

## The Subscription Object

### Core Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string | Unique identifier. |
| `object` | string | `"subscription"` |
| `status` | enum | `incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `canceled`, `unpaid`, or `paused`. |
| `customer` | string | ID of the customer who owns the subscription. |
| `currency` | enum | Three-letter ISO currency code. |
| `created` | timestamp | Time created (Unix epoch). |
| `start_date` | timestamp | Date when first created (may differ from `created` due to backdating). |
| `livemode` | boolean | `true` for live mode. |
| `metadata` | object | Key-value pairs. |
| `description` | string, nullable | Displayable description (max 500 chars). |

### Billing Configuration

| Attribute | Type | Description |
|-----------|------|-------------|
| `collection_method` | enum | `charge_automatically` or `send_invoice`. |
| `billing_cycle_anchor` | timestamp | Reference point for billing cycle alignment. |
| `billing_cycle_anchor_config` | object, nullable | Fixed values for anchor (day_of_month, hour, minute, month, second). |
| `billing_mode` | object | Controls proration/invoice calculation (`classic` or `flexible`). |
| `billing_thresholds` | object, nullable | Thresholds for invoice generation (amount_gte, reset_billing_cycle_anchor). |
| `days_until_due` | integer, nullable | Days to pay (for `send_invoice` only). |

### Payment

| Attribute | Type | Description |
|-----------|------|-------------|
| `default_payment_method` | string, nullable | Default PaymentMethod ID (takes precedence over default_source). |
| `default_source` | string, nullable | Default payment source ID. |
| `payment_settings` | object, nullable | Payment method options, types, save_default_payment_method. |
| `latest_invoice` | string, nullable | Most recent invoice ID. |

### Items & Pricing

| Attribute | Type | Description |
|-----------|------|-------------|
| `items` | object | List of subscription items with prices. Each item has: id, price, quantity, tax_rates, metadata. |
| `default_tax_rates` | array, nullable | Tax rates applied to items without explicit tax_rates. |
| `discounts` | array | Discount IDs applied to the subscription. |

### Lifecycle

| Attribute | Type | Description |
|-----------|------|-------------|
| `cancel_at` | timestamp, nullable | Future auto-cancellation date. |
| `cancel_at_period_end` | boolean | Whether it cancels at period end. |
| `canceled_at` | timestamp, nullable | Date of cancellation. |
| `cancellation_details` | object, nullable | Comment, feedback, reason. |
| `ended_at` | timestamp, nullable | Date the subscription ended. |
| `schedule` | string, nullable | Attached subscription schedule ID. |
| `pending_update` | object, nullable | Pending changes awaiting invoice payment. |

### Trials

| Attribute | Type | Description |
|-----------|------|-------------|
| `trial_start` | timestamp, nullable | Beginning of trial. |
| `trial_end` | timestamp, nullable | End of trial. |
| `trial_settings` | object, nullable | Trial end behavior (missing_payment_method: cancel/create_invoice/pause). |

### Other

| Attribute | Type | Description |
|-----------|------|-------------|
| `automatic_tax` | object | Auto tax settings (enabled, liability). |
| `application` | string, nullable | Connect Application ID. |
| `application_fee_percent` | float, nullable | Percentage transferred to application owner. |
| `on_behalf_of` | string, nullable | Account charges are made on behalf of. |
| `transfer_data` | object, nullable | Where funds are transferred per invoice. |
| `pause_collection` | object, nullable | Pause settings (behavior, resumes_at). |
| `pending_setup_intent` | string, nullable | SetupIntent for off-session payments. |
| `pending_invoice_item_interval` | object, nullable | Interval for billing pending items. |
| `presentment_details` | object, nullable | Currency presented to customer. |
| `test_clock` | string, nullable | Test clock ID. |

### Example Object

```json
{
  "id": "sub_1MowQVLkdIwHu7ixeRlqHVzs",
  "object": "subscription",
  "application": null,
  "application_fee_percent": null,
  "automatic_tax": { "enabled": false, "liability": null },
  "billing_cycle_anchor": 1679609767,
  "cancel_at": null,
  "cancel_at_period_end": false,
  "canceled_at": null,
  "cancellation_details": { "comment": null, "feedback": null, "reason": null },
  "collection_method": "charge_automatically",
  "created": 1679609767,
  "currency": "usd",
  "customer": "cus_Na6dX7aXxi11N4",
  "days_until_due": null,
  "default_payment_method": null,
  "default_source": null,
  "default_tax_rates": [],
  "description": null,
  "discounts": null,
  "ended_at": null,
  "invoice_settings": { "issuer": { "type": "self" } },
  "items": {
    "object": "list",
    "data": [
      {
        "id": "si_Na6dzxczY5fwHx",
        "object": "subscription_item",
        "created": 1679609768,
        "current_period_end": 1682288167,
        "current_period_start": 1679609767,
        "metadata": {},
        "price": {
          "id": "price_1MowQULkdIwHu7ixraBm864M",
          "object": "price",
          "active": true,
          "billing_scheme": "per_unit",
          "created": 1679609766,
          "currency": "usd",
          "recurring": {
            "interval": "month",
            "interval_count": 1,
            "usage_type": "licensed"
          },
          "type": "recurring",
          "unit_amount": 1000,
          "unit_amount_decimal": "1000"
        },
        "quantity": 1,
        "subscription": "sub_1MowQVLkdIwHu7ixeRlqHVzs",
        "tax_rates": []
      }
    ],
    "has_more": false,
    "url": "/v1/subscription_items?subscription=sub_1MowQVLkdIwHu7ixeRlqHVzs"
  },
  "latest_invoice": "in_1MowQWLkdIwHu7ixuzkSPfKd",
  "livemode": false,
  "metadata": {},
  "status": "active",
  "trial_end": null,
  "trial_start": null
}
```

---

## Create a Subscription

`POST /v1/subscriptions`

Each customer can have up to 500 active or scheduled subscriptions.

### Key Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer` | string | Yes* | Customer ID to subscribe. |
| `items` | array | Yes | List of items (price, quantity, tax_rates, metadata). |
| `collection_method` | enum | No | `charge_automatically` (default) or `send_invoice`. |
| `currency` | enum | No | ISO currency code. |
| `default_payment_method` | string | No | PaymentMethod ID. |
| `billing_cycle_anchor` | timestamp | No | Future timestamp for billing alignment. |
| `billing_cycle_anchor_config` | object | No | day_of_month, hour, minute, month, second. |
| `backdate_start_date` | timestamp | No | Past timestamp to backdate the start. |
| `cancel_at` | timestamp/enum | No | When to auto-cancel. |
| `cancel_at_period_end` | boolean | No | Cancel at period end (default false). |
| `days_until_due` | integer | No | Days to pay (for `send_invoice`). |
| `description` | string | No | Displayable description (max 500 chars). |
| `metadata` | object | No | Key-value pairs. |
| `trial_end` | timestamp/string | No | Trial end date or `"now"`. |
| `trial_period_days` | integer | No | Number of trial days. |
| `automatic_tax` | object | No | Auto tax settings (enabled, liability). |
| `billing_mode` | object | No | `classic` or `flexible` (default). |
| `payment_behavior` | enum | No | `default_incomplete`, `error_if_incomplete`, `allow_incomplete`, `pending_if_incomplete`. |
| `proration_behavior` | enum | No | `create_prorations` (default), `none`, `always_invoice`. |
| `discounts` | array | No | Coupons/promotion codes to apply. |
| `add_invoice_items` | array | No | Extra invoice items for the first invoice. |
| `application_fee_percent` | float | No | Connect fee percentage. |
| `on_behalf_of` | string | No | Connected account for charges. |
| `transfer_data` | object | No | Transfer destination and amount_percent. |

### Returns

The newly created Subscription object. If the initial charge fails, the subscription is created with status `incomplete`.
