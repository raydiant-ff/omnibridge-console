# Stripe API — Customers

> Source: https://docs.stripe.com/api/customers

This object represents a customer of your business. Use it to [create recurring charges](https://docs.stripe.com/docs/invoicing/customer), [save payment](https://docs.stripe.com/docs/payments/save-during-payment) and contact information, and track payments that belong to the same customer.

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/customers` | [Create a customer](https://docs.stripe.com/api/customers/create) |
| POST | `/v1/customers/:id` | [Update a customer](https://docs.stripe.com/api/customers/update) |
| GET | `/v1/customers/:id` | [Retrieve a customer](https://docs.stripe.com/api/customers/retrieve) |
| GET | `/v1/customers` | [List all customers](https://docs.stripe.com/api/customers/list) |
| DELETE | `/v1/customers/:id` | [Delete a customer](https://docs.stripe.com/api/customers/delete) |
| GET | `/v1/customers/search` | [Search customers](https://docs.stripe.com/api/customers/search) |

---

## The Customer Object

### Core Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string | Unique identifier for the object. |
| `object` | string | String representing the object's type (`customer`). |
| `name` | string, nullable | The customer's full name or business name. |
| `email` | string, nullable | The customer's email address. |
| `phone` | string, nullable | The customer's phone number. |
| `description` | string, nullable | An arbitrary string attached to the object. |
| `individual_name` | string, nullable | The customer's individual name (max 150 chars). |
| `business_name` | string, nullable | The customer's business name (max 150 chars). |
| `created` | timestamp | Time at which the object was created (Unix epoch). |
| `livemode` | boolean | `true` if live mode, `false` if test mode. |
| `metadata` | object | Key-value pairs for storing additional info. |

### Billing & Payment

| Attribute | Type | Description |
|-----------|------|-------------|
| `balance` | integer | Current balance in default currency (cents). Negative = credit, positive = amount owed. |
| `currency` | string, nullable | Three-letter ISO currency code. |
| `default_source` | string, nullable | ID of the default payment source. |
| `delinquent` | boolean, nullable | Whether the customer has an overdue invoice. |
| `invoice_prefix` | string, nullable | Prefix used to generate unique invoice numbers. |
| `next_invoice_sequence` | integer, nullable | Suffix of the customer's next invoice number. |
| `invoice_credit_balance` | object | Multi-currency balances stored on the customer. |
| `invoice_settings` | object | Default invoice settings (custom_fields, default_payment_method, footer, rendering_options). |
| `tax_exempt` | enum | `none`, `exempt`, or `reverse`. |
| `tax` | object | Tax details (automatic_tax, ip_address, location, provider). |

### Address & Shipping

| Attribute | Type | Description |
|-----------|------|-------------|
| `address` | object, nullable | Customer's address (city, country, line1, line2, postal_code, state). |
| `shipping` | object, nullable | Shipping info (address, name, phone). |
| `preferred_locales` | array of strings | Preferred languages, ordered by preference. |

### Related Objects

| Attribute | Type | Description |
|-----------|------|-------------|
| `subscriptions` | object, nullable | Current subscriptions (list). |
| `sources` | object, nullable | Payment sources (list). |
| `tax_ids` | object, nullable | Customer's tax IDs (list). |
| `cash_balance` | object, nullable | Cash balance held by Stripe. |
| `discount` | object, nullable | Current active discount. |
| `customer_account` | string, nullable | ID of an Account representing the customer. |
| `test_clock` | string, nullable | ID of the test clock this customer belongs to. |

### Example Object

```json
{
  "id": "cus_NffrFeUfNV2Hib",
  "object": "customer",
  "address": null,
  "balance": 0,
  "created": 1680893993,
  "currency": null,
  "default_source": null,
  "delinquent": false,
  "description": null,
  "email": "jennyrosen@example.com",
  "invoice_prefix": "0759376C",
  "invoice_settings": {
    "custom_fields": null,
    "default_payment_method": null,
    "footer": null,
    "rendering_options": null
  },
  "livemode": false,
  "metadata": {},
  "name": "Jenny Rosen",
  "next_invoice_sequence": 1,
  "phone": null,
  "preferred_locales": [],
  "shipping": null,
  "tax_exempt": "none",
  "test_clock": null
}
```

---

## Create a Customer

`POST /v1/customers`

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | No | Full name or business name. |
| `email` | string | No | Email address (max 512 chars). |
| `phone` | string | No | Phone number (max 20 chars). |
| `description` | string | No | Arbitrary description string. |
| `individual_name` | string | No | Customer's individual name (max 150 chars). |
| `business_name` | string | No | Customer's business name (max 150 chars). |
| `address` | object | If calculating taxes | Customer's address. |
| `shipping` | object | No | Shipping information. |
| `balance` | integer | No | Initial balance in cents. |
| `metadata` | object | No | Key-value pairs. |
| `payment_method` | string | No | PaymentMethod ID to attach. |
| `source` | string | No | Token or Source ID for default source. |
| `invoice_prefix` | string | No | 3–12 uppercase letters/numbers. |
| `invoice_settings` | object | No | Default invoice settings. |
| `preferred_locales` | array | No | Preferred languages. |
| `tax_exempt` | enum | No | `none`, `exempt`, or `reverse`. |
| `tax` | object | Recommended if calculating taxes | Tax details (ip_address, validate_location). |
| `tax_id_data` | array | No | Tax IDs to create (type + value). |
| `cash_balance` | object | No | Cash balance settings. |
| `test_clock` | string | No | Test clock ID. |
| `next_invoice_sequence` | integer | No | Defaults to 1. |

### Example

```bash
curl https://api.stripe.com/v1/customers \
  -u "sk_test_..." \
  -d name="Jenny Rosen" \
  --data-urlencode email="jennyrosen@example.com"
```

### Returns

The Customer object after successful creation.
