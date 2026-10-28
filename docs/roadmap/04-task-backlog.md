# 04 · Remaining Task Backlog

Written for: the engineering team, to plan and assign work.

## Two-week scope (launch by 13 November 2026)

Must ship in two weeks: SEC-01, SEC-02, SEC-03, FEAT-03, SEC-04, OPS-01, OPS-02, PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, EML-02, EML-03, EML-04, EML-05, FE-01, FE-03, FE-04 (only the endpoints used by the pay and email flows). Payments use Pesapal.

Sprint 2 (16 to 27 November, recommended): VID-02, VID-03, VID-04, VID-06.

Deferred until after the pilot: SEC-05, SEC-06, PAY-07, EML-06, EML-07, VID-05, VID-07, FEAT-01, FEAT-02, FEAT-04, FEAT-05, FEAT-06, FEAT-07, FE-02, OPS-03, OPS-04, OPS-05, QA-01 (reduced to smoke tests for the two-week scope), QA-02.

Scope cut for the two weeks: about 37 engineer-days must-have work, against roughly 22 engineer-days of team capacity. Video is the item that moves if capacity is short. See [05-timeline.md](05-timeline.md).

Taag is removed (closed by the provider). Email uses Resend, not Amazon SES.

## How to read this

- **ID**: stable reference. Use it in commit messages and PR titles.
- **Repo**: `BE` = careconect-bn, `FE` = careconect-frontend, `EXT` = external (vendor, procurement, DNS, or owner).
- **Priority**:
  - P0: blocks go-live or is a security or money risk.
  - P1: needed for the v1 launch.
  - P2: important, can ship after launch.
- **Estimate**: engineer-days, before buffer. Estimates are rough; FEAT-05 and FEAT-06 are the least certain.

## 1. Security and authorization

| ID | Repo | Pri | Est | Task | Source |
|---|---|---|---|---|---|
| SEC-01 | BE | P0 | 0.5 | Restrict `POST /invoice/invoices/:id/pay` and `PATCH .../status` to admin or cashier | `careconect-bn/src/routes/invoice.router.ts` |
| SEC-02 | BE | P0 | 1 | Ownership check on every patient and doctor record read (IDOR review of all `:id` routes) | Code review |
| SEC-03 | BE | P0 | 1 | Resolve roleMiddleware "for now" doctor access rule; enforce owner-only for doctor resources | `careconect-bn/src/middleware/roleMiddleware.ts:79` |
| SEC-04 | BE | P1 | 1 | Rate limiting on login, password reset, and payment endpoints | Add middleware |
| SEC-05 | BE | P1 | 1 | Replace API key stub with database-backed validation, or remove the feature if unused | `careconect-bn/src/middleware/security.ts:162` |
| SEC-06 | BE | P1 | 1 | Review security headers and CORS (`app.ts` uses default CORS: allows every origin) | `careconect-bn/src/app.ts` |

## 2. Payments (see [01-payment-gateway.md](01-payment-gateway.md))

| ID | Repo | Pri | Est | Task |
|---|---|---|---|---|
| PAY-01 | BE | P0 | 1 | Create `payment_transactions` table, Drizzle schema, and migration |
| PAY-02 | BE | P0 | 4 | Pesapal adapter: token refresh, IPN registration, SubmitOrderRequest, GetTransactionStatus |
| PAY-03 | BE | P0 | 2 | IPN handler: re-verify with GetTransactionStatus, match merchant reference, amount and currency check, idempotency, invoice update |
| PAY-04 | BE | P1 | 1.5 | Remove MTN, Airtel, and confirm endpoints; update env and `.env.example` |
| PAY-05 | FE | P0 | 3 | Pay Now flow, return page with polling, remove Taag (provider closed) and `NEXT_PUBLIC_TAAG_PLAN_ID`, fix `usePayments.ts`. Taag removal comes first because the current checkout is broken |
| PAY-06 | BE | P0 | 2 | Payment test suite: unit and Pesapal sandbox integration (cards, MTN MoMo, Airtel Money) |
| PAY-07 | BE | P2 | 2 | Nightly reconciliation: compare Pesapal settlements with invoices; report mismatches |
| PAY-08 | EXT | P0 | — | Pesapal merchant account for Rwanda, sandbox and production keys, RWF enabled, MTN MoMo and Airtel Money enabled, settlement account, security documentation |

## 3. Email (see [02-email.md](02-email.md))

| ID | Repo | Pri | Est | Task |
|---|---|---|---|---|
| EML-01 | EXT | P0 | — | Resend account; verify sending domain (DKIM, SPF, DMARC DNS records); production API key; confirm Resend data terms |
| EML-02 | BE | P0 | 3 | Email service module on Resend SDK, template registry, PHI-free check, idempotency keys, retry queue |
| EML-03 | BE | P1 | 1 | Password reset email (wire the existing token flow; `auth.service.ts:271`) |
| EML-04 | BE | P1 | 1 | Email verification: request and confirm endpoints (currently ❌ in IMPLEMENTATION_STATUS) |
| EML-05 | BE | P1 | 1 | Payment receipt and appointment confirmation templates |
| EML-06 | BE | P2 | 1.5 | Resend bounce and complaint webhook (signature verified); suppression list |
| EML-07 | BE | P2 | 1 | Appointment reminders (24 h and 1 h) via scheduled job |

