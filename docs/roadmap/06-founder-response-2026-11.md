# 06 · Response to Founder Review (November 2026)

This note answers the founder's review of the 28 October remaining work plan. It records what was changed in code, what was verified, what is still open, and the decisions the owner needs to make.

## 1. Summary

| Founder point | Status | Notes |
|---|---|---|
| 1. IsanoMed business model and user categories | Done | `sponsor` user type. Sponsor–patient relationship is a link table. An account's roles are computed from its type and its links (`roles` on `/users/profile`). |
| 2. Roles, permissions, consent | Done (API and screens) | Sponsor links with patient approval and separate medical consent. Payment never grants medical access. Sponsor, provider, patient-consent and admin screens are built (see frontend status). |
| 3. Pesapal questions | Answered below | Pesapal refund and settlement details still need Pesapal sandbox confirmation and the owner's answers. |
| 4. Deferred tasks | Done, with two owner decisions | Access control, email verification (EML-04), reconciliation (PAY-07) and the refund workflow are built. Refund amounts and approval policy need the owner's confirmation. |
| 5. Video | No change | Stays in Sprint 2 (16 to 27 November). |
| 6. Rebrand to IsanoMed | Done in development code | Display strings changed. Technical identifiers kept (see section 6). |
| Admin metrics dashboard | Done | `/admin/dashboard` with real counts, revenue, queues and the last reconciliation run. |
| Facilities (provider model) | Done | Facilities are verified by an admin before doctors can be assigned; settlement report per facility. |
| 7. K-1 to K-7 and repository access | Open | Items not found in the repository. Access is an owner action. |
| 8. Sign-off deliverables | Partly ready | See section 8. |

## 2. Roles, consent, and dashboards (founder points 1 and 2)

### Built

- **Sponsor user type** (`sponsor`). Sponsors register through the normal registration endpoint and must verify their email before they can request a link or pay.
- **Sponsor–patient links** (`sponsor_links`). A sponsor requests a link by the patient's email. The reply is the same whether or not the email belongs to an account, so the endpoint cannot be used to look up accounts. The patient approves, revokes, or switches medical access. A sponsor can withdraw but cannot approve or grant themselves medical access.
- **Two levels of access**, enforced in one place (`services/access.service.ts`):
  - Booking, payment and invoices: the patient, staff, or a sponsor with an **active** link.
  - Medical records, consultation notes, clinical summaries: the patient, staff, a doctor with an appointment or consultation with the patient, or a sponsor with an active link **and** medical access granted by the patient.
- **Roles on the profile.** `/users/profile` returns `roles`, computed from the account type and sponsor links. A patient who sponsors someone also has the `sponsor` role. Roles are computed rather than stored, so they cannot drift from the links. A single account keeps one stored type.
- **Sponsor dashboard** (`GET /sponsor/dashboard`): linked patients, pending requests, invoice totals, upcoming visits and recent payments for linked patients. No medical data.
- **Provider dashboard** (`GET /provider/dashboard`): a doctor's appointments today and in the next seven days, patients, consultations, invoice revenue (paid, pending, refunded), and the facility the doctor belongs to. Admins can view any provider with `?doctorId=`.
- **Facilities** (`facilities`, `doctors.facility_id`). An admin registers a facility and verifies it. Only a verified facility can receive doctors. Settlement per facility is shown from paid invoices minus processed refunds.
- **Email verification** (EML-04). Verification emails carry a 24-hour link. Booking, paying, and sponsor link requests require a verified email (`EMAIL_NOT_VERIFIED`).

### Still open

- **Multiple stored roles.** An account still has one stored type. Multi-role accounts with a roles table are a larger change (about 3 engineer-days). The computed roles cover the founder's case of a patient who also sponsors.
- **Consent audit log.** Changes to links and consent are not yet written to a separate audit trail.
- **Facility-to-clinic contracts.** Settlement terms per facility (commission, payout schedule) are not modelled. Only the settlement reference is stored.

## 3. Pesapal questions (founder point 3)

Answers come from the code, `docs/roadmap/01-payment-gateway.md`, and the payment service. Where the answer depends on Pesapal or the owner, it says so.

1. **International Visa and Mastercard from diaspora customers.** Not verified. Pesapal's hosted checkout is designed for card payments, but whether our merchant account accepts international cards is a Pesapal onboarding question. **Owner or Pesapal to confirm.**
2. **Merchant onboarding and settlement for a Rwanda business.** Not confirmed. The roadmap cites Pesapal's National Bank of Rwanda payment service provider licence. Merchant approval, RWF enablement and the settlement account are still open. **Owner to confirm with Pesapal.**
3. **Linking payments to patients, bookings, invoices and facilities.** Partly in place. A payment transaction links to an invoice, an invoice links to a patient, a consultation and a doctor, and an appointment links to a patient and a doctor. **Facilities are not modelled**, so settlement to a clinic cannot be linked to a payment yet.
4. **Clinic settlement, refunds and reconciliation.** Not implemented.
   - Refunds: no refund flow exists.
   - Reconciliation: PAY-07 (nightly reconciliation against Pesapal settlements) is deferred.
   - Split settlement to clinics: not designed.
