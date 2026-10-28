# 01 · Payment Gateway: Pesapal

Written for: backend and frontend engineers implementing payments.

## 1. Decision

Use **Pesapal** as the single payment gateway. Pesapal's hosted checkout handles card and mobile money payments, so card data never reaches our servers.

Methods to enable at launch, subject to confirmation in Pesapal onboarding (see section 10):

- Cards (Visa, Mastercard)
- MTN MoMo (Rwanda)
- Airtel Money (Rwanda)

Remove:

- The direct MTN MoMo and Airtel Money clients in `careconect-bn/src/services/payment.service.ts`
- The Taag redirect in `careconect-frontend/src/lib/api/taag.ts`. Taag has closed its operations.

Fallback: Flutterwave, if Pesapal cannot enable RWF payments or the Rwanda mobile money networks for our account.

## 2. Current state (what we are replacing)

| Piece | Location | Problem |
|---|---|---|
| MTN and Airtel clients | `careconect-bn/src/services/payment.service.ts` | Confirm marks any invoice paid for any successful reference (no invoice binding, no amount check) |
| Webhooks | `careconect-bn/src/controllers/payment.controller.ts` | No verification, and nothing updates invoices |
| Invoice manual pay | `careconect-bn/src/routes/invoice.router.ts` | Any logged-in user can mark any invoice paid |
| Taag redirect | `careconect-frontend/src/lib/api/taag.ts`, invoices page | Provider closed; checkout is broken; payment not recorded on the backend |
| Unused hook | `careconect-frontend/src/hooks/usePayments.ts` | Calls the MoMo endpoint, which the invoice page does not use |

## 3. Target architecture

```
Patient UI ──POST /payments/initiate──▶ Backend
     │                                     │  1. get Pesapal token
     │                                     │  2. insert payment_transactions (PENDING)
     │                                     │  3. SubmitOrderRequest (id = tx_ref, amount from invoice)
     │◀──────── redirect_url ──────────────┘
     │
     └─ pays on Pesapal hosted page (card / MoMo / Airtel)
                                           │
Pesapal ──IPN (OrderTrackingId)──▶ Backend /payments/webhook/pesapal
                                           │  1. call GetTransactionStatus (never trust the IPN body)
                                           │  2. find transaction by merchant_reference (= tx_ref)
                                           │  3. check amount and currency
                                           │  4. mark transaction COMPLETED, mark invoice paid (idempotent)
                                           │  5. reply to Pesapal with JSON receipt
                                           ▼
Patient UI ──redirect back──▶ /patient/invoices/return?OrderTrackingId=…
     └─ GET /payments/status/:txRef (ownership checked) → show result
```

Key rules:

- The **backend creates** the reference (`tx_ref`) and takes the amount from the invoice. The client never supplies the amount.
- The **IPN is a signal, not proof**. On every IPN, the backend calls `GetTransactionStatus` and acts only on that answer.
- Every invoice update goes through a transaction record. An invoice can only be paid by a transaction created for it.
- IPN handling is **idempotent**: a repeated notification must not change state twice.

## 4. Pesapal API flow (v3, JSON)

Base URLs: sandbox `https://cybqa.pesapal.com/pesapalv3/api`, production `https://pay.pesapal.com/v3/api`. Confirm both in the Pesapal developer portal before coding.

| Step | Call | Purpose | Notes |
|---|---|---|---|
| 1 | `POST /Auth/RequestToken` | Get a bearer token from consumer key and secret | Token is short-lived. Cache it and refresh before expiry |
| 2 | `POST /URLSetup/RegisterIPN` | Register our IPN URL and get a `notification_id` | Done once per environment; store the id in config |
| 3 | `POST /Transactions/SubmitOrderRequest` | Create the order and get `redirect_url` and `order_tracking_id` | Sends `id` (our tx_ref), `currency`, `amount`, `description`, `callback_url`, `notification_id`, `billing_address` |
| 4 | `GET /Transactions/GetTransactionStatus?orderTrackingId=…` | Read the authoritative status | Returns `merchant_reference`, `payment_status_description`, `amount`, `currency`, `confirmation_code`, `payment_method` |

Field names above follow Pesapal's v3 documentation as found during planning. Confirm each one against a live sandbox response before relying on it.

Statuses we act on: `COMPLETED` (paid), `FAILED`, `REVERSED`, `INVALID`. `PENDING` is not a status Pesapal sends for completed payments; treat anything other than `COMPLETED` as not paid.

## 5. Data model