## 4. Video consultations (see [03-video.md](03-video.md))

| ID | Repo | Pri | Est | Task |
|---|---|---|---|---|
| VID-01 | EXT | P0 | — | Public host for the coturn relay; open UDP/TCP 3478 and UDP 49160–49200; set VIDEO_TURN_SECRET |
| VID-02 | BE | P1 | 3 | Video service: create room per appointment, idempotent; delete on cancel |
| VID-03 | BE | P1 | 2 | `GET /consultation/:id/join`: authorization, join window, meeting token |
| VID-04 | FE | P1 | 3 | Consultation page: join button, device check, WebRTC call component (built), fallback message |
| VID-05 | BE | P2 | 2 | Record call start and end times from signalling events; set consultation timestamps |
| VID-06 | BE+FE | P1 | 2 | Video tests: authorization, join window, sandbox two-party call |
| VID-07 | BE | P2 | 1 | Audio-only mode if the owner confirms it is needed |

## 5. Missing features and placeholders

| ID | Repo | Pri | Est | Task | Source |
|---|---|---|---|---|---|
| FEAT-01 | BE | P1 | 2 | Real doctor statistics (appointments, consultations, revenue); remove mock | `careconect-bn/src/services/doctor.service.ts:351` |
| FEAT-02 | BE | P2 | 2 | Persist admin settings (store or config table) | `careconect-bn/src/services/admin.service.ts:94` |
| FEAT-03 | BE | P0 | 1 | Patient ownership on `GET /invoice/invoices/patient/:patientId` (any user can read any patient's invoices) | `careconect-bn/src/routes/invoice.router.ts:13` |
| FEAT-04 | BE | P1 | 8 | Patient endpoints (IMPLEMENTATION_STATUS section 2): profile, medical history, allergies, medications, preferences, family links | `careconect-bn/docs/IMPLEMENTATION_STATUS.md` |
| FEAT-05 | BE | P1 | 5 | Doctor endpoints (section 3): profile, status, listing, specialties, consultation fee, patients | `careconect-bn/docs/IMPLEMENTATION_STATUS.md` |
| FEAT-06 | BE | P2 | 3 | User profile endpoints (section 1): get, update, delete, admin list, security logs | `careconect-bn/docs/IMPLEMENTATION_STATUS.md` |
| FEAT-07 | BE | P2 | 1 | Reconcile `Task.md` with what we will build; mark out-of-scope items (AI diagnostics, PayPack enterprise analytics, blockchain payments) as "later" | `careconect-bn/docs/Task.md` |

## 6. Frontend

| ID | Repo | Pri | Est | Task | Source |
|---|---|---|---|---|---|
| FE-01 | FE | P1 | 0.5 | Fix API base URL default (`localhost:8000` vs backend port 3000); add `.env.example` | `careconect-frontend/src/lib/api/api.ts:6` |
| FE-02 | FE | P2 | 1 | Clear the ESLint errors in the last lint run, then remove build and debug artifacts from the repo root (`build_*.txt`, `curl_out*.txt`, `out.html`, `eslint_report.txt`, `build_log.txt`) | Repo root |
| FE-03 | FE | P1 | 0.5 | Remove the "blockchain" payments claim from the home page; replace with accurate copy | `careconect-frontend/src/app/page.tsx:130` |
| FE-04 | FE | P1 | 1 | Wire data hooks to real endpoints; remove calls to endpoints that do not exist | `careconect-frontend/src/hooks/` |

## 7. Operations and quality

| ID | Repo | Pri | Est | Task |
|---|---|---|---|---|
| OPS-01 | BE | P0 | 1 | Production secrets in a secret manager; startup refuses to run with missing production values |
| OPS-02 | BE | P1 | 1 | PHI-safe logging: remove `console.log` of payment payloads; redact emails and phone numbers |
| OPS-03 | EXT | P1 | 2 | Backups, point-in-time restore test, encryption-at-rest check on the database, audit log retention |
| OPS-04 | BE+FE | P1 | 1 | CI pipeline: install, type-check, lint, unit tests, build on every PR |
| OPS-05 | BE | P1 | 1 | Health check reports status of the payment and email providers (not only the database) |
| QA-01 | BE+FE | P1 | 5 | End-to-end tests for booking → pay → email → video; load test on booking and payment |
| QA-02 | EXT | P1 | 5 | UAT with a pilot clinic (two doctors, five patients) |

## 8. Compliance and documents

| ID | Repo | Pri | Est | Task |
|---|---|---|---|---|
| COMP-01 | EXT | P0 | — | Vendor compliance on file: Pesapal security documentation; Resend data terms reviewed |
| COMP-02 | EXT | P1 | — | Privacy notice, consent for video and email, data retention schedule |
| COMP-03 | EXT | P1 | — | Written incident response and breach notification procedure |

## Totals

Engineering estimate, excluding EXT items and buffer: about **70 engineer-days**. The timeline in [05-timeline.md](05-timeline.md) adds buffer for external lead times, holidays, and estimate error.
