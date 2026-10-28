# 02 · Email: Resend

Written for: backend engineers and whoever manages the sending domain's DNS.

## 1. Decision

Use **Resend** for all transactional email:

- Email verification
- Password reset
- Appointment confirmation
- Payment receipts

Fallback: Amazon SES, if Resend cannot sign the agreement our compliance review requires.

Amazon SES was the earlier choice and is dropped for the two-week launch. Resend has a simpler setup and faster onboarding, which matters for the deadline.

## 2. Current state

- `careconect-bn/src/services/auth.service.ts` (around line 271): password reset builds a token but does not send email. `// TODO: Implement email sending`.
- No email module exists. `misc.service.ts` has a notify stub.
- No email verification endpoints (see `IMPLEMENTATION_STATUS.md`, Auth section, rows marked ❌).

## 3. Design

```
Service (auth, appointment, invoice, payment)
    │  emailService.send({ template, to, data, idempotencyKey })
    ▼
src/services/email.service.ts ──▶ Resend API (official Node SDK)
    │
    └── Resend webhook (bounces, complaints) ──▶ POST /api/v1/misc/email/events
                                                  (signature verified) ──▶ suppress address
```

Module layout:

```
src/services/email.service.ts                 send(), rendering, retry
src/email/templates/*.html                    one file per template, plain-text version alongside
src/email/templates/index.ts                  registry: name → { subject, html, text, requiredFields }
src/controllers/email-events.controller.ts    webhook handler (signature check)
```

Rules:

- Services never call the Resend SDK directly. They call `emailService.send`.
- Every template declares its required fields. Missing fields throw before sending.
- **No health details in email.** Doctor name and appointment time are allowed. Diagnoses, medications, and lab results are not. Emails say "log in to see your details" and link to the app.
- Reset links expire in 30 minutes and are single-use. Verification links expire in 24 hours.
- Each send carries an idempotency key (for example, the payment reference), so a retry cannot send the same receipt twice.
- Sends retry with backoff (3 attempts). A provider error must not fail the user's request; log it and queue the retry.

## 4. Domain setup

Owned by the person who controls the CareConnect domain:

| Record | Purpose |
|---|---|
| DKIM TXT record(s) shown by Resend | Signing |
| SPF TXT record that includes Resend's sending host, merged into any existing SPF record | Authorization |
| DMARC `_dmarc` TXT, start with `p=none; rua=mailto:<reports address>` | Reporting. Tighten to `quarantine` after clean reports |

Steps:

1. Add the sending domain in Resend and create the records above.
2. Wait for Resend to show the domain as verified.
3. Register the webhook endpoint for bounce and complaint events and store its signing secret.

## 5. Templates for launch

| Template | Trigger | Priority |
|---|---|---|
| `password-reset` | Forgot password | Launch |
| `email-verify` | Registration | Launch |
| `appointment-confirmed` | Booking | Launch |
| `payment-receipt` | Successful payment | Launch |
| `consultation-link` | Video room ready (see [03-video.md](03-video.md)) | Launch, if video ships |
| `appointment-reminder` | 24 h and 1 h before | After launch |
| `invoice-issued` | Invoice created | After launch |

## 6. Configuration

```
RESEND_API_KEY=                    # backend only, server secret
RESEND_FROM_ADDRESS="CareConnect <no-reply@<domain>>"
RESEND_REPLY_TO=support@<domain>
RESEND_WEBHOOK_SECRET=             # verifies webhook signatures
```

Keys live in the secret manager, not in `.env` on shared machines. `.env.example` lists the names only.

## 7. Testing

- Unit: template rendering, missing-field rejection, a test that fails if a template contains a forbidden field (diagnosis, medication, lab result).
- Integration: send to Resend's test address (`delivered@resend.dev`), and check the bounce path with `bounced@resend.dev`.
- Confirm a bounce event suppresses the address and later sends to it are blocked.

## 8. Go-live checklist

- [ ] Domain verified in Resend; DKIM and SPF passing
- [ ] DMARC record live
- [ ] Production API key in the secret manager
- [ ] Webhook signature verification working
- [ ] Resend's data-processing terms reviewed by the owner. Our design keeps health details out of email, so a BAA may not be required for email content. Compliance must confirm this.
