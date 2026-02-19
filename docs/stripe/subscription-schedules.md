# Stripe API — Subscription Schedules

> Source: https://docs.stripe.com/api/subscription_schedules

A subscription schedule allows you to create and manage the lifecycle of a subscription by predefining expected changes.

Related guide: [Subscription schedules](https://docs.stripe.com/docs/billing/subscriptions/subscription-schedules)

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/subscription_schedules` | [Create a schedule](https://docs.stripe.com/api/subscription_schedules/create) |
| POST | `/v1/subscription_schedules/:id` | [Update a schedule](https://docs.stripe.com/api/subscription_schedules/update) |
| GET | `/v1/subscription_schedules/:id` | [Retrieve a schedule](https://docs.stripe.com/api/subscription_schedules/retrieve) |
| GET | `/v1/subscription_schedules` | [List all schedules](https://docs.stripe.com/api/subscription_schedules/list) |
| POST | `/v1/subscription_schedules/:id/cancel` | [Cancel a schedule](https://docs.stripe.com/api/subscription_schedules/cancel) |
| POST | `/v1/subscription_schedules/:id/release` | [Release a schedule](https://docs.stripe.com/api/subscription_schedules/release) |

---

## The Subscription Schedule Object

### Core Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string | Unique identifier. |
| `object` | string | `"subscription_schedule"` |
| `status` | enum | `not_started`, `active`, `completed`, `released`, or `canceled`. |
| `customer` | string | Customer ID who owns the schedule. |
| `subscription` | string, nullable | ID of the managed subscription. |
| `created` | timestamp | Time created. |
| `livemode` | boolean | Live or test mode. |
| `metadata` | object, nullable | Key-value pairs. |

### Lifecycle

| Attribute | Type | Description |
|-----------|------|-------------|
| `end_behavior` | enum | `release` (keep subscription running) or `cancel` (cancel subscription). |
| `current_phase` | object, nullable | Current phase start_date and end_date (if `active`). |
| `canceled_at` | timestamp, nullable | When canceled. |
| `completed_at` | timestamp, nullable | When completed. |
| `released_at` | timestamp, nullable | When released. |
| `released_subscription` | string, nullable | Subscription ID after release. |

### Default Settings

`default_settings` — applied to all phases unless overridden:

| Attribute | Type | Description |
|-----------|------|-------------|
| `application_fee_percent` | float, nullable | Connect fee percentage. |
| `automatic_tax` | object | enabled, liability. |
| `billing_cycle_anchor` | enum | `phase_start` or `automatic`. |
| `billing_thresholds` | object, nullable | amount_gte, reset_billing_cycle_anchor. |
| `collection_method` | enum, nullable | `charge_automatically` or `send_invoice`. |
| `default_payment_method` | string, nullable | PaymentMethod ID. |
| `description` | string, nullable | Displayable description. |
| `invoice_settings` | object | account_tax_ids, days_until_due, issuer. |
| `on_behalf_of` | string, nullable | Connected account. |
| `transfer_data` | object, nullable | Transfer destination. |

### Phases

`phases` — array of phase objects:

| Attribute | Type | Description |
|-----------|------|-------------|
| `start_date` | timestamp | Start of this phase. |
| `end_date` | timestamp | End of this phase. |
| `items` | array | Subscription items (price, quantity, tax_rates, metadata, discounts, billing_thresholds). |
| `currency` | enum | ISO currency code. |
| `description` | string, nullable | Phase description. |
| `collection_method` | enum, nullable | `charge_automatically` or `send_invoice`. |
| `default_payment_method` | string, nullable | PaymentMethod ID. |
| `default_tax_rates` | array, nullable | Tax rates for the phase. |
| `automatic_tax` | object, nullable | enabled, liability. |
| `billing_cycle_anchor` | enum, nullable | `phase_start` or `automatic`. |
| `billing_thresholds` | object, nullable | amount_gte, reset_billing_cycle_anchor. |
| `proration_behavior` | enum | `create_prorations`, `none`, or `always_invoice`. |
| `trial_end` | timestamp, nullable | When the trial ends within the phase. |
| `discounts` | array | Coupons/discounts for the phase. |
| `add_invoice_items` | array | Extra invoice items. |
| `invoice_settings` | object, nullable | account_tax_ids, days_until_due, issuer. |
| `metadata` | object, nullable | Key-value pairs. |
| `on_behalf_of` | string, nullable | Connected account. |
| `transfer_data` | object, nullable | Transfer destination. |
| `application_fee_percent` | float, nullable | Connect fee. |

---

## Create a Schedule

`POST /v1/subscription_schedules`

Each customer can have up to 500 active or scheduled subscriptions.

### Key Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer` | string | No* | Customer ID. |
| `start_date` | timestamp/string | No | When the schedule starts. Use `"now"` for immediate start, or a Unix timestamp (past for backdating, future for delayed start). |
| `end_behavior` | enum | No | `release` (default) or `cancel`. |
| `from_subscription` | string | No | Migrate an existing subscription to a schedule. |
| `metadata` | object | No | Key-value pairs. |
| `billing_mode` | object | No | `classic` or `flexible` (default). |
| `default_settings` | object | No | Default settings for all phases. |
| `phases` | array | No | Phase definitions (see below). |

### Phase Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `phases[].items` | array | **Yes** | List of items (price, quantity, price_data, tax_rates, discounts, metadata, billing_thresholds). |
| `phases[].end_date` | timestamp | No* | End of the phase. Mutually exclusive with `duration`. |
| `phases[].duration` | object | No* | Duration (interval: day/week/month/year, interval_count). Mutually exclusive with `end_date`. |
| `phases[].currency` | enum | No | ISO currency code. |
| `phases[].description` | string | No | Displayable description (max 500 chars). |
| `phases[].collection_method` | enum | No | `charge_automatically` or `send_invoice`. |
| `phases[].default_payment_method` | string | No | PaymentMethod ID. |
| `phases[].default_tax_rates` | array | No | Tax Rate IDs. |
| `phases[].automatic_tax` | object | No | enabled (required), liability. |
| `phases[].billing_cycle_anchor` | enum | No | `phase_start` or `automatic`. |
| `phases[].proration_behavior` | enum | No | `create_prorations`, `none`, or `always_invoice`. |
| `phases[].trial_end` | timestamp | No | Trial end date (must be before phase end). |
| `phases[].trial` | boolean | No | If true, entire phase is a trial. |
| `phases[].discounts` | array | No | Coupons/promotion codes. |
| `phases[].add_invoice_items` | array | No | Extra invoice items. |
| `phases[].invoice_settings` | object | No | account_tax_ids, days_until_due, issuer. |
| `phases[].metadata` | object | No | Key-value pairs. |
| `phases[].on_behalf_of` | string | No | Connected account. |
| `phases[].transfer_data` | object | No | Transfer destination. |

### Example

```bash
curl https://api.stripe.com/v1/subscription_schedules \
  -u "sk_test_..." \
  -d customer=cus_NcI8FsMbh0OeFs \
  -d start_date=1787130418 \
  -d end_behavior=release \
  -d "phases[0][items][0][price]"=price_1Mr3YcLkdIwHu7ixYCFhXHNb \
  -d "phases[0][items][0][quantity]"=1 \
  -d "phases[0][duration][interval]"=month \
  -d "phases[0][duration][interval_count]"=1
```

### Example Response

```json
{
  "id": "sub_sched_1Mr3YdLkdIwHu7ixjop3qtff",
  "object": "subscription_schedule",
  "application": null,
  "canceled_at": null,
  "completed_at": null,
  "created": 1724058651,
  "current_phase": null,
  "customer": "cus_NcI8FsMbh0OeFs",
  "default_settings": {
    "application_fee_percent": null,
    "automatic_tax": { "enabled": false, "liability": null },
    "billing_cycle_anchor": "automatic",
    "collection_method": "charge_automatically",
    "default_payment_method": null,
    "description": null,
    "invoice_settings": { "issuer": { "type": "self" } },
    "on_behalf_of": null,
    "transfer_data": null
  },
  "end_behavior": "release",
  "livemode": false,
  "metadata": {},
  "phases": [
    {
      "add_invoice_items": [],
      "billing_cycle_anchor": null,
      "collection_method": null,
      "currency": "usd",
      "default_payment_method": null,
      "default_tax_rates": [],
      "description": null,
      "discounts": null,
      "end_date": 1818666418,
      "items": [
        {
          "price": "price_1Mr3YcLkdIwHu7ixYCFhXHNb",
          "quantity": 1,
          "tax_rates": []
        }
      ],
      "metadata": {},
      "proration_behavior": "create_prorations",
      "start_date": 1787130418,
      "trial_end": null
    }
  ],
  "status": "not_started",
  "subscription": null
}
```

---

## Key Concepts

### Phase Transitions
- If there are multiple phases, the `end_date` of one phase always equals the `start_date` of the next.
- `proration_behavior` controls how prorations are handled when transitioning between phases.

### Billing Cycle Anchor
- `billing_cycle_anchor` on phases is an **enum** (`phase_start` or `automatic`), NOT a timestamp.
- `phase_start`: billing cycle anchor resets to the start of the phase.
- `automatic`: Stripe automatically adjusts as needed.

### Trials
- `trial_end`: Sets a specific trial end timestamp within the phase (must be before phase end_date).
- `trial`: If `true`, the entire phase is counted as a trial.

### End Behavior
- `release`: Keeps the underlying subscription running when the schedule ends.
- `cancel`: Cancels the underlying subscription when the schedule ends.
