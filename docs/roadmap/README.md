# CareConnect Roadmap: Index and Decisions

Written for: the CareConnect engineering team and the project owner.

This folder holds the plan for the remaining work: the chosen third-party providers, the full task list, and the timeline.

| Document | Contents |
|---|---|
| [01-payment-gateway.md](01-payment-gateway.md) | Payment gateway choice (Pesapal) and integration design |
| [02-email.md](02-email.md) | Email provider choice (Resend) and sending design |
| [03-video.md](03-video.md) | Internal video calls (WebRTC, Socket.IO signalling, coturn relay) |
| [04-task-backlog.md](04-task-backlog.md) | Every remaining task, with IDs, priority, and estimates |
| [05-timeline.md](05-timeline.md) | Two-week launch plan (2 to 13 November 2026), then video sprint |

## Decisions

| Area | Chosen provider | Alternative kept as fallback | Status |
|---|---|---|---|
| Payments (cards, MTN MoMo, Airtel Money) | Pesapal | Flutterwave | Chosen. Rwanda mobile money and RWF enablement to confirm with Pesapal |
| Transactional email | Resend | Amazon SES | Chosen. Domain verification pending |
| Video consultations | Internal build (WebRTC, self-hosted coturn) | None (no external video API) | Built. Needs two-network test and coturn public address |

## Why these providers

- **Pesapal** holds a National Bank of Rwanda payment service provider licence, which is a strong regulatory signal ([source](https://www.pesapal.com/blog/the-national-bank-of-rwanda-licenses-pesapal-as-a-payment-service-provider-psp)). Its hosted checkout keeps card data off our servers, and its v3 API is documented (token, IPN registration, order submission, status check). Its Rwanda mobile money coverage and RWF support are not confirmed yet; those are launch gates.
- **Flutterwave** is the fallback. It covers cards and Rwandan mobile money through one API, with a documented Rwanda direct charge ([docs](https://developer.flutterwave.com/docs/direct-charge/rwanda-mobile-money)).
- **Resend** has the fastest onboarding and a simple official SDK, which matters for the two-week deadline. Amazon SES is the fallback if Resend's data terms do not meet compliance review.
- **Taag** is no longer used. The provider has closed its operations, so the Taag checkout in the frontend is removed as part of the payment work.
- **Video is built in-house** on WebRTC, with Socket.IO for signalling and a self-hosted coturn relay. No external video API is used, so no vendor can change terms or pricing under us. See [03-video.md](03-video.md).

## Go-live gates (must all be true before real patient data or money flows)

1. Pesapal: Rwanda merchant account active; RWF enabled; MTN MoMo, Airtel Money, and cards each enabled and tested in sandbox; security documentation on file.
2. Video: the coturn server is reachable on its public address, and a call works across two networks, including a relay-only path.
3. Resend: data terms reviewed by the owner. Email carries no health details, so a BAA may not be required. Compliance must confirm.
4. Security P0 items in [04-task-backlog.md](04-task-backlog.md) closed.

None of these were verified during planning. The owner and procurement own items 1 to 3.

## Related

- Existing backend status: [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)
- Existing task notes: [../Task.md](../Task.md)
