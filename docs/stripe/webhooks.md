# Stripe API — Webhook Endpoints

> Source: https://docs.stripe.com/api/webhook_endpoints

You can configure [webhook endpoints](https://docs.stripe.com/webhooks/) via the API to be notified about events that happen in your Stripe account or connected accounts.

Most users configure webhooks from [the dashboard](https://dashboard.stripe.com/webhooks), which provides a user interface for registering and testing your webhook endpoints.

Related guide: [Setting up webhooks](https://docs.stripe.com/webhooks/configure)

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/webhook_endpoints` | [Create a webhook endpoint](https://docs.stripe.com/api/webhook_endpoints/create) |
| POST | `/v1/webhook_endpoints/:id` | [Update a webhook endpoint](https://docs.stripe.com/api/webhook_endpoints/update) |
| GET | `/v1/webhook_endpoints/:id` | [Retrieve a webhook endpoint](https://docs.stripe.com/api/webhook_endpoints/retrieve) |
| GET | `/v1/webhook_endpoints` | [List all webhook endpoints](https://docs.stripe.com/api/webhook_endpoints/list) |
| DELETE | `/v1/webhook_endpoints/:id` | [Delete a webhook endpoint](https://docs.stripe.com/api/webhook_endpoints/delete) |

---

## The Webhook Endpoint Object

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string | Unique identifier. |
| `object` | string | `"webhook_endpoint"` |
| `url` | string | The URL of the webhook endpoint. |
| `enabled_events` | array of strings | List of events the endpoint is subscribed to. |
| `status` | string | `enabled` or `disabled`. |
| `secret` | string | Signing secret (only returned on creation). |
| `api_version` | string, nullable | Stripe API version used for events. |
| `application` | string, nullable | Connect Application ID. |
| `description` | string, nullable | Description of the webhook. |
| `livemode` | boolean | Live or test mode. |
| `metadata` | object | Key-value pairs. |
| `created` | timestamp | Time created. |

### Example Object

```json
{
  "id": "we_1Mr5jULkdIwHu7ix1ibLTM0x",
  "object": "webhook_endpoint",
  "api_version": null,
  "application": null,
  "created": 1680122196,
  "description": null,
  "enabled_events": ["charge.succeeded", "charge.failed"],
  "livemode": false,
  "metadata": {},
  "secret": "whsec_wRNftLajMZNeslQOP6vEPm4iVx5NlZ6z",
  "status": "enabled",
  "url": "https://example.com/my/webhook/endpoint"
}
```

---

## Create a Webhook Endpoint

`POST /v1/webhook_endpoints`

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | **Yes** | The URL of the webhook endpoint. |
| `enabled_events` | array | **Yes** | Events to enable. Use `['*']` for all events (except those requiring explicit selection). |
| `connect` | boolean | No | `true` for connected-account events, `false` (default) for your account only. |
| `api_version` | string | No | Stripe Version to use for events. |
| `description` | string | No | Description of the webhook. |
| `metadata` | object | No | Key-value pairs. |

### Example

```bash
curl https://api.stripe.com/v1/webhook_endpoints \
  -u "sk_test_..." \
  -d "enabled_events[]"="charge.succeeded" \
  -d "enabled_events[]"="charge.failed" \
  --data-urlencode url="https://example.com/my/webhook/endpoint"
```

---

## Common Webhook Events

### Billing & Subscriptions

| Event | Description |
|-------|-------------|
| `customer.subscription.created` | Customer signed up for a new plan. |
| `customer.subscription.updated` | Subscription changed (plan switch, status change, etc.). |
| `customer.subscription.deleted` | Subscription ended. |
| `customer.subscription.trial_will_end` | Trial ending in 3 days. |
| `customer.subscription.paused` | Subscription paused. |
| `customer.subscription.resumed` | Subscription resumed. |

### Invoices

| Event | Description |
|-------|-------------|
| `invoice.created` | New invoice created. |
| `invoice.finalized` | Draft invoice finalized to open. |
| `invoice.paid` | Invoice paid (or marked paid out-of-band). |
| `invoice.payment_succeeded` | Invoice payment attempt succeeded. |
| `invoice.payment_failed` | Invoice payment attempt failed. |
| `invoice.upcoming` | Invoice coming soon (configurable days before). |
| `invoice.voided` | Invoice voided. |
| `invoice.sent` | Invoice email sent. |
| `invoice.overdue` | Invoice overdue (configurable days after). |
| `invoice.marked_uncollectible` | Invoice marked uncollectible. |

### Subscription Schedules

| Event | Description |
|-------|-------------|
| `subscription_schedule.created` | Schedule created. |
| `subscription_schedule.updated` | Schedule updated. |
| `subscription_schedule.completed` | Schedule completed. |
| `subscription_schedule.released` | Schedule released. |
| `subscription_schedule.canceled` | Schedule canceled. |
| `subscription_schedule.expiring` | Schedule expiring in 7 days. |
| `subscription_schedule.aborted` | Schedule aborted due to delinquent subscription. |

### Payments

| Event | Description |
|-------|-------------|
| `payment_intent.created` | PaymentIntent created. |
| `payment_intent.succeeded` | Payment completed. |
| `payment_intent.payment_failed` | Payment failed. |
| `payment_intent.canceled` | PaymentIntent canceled. |
| `payment_intent.requires_action` | Requires customer action (3DS, etc.). |
| `charge.succeeded` | Charge successful. |
| `charge.failed` | Charge failed. |
| `charge.refunded` | Charge refunded. |
| `charge.captured` | Uncaptured charge captured. |
| `charge.dispute.created` | Customer disputed a charge. |
| `charge.dispute.closed` | Dispute resolved. |

### Customers

| Event | Description |
|-------|-------------|
| `customer.created` | Customer created. |
| `customer.updated` | Customer property changed. |
| `customer.deleted` | Customer deleted. |
| `customer.source.created` | Source added to customer. |
| `customer.source.deleted` | Source removed from customer. |

### Products & Prices

| Event | Description |
|-------|-------------|
| `product.created` | Product created. |
| `product.updated` | Product updated. |
| `product.deleted` | Product deleted. |
| `price.created` | Price created. |
| `price.updated` | Price updated. |
| `price.deleted` | Price deleted. |

### Credit Notes

| Event | Description |
|-------|-------------|
| `credit_note.created` | Credit note created. |
| `credit_note.updated` | Credit note updated. |
| `credit_note.voided` | Credit note voided. |

### Other

| Event | Description |
|-------|-------------|
| `payment_method.attached` | PaymentMethod attached to customer. |
| `payment_method.detached` | PaymentMethod detached. |
| `payment_method.updated` | PaymentMethod updated. |
| `refund.created` | Refund created. |
| `refund.updated` | Refund updated. |
| `refund.failed` | Refund failed. |
| `payout.created` | Payout created. |
| `payout.paid` | Payout expected in destination. |
| `payout.failed` | Payout failed. |

> For a complete list of all events, see the [Stripe Events documentation](https://docs.stripe.com/api/events/types).
