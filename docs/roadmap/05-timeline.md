# 05 · Timeline (Two-Week Launch Plan)

Written for: the project owner and the engineering team.

Start: Monday 2 November 2026. Two-week target: Friday 13 November 2026.

Supersedes the 13-week plan. The change is driven by three facts:

- Taag has closed its operations, so the current invoice checkout is broken and must be replaced now.
- Email moves from Amazon SES to Resend, which onboards faster.
- The owner has set a two-week deadline.

## What the two weeks must deliver

| Item | Must be done by 13 Nov | Notes |
|---|---|---|
| Taag removed; invoice payment works through Pesapal in test mode | Yes | Live once Pesapal enables RWF and the Rwanda methods, and approves production keys |
| Payment records and webhook: no invoice marked paid without a matching payment | Yes | Fixes the current security gap |
| Email via Resend: password reset, email verification, booking confirmation, receipt | Yes | Domain DNS must be changed in week 1 |
| Authorization fixes: only admin or cashier can mark invoices paid; patients see only their own invoices | Yes | Small, high priority |
| Secrets and logging: app refuses to start without production keys; no payment data in logs | Yes | |
| Video consultations (room, join rules, consultation page) | Partly | See the scope decision below |

## Capacity check

The full two-week list is about 37 engineer-days of work (see [04-task-backlog.md](04-task-backlog.md), "Two-week scope"). Three engineers working two weeks at about 75% productive time give roughly 22 engineer-days. The list does not fit in two weeks with the current team.

Two options:

1. **Keep the two-week date for payments, email, Taag removal, and security.** Move video to a second two-week sprint (16 to 27 November). This is the recommended option.
2. **Keep video in the two-week date too.** This needs about two more engineers for both weeks, or it needs a smaller video scope (for example, a link to an external video call instead of an embedded room).

## Week-by-week

| Week | Dates | Work | Exit criteria |
|---|---|---|---|
| Week 1 | 2 to 6 Nov | Remove Taag from the invoice page and env. Pesapal adapter (token, IPN registration, order submission) and `payment_transactions` table. IPN handler that re-verifies each notification. Authorization fixes (SEC-01, SEC-02, SEC-03, FEAT-03). Resend module and DNS records. Secrets and logging (OPS-01, OPS-02). Request Pesapal production approval and confirm RWF and Rwanda methods | Taag gone. Test payment succeeds end-to-end in sandbox. Authorization tests pass. Resend domain verification started |
| Week 2 | 9 to 13 Nov | Return page and status polling (PAY-05). Payment tests (PAY-06). Resend templates: reset, verification, confirmation, receipt (EML-02 to EML-05). Rate limits on login and payment endpoints (SEC-04). Smoke test of all three flows on staging | Test payments and test emails work on staging. Domain verified. Production keys requested |
| Sprint 2 (recommended) | 16 to 27 Nov | Video: room service, join endpoint, consultation page, tests (VID-02 to VID-06) | Two-party video call works on staging |
| Go-live | After compliance gates | Production keys activated. Pilot clinic trial | See gate below |

## Critical path

1. **Pesapal production approval, RWF enablement, and the Rwanda mobile money methods.** Requested in week 1. If any is not confirmed by the go-live date, invoices stay in test mode and patients cannot pay online. Fallback: Flutterwave.
2. **Resend domain verification.** Needs DNS changes by the domain owner in week 1. If DNS is delayed, emails cannot be sent to real addresses.
3. **Video relay (coturn) on a public address.** Needed before video reaches patients (Sprint 2). No vendor agreement is needed.

## Go-live gate

- [ ] Taag references removed from code and env
- [ ] Pesapal production approval; RWF, MTN MoMo, Airtel Money, and cards enabled and tested; production keys in the secret manager
- [ ] Resend domain verified; DMARC record live
- [ ] Resend data terms reviewed by the owner
- [ ] Authorization and payment security tests pass
- [ ] Video: coturn public address set; two-network call tested (only if video is in scope for the pilot)
- [ ] Pilot clinic trial signed off by the owner

## Assumptions

- Team: 3 engineers (2 backend, 1 frontend), plus the owner for vendor sign-ups and DNS.
- Productive time about 75% of working days.
- Deferred to after the pilot: doctor statistics, patient and doctor endpoints, user profile endpoints, admin settings, reminders, reconciliation, CI, and the frontend cleanup. See [04-task-backlog.md](04-task-backlog.md).