5. **Production requirements.** From the roadmap go-live gates:
   - Pesapal merchant account for Rwanda, approved for production.
   - RWF enabled as the settlement currency.
   - Cards, MTN MoMo and Airtel Money each enabled and tested in sandbox.
   - Settlement account and payout schedule confirmed.
   - Pesapal security and compliance documentation on file.
   - Production keys held in the secret manager.

The existing Pesapal sandbox integration is retained as requested. Payment ownership checks were updated so that sponsors with an active link can pay and view payments for their linked patient.

## 4. Deferred tasks (founder point 4)

The founder asked for essential payment, refund, backup, email verification, access control and security work to be reconsidered before any real-patient pilot.

| Item | Founder's request | Current state | Recommendation |
|---|---|---|---|
| Access control | Include in MVP | **Done** (section 5) | Keep |
| Security assurance | Include in MVP | Partly done: authorization fixed. Rate limits (SEC-04) and CORS/headers (SEC-06) still open | SEC-04 and SEC-06 before pilot. About 2 engineer-days |
| Email verification (EML-04) | Include in MVP | **Built** | Done. Required for booking, paying and sponsor requests |
| Refunds | Include in MVP | **Workflow built**: request, second-admin approval, manual or Pesapal processing, invoice becomes `refunded` | Owner to confirm the policy (section 4a). Pesapal refund calls are disabled until verified in sandbox |
| Payment reconciliation (PAY-07) | Include in MVP | **Built**: manual run and optional schedule (`RECONCILIATION_INTERVAL_HOURS`, default 24). Findings are stored per run | Review the findings screen with the owner; confirm the Pesapal re-check in sandbox |
| Backup and restore (OPS-03) | Include in MVP | Owner or infrastructure task. Not in the code | Owner to confirm the hosting provider's backup and restore test |
| Video (VID-02 to VID-06) | Should not delay essentials | Not started | Stays in Sprint 2 |

### 4a. Refund policy (default in code, owner to confirm)

- Only a completed Pesapal payment can be refunded.
- Pending, approved and processed refunds together cannot exceed the amount paid.
- The admin who requests a refund cannot approve it. A second admin decides.
- Refunds are processed by hand in the Pesapal dashboard unless `PESAPAL_REFUNDS_ENABLED=true`. Then the API calls Pesapal's refund request. Those field names follow Pesapal's v3 documentation and must be confirmed in sandbox before the flag is turned on.
- An invoice is marked `refunded` when processed refunds equal the amount paid.

## 5. Access-control fixes made in this change

These were found during the review. Each one was a gap in the previous code.

1. **Unauthenticated writes to patient records.** `/public/:userId/*` and `/patient/public/:userId/*` accepted writes without any sign-in. Anyone who knew a user ID could change that patient's profile, allergies, medications and history. These routes now require sign-in and the caller's own user ID.
2. **Any doctor could read any patient's medical records** through `/patient/doctor/:userId/*`. Now requires a care relationship (an appointment or a consultation).
3. **Consultations (including clinical notes) had no ownership check.** Any signed-in user could read any consultation by ID, list consultations for any patient, or read a patient's history. Now limited to the patient, the treating doctor, staff, or a sponsor with medical consent. Creating and updating consultations now requires a doctor, and an update requires the treating doctor or staff.
4. **Invoices.** Patient checks were in place for some routes but not others. Now enforced on list, detail, download and per-patient routes. Sponsors see only linked patients. Doctors see only invoices they issued. Pay and status changes remain admin-only.
5. **Payments.** Payment initiation and status checks were limited to patients only, so sponsors were excluded and doctors were not restricted. Now uses the same rule as invoices.
6. **Search.** Sponsors would have received every invoice in search results, and doctors received every invoice in global search. Both fixed.
7. **Misc endpoints.** `/misc/upload-file` required no sign-in and `/misc/send-notification` could be called by anyone. Both now require sign-in, and send-notification requires an admin. Both are still placeholder stubs that return fake data (see section 7).

## 6. Rebrand to IsanoMed (founder point 6)

Changed to IsanoMed in display text only:

- Backend: API welcome message, email subjects and bodies, invoice PDF title, author and header, payment description and fallback name, default sender address, package author.
- Frontend: login and register headings, the configuration endpoint's app name.
- `.env.example` sender address.

Kept as-is, to avoid breaking the development environment. These should change at the production cut-over, after business-name clearance:

- JWT issuer and audience (`careconnect-bn`, `careconnect-api`, `careconnect-video`).
- Database name, user and container names (`careconnect`).
- Test account email domain (`@careconnect.rw`) and the default sender domain.
- Support email in the configuration endpoint (`support@careconnect.demo`).
- Frontend package name.