New table `payment_transactions` (Drizzle schema in `careconect-bn/src/db/schemas/payment-transactions.ts`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `tx_ref` | text, unique | Our reference, sent to Pesapal as `id` / `merchant_reference` |
| `invoice_id` | uuid, FK → invoices | Required |
| `patient_id` | uuid | Owner check on status reads |
| `provider` | enum (`pesapal`) | Keeps room for a second provider |
| `order_tracking_id` | text, unique, nullable | Pesapal's id, returned by SubmitOrderRequest |
| `confirmation_code` | text, nullable | From GetTransactionStatus |
| `payment_method` | text, nullable | Reported by Pesapal (card, MTN, Airtel) |
| `amount` | numeric(12,2) | Copied from invoice at creation |
| `currency` | text | `RWF` |
| `status` | enum | `pending`, `completed`, `failed`, `reversed`, `invalid` |
| `raw_status` | jsonb, nullable | Last GetTransactionStatus response, PHI-free fields only |
| `created_at`, `updated_at`, `completed_at` | timestamptz | |

Indexes: unique on `tx_ref`; unique on `order_tracking_id`; index on `invoice_id`; index on `status`.

## 6. Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/payments/initiate` | patient (owner of invoice) | Create transaction, return `redirect_url` |
| GET | `/api/v1/payments/status/:txRef` | patient (owner) or admin | Our status; calls GetTransactionStatus if still pending |
| POST | `/api/v1/payments/webhook/pesapal` | public | IPN receiver; re-verifies with GetTransactionStatus |
| PATCH | `/api/v1/invoice/invoices/:id/status` | admin | Manual status (cash) only. Remove patient access |
| POST | `/api/v1/invoice/invoices/:id/pay` | admin or cashier | Manual payment record (cash or insurance) |

Remove: `/payments/webhook/mtn`, `/payments/webhook/airtel`, and `POST /payments/confirm`.

## 7. IPN security

- Pesapal's IPN is not trusted on its own. Call `GetTransactionStatus` with the `OrderTrackingId` from the IPN and act on that response only.
- Find the transaction by `merchant_reference`. If it is unknown, log it and reply with a receipt anyway, so Pesapal stops retrying. Do not change any invoice.
- Reject a completed status whose `amount` or `currency` differs from the stored transaction. Flag it for admin review.
- Return the receipt JSON Pesapal expects (the notification type, tracking id, and merchant reference, with status 200). Return 5xx only for transient failures so Pesapal retries.
- Keep the consumer secret server-side only, in the secret manager.

## 8. Environment variables

Replace the MTN and Airtel variables in `careconect-bn/src/config/env.ts` and `.env.example`:

```
PESAPAL_ENVIRONMENT=sandbox          # sandbox | production
PESAPAL_CONSUMER_KEY=
PESAPAL_CONSUMER_SECRET=
PESAPAL_IPN_URL=https://<api>/api/v1/payments/webhook/pesapal
PESAPAL_IPN_ID=                      # notification_id from RegisterIPN
PESAPAL_CALLBACK_URL=https://<frontend>/patient/invoices/return
PESAPAL_CURRENCY=RWF
```

Remove the `https://your-domain.com` fallbacks. The app must refuse to start in production without these values.

## 9. Frontend changes

- Invoice "Pay Now" calls `POST /payments/initiate`, then redirects the browser to the returned `redirect_url`.
- New page `careconect-frontend/src/app/(ds)/patient/invoices/return/page.tsx` reads `OrderTrackingId` from the URL, calls `GET /payments/status/:txRef`, and polls for up to 60 seconds. It then shows success, failure, or "still processing; we will notify you."
- Remove `NEXT_PUBLIC_TAAG_PLAN_ID` and `taag.ts`.
- Fix `usePayments.ts` so `useInitiatePayment` returns the redirect URL.

## 10. Launch gates (confirm with Pesapal before go-live)

- [ ] Merchant account active for Rwanda, and RWF enabled as settlement currency
- [ ] Each method enabled on our account: cards, MTN MoMo, Airtel Money. This was not confirmed in planning.
- [ ] Amount format accepted for RWF (whole francs or decimals)
- [ ] Settlement account and payout schedule confirmed
- [ ] Pesapal's security and compliance documentation on file (PCI DSS status for hosted checkout)
- [ ] Sandbox test passed for each method

If any of the first three fails, switch to the Flutterwave fallback.

## 11. Testing

- Unit: token refresh, IPN with an unknown reference, IPN replay (idempotency), amount mismatch, ownership checks on status reads.
- Sandbox integration: card success, card failure, MoMo success, Airtel success, cancelled checkout.
- Negative: initiate on a paid invoice, initiate on another patient's invoice, IPN with a forged tracking id.

## 12. Go-live checklist

- [ ] Production consumer key and secret in the secret manager
- [ ] IPN URL registered in production; `PESAPAL_IPN_ID` set
- [ ] Callback URL set to the production return page
- [ ] Refund process written (out of scope for launch; manual through the Pesapal dashboard)
- [ ] Reconciliation report planned (task PAY-07 in [04-task-backlog.md](04-task-backlog.md))
