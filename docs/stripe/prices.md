# Stripe API — Prices

> Source: https://docs.stripe.com/api/prices

Prices define the unit cost, currency, and (optional) billing cycle for both recurring and one-time purchases of products. [Products](https://docs.stripe.com/api/products) help you track inventory or provisioning, and prices help you track payment terms. Different physical goods or levels of service should be represented by products, and pricing options should be represented by prices.

For example, you might have a single "gold" product that has prices for $10/month, $100/year, and €9 once.

Related guides: [Set up a subscription](https://docs.stripe.com/docs/billing/subscriptions/set-up-subscription), [create an invoice](https://docs.stripe.com/docs/billing/invoices/create), [products and prices](https://docs.stripe.com/docs/products-prices/overview).

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/prices` | [Create a price](https://docs.stripe.com/api/prices/create) |
| POST | `/v1/prices/:id` | [Update a price](https://docs.stripe.com/api/prices/update) |
| GET | `/v1/prices/:id` | [Retrieve a price](https://docs.stripe.com/api/prices/retrieve) |
| GET | `/v1/prices` | [List all prices](https://docs.stripe.com/api/prices/list) |
| GET | `/v1/prices/search` | [Search prices](https://docs.stripe.com/api/prices/search) |

---

## The Price Object

### Core Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string | Unique identifier for the object. |
| `object` | string | `"price"` |
| `active` | boolean | Whether the price can be used for new purchases. |
| `currency` | enum | Three-letter ISO currency code, lowercase. |
| `created` | timestamp | Unix epoch time of creation. |
| `livemode` | boolean | `true` for live mode. |
| `metadata` | object | Key-value pairs. |
| `nickname` | string, nullable | Brief description, hidden from customers. |
| `product` | string | ID of the associated product. |
| `type` | enum | `one_time` or `recurring`. |
| `lookup_key` | string, nullable | Key for dynamic price retrieval (max 200 chars). |

### Pricing

| Attribute | Type | Description |
|-----------|------|-------------|
| `billing_scheme` | enum | `per_unit` or `tiered`. |
| `unit_amount` | integer, nullable | Amount in cents (whole integer). Only for `per_unit`. |
| `unit_amount_decimal` | decimal string, nullable | Amount in cents (up to 12 decimal places). Only for `per_unit`. |
| `custom_unit_amount` | object, nullable | Config for customer-adjustable amounts (maximum, minimum, preset). |
| `currency_options` | object, nullable | Prices in each available currency. |
| `tax_behavior` | enum, nullable | `exclusive`, `inclusive`, or `unspecified`. |

### Recurring

| Attribute | Type | Description |
|-----------|------|-------------|
| `recurring` | object, nullable | Recurring components of the price. |
| `recurring.interval` | enum | `day`, `week`, `month`, or `year`. |
| `recurring.interval_count` | integer | Number of intervals between billings. |
| `recurring.usage_type` | enum | `metered` or `licensed` (default). |
| `recurring.meter` | string, nullable | Meter tracking usage of a metered price. |

### Tiered Pricing

| Attribute | Type | Description |
|-----------|------|-------------|
| `tiers_mode` | enum, nullable | `graduated` or `volume`. |
| `tiers` | array, nullable | Pricing tiers (flat_amount, unit_amount, up_to). |
| `transform_quantity` | object, nullable | Transformation applied before billing (divide_by, round). |

### Example Object

```json
{
  "id": "price_1MoBy5LkdIwHu7ixZhnattbh",
  "object": "price",
  "active": true,
  "billing_scheme": "per_unit",
  "created": 1679431181,
  "currency": "usd",
  "custom_unit_amount": null,
  "livemode": false,
  "lookup_key": null,
  "metadata": {},
  "nickname": null,
  "product": "prod_NZKdYqrwEYx6iK",
  "recurring": {
    "interval": "month",
    "interval_count": 1,
    "trial_period_days": null,
    "usage_type": "licensed"
  },
  "tax_behavior": "unspecified",
  "tiers_mode": null,
  "transform_quantity": null,
  "type": "recurring",
  "unit_amount": 1000,
  "unit_amount_decimal": "1000"
}
```