## 7. Verification

| Check | Result |
|---|---|
| TypeScript type-check (backend) | Passes |
| Migration `0002_sponsor_links.sql` on a scratch database | Applies cleanly |
| Schema on a fresh Postgres 16 container (via `drizzle-kit push`) | Applies cleanly |
| Backend type-check (in the Docker build, `tsc`) | Passes |
| Migrations `0002` and `0003` applied in order on a scratch database | Apply cleanly |
| Schema on a fresh Postgres 16 container (via `drizzle-kit push`) | Applies cleanly |
| Access, consent, verification, facilities, dashboards and reconciliation (`scripts/access-control-smoke.mjs`) | **53 of 53 pass** |
| Refund workflow (`scripts/refund-flow-smoke.mjs`) | **16 of 16 pass** |
| Live coverage of every endpoint the frontend calls (`scripts/api-coverage-smoke.mjs`), each as the role the frontend uses | **85 of 85 pass** |
| Browser check of the frontend in Chromium at phone width (`scripts/ui-e2e.mjs`): every dashboard route for patient, doctor, admin and sponsor, sign-up, facility and reconciliation actions, verification page | **44 of 44 pass**, with no failed API calls or console errors on the checked pages |
| Existing end-to-end smoke test (`scripts/e2e-smoke.mjs`) | Not re-run. It needs the frontend on port 3001 and the seed data |
| Frontend screens (sponsor, provider, admin dashboards and admin queues, email verification page) | Built. Production build passes; browser check passes (see above) |

Environment notes: Postgres and the API run in Docker. The Windows Node install on this machine ran out of memory when running the seed and the API directly, so the API was run from its Docker image.

### Known gaps found during verification

- **Migrations are incomplete.** The repository has migrations `0000` (payment transactions), `0001` (email suppressions), `0002` (sponsor links) and `0003` (facilities, refunds, reconciliation). The base tables (users, doctors, patients, appointments, consultations, invoices) were created by `db:push`, not by a migration. A fresh deployment that runs `db:migrate` would fail. **A baseline migration must be generated before handover.** This also affects the deployment and backup plan.
- **Pesapal refund request fields** are unverified (section 4a).
- **Pesapal sandbox initiation** returns "not fully configured" without `PESAPAL_IPN_ID` and `PESAPAL_CALLBACK_URL`. Expected in this environment.
- **Doctor invoice updates** (`PATCH /invoice/invoices/:id`) are allowed for any doctor, not only the issuing doctor. Needs the same owner check.

## 8. Sign-off checklist (founder point 8)

| Requested | Status |
|---|---|
| Demonstration of the sponsor–patient–provider workflow, or a list of gaps | API workflow can be shown with the access-control script. No screens yet. Gaps in sections 2 and 7 |
| Sandbox payment, email and video test results | Payment sandbox: integration retained, end-to-end not run here (Pesapal credentials not configured). Email: not run (Resend not configured). Video: Sprint 2 |
| Access-control and patient-consent test results | 53 of 53 checks pass (section 7) |
| Completed, outstanding and deferred features | Sections 2, 4 and 7, and `04-task-backlog.md` |
| Operational runbook and repository handover | Not started. Blocked on the baseline migration (section 7) |
| Prerequisites for real-patient pilot and production | Section 3 (Pesapal), `01-payment-gateway.md` gates, and `05-timeline.md` gate |

## 9. Items needing the owner

1. **K-1 to K-7.** These are not in the repository. The 28 October plan is not in the repository either. Please send the document, or the list with owners and dates.
2. **"CareSource".** The name does not appear anywhere in the repository. Please confirm where it was used, so it can be corrected.
3. **Repository and infrastructure access.** Ownership, admin rights to both repositories, the database host, and the deployment configuration need to be granted by whoever administers those accounts. I cannot grant them.
4. **Refund policy and clinic settlement model.** Needed before refunds and facility settlement are built.
5. **Facility terms.** A facility entity now exists and doctors belong to it. Decide the settlement terms (commission, payout schedule, who receives the money) before the first clinic is paid.
6. **Pesapal answers** in section 3.

## 10. Fixes from the final verification

- **Patient dashboard crash.** Appointment and medication hooks now unwrap the API's `{ success, data }` envelope.
- **Doctor pages returned 403.** They called the admin-only patient list. `GET /provider/patients` now returns only patients the doctor has seen, with names and contact details, not medical data.
- **Admin doctor list returned 400.** Paging and fee query parameters are now accepted as strings.
- **A bad verification token signed the user out.** The 401 handler now redirects only for an expired signed-in session.
- **Messages page showed invented conversations.** Replaced with a "coming soon" notice. Secure messaging is not built.

Test-environment note: the auth rate limiter (20 auth requests per 15 minutes per IP) is enforced in memory, so the test runs restart the API container between suites. Production limits are unchanged.

