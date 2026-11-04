// Access-control, consent, verification, facility, dashboard and refund checks against a running API.
//
// Runs inside the API image so it can mint email-verification tokens with the same secret the API uses:
//   docker compose run --rm --no-deps -v "$PWD/scripts:/app/scripts" api node scripts/access-control-smoke.mjs
//
// Needs the seed data (node dist/db/seed.js). Exits non-zero if any check fails.

import jwt from 'jsonwebtoken';

const API = process.env.API_URL ?? 'http://api:3000';
const V1 = `${API}/api/v1`;
const SEED = {
  patientId: process.env.PATIENT_ID,
  invoiceId: process.env.INVOICE_ID,
  doctorId: process.env.DOCTOR_ID,
  adminEmail: 'admin.test@careconnect.rw',
  adminTwoEmail: 'admin2.test@careconnect.rw',
  patientEmail: 'patient.test@careconnect.rw',
  doctorEmail: 'doctor.test@careconnect.rw',
};
if (!SEED.patientId || !SEED.invoiceId || !SEED.doctorId) {
  console.error('Set PATIENT_ID, INVOICE_ID and DOCTOR_ID (from the seed output).');
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const call = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${V1}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
};

const PASSWORD = 'Access#Test2026';
const login = async (email, password) => {
  const { status, json } = await call('POST', '/auth/login', { body: { email, password } });
  if (status !== 200) throw new Error(`login failed for ${email}: ${status}`);
  return json.data.accessToken;
};

const me = async (token) => (await call('GET', '/users/profile', { token })).json.data;

// Mints the same token the verification email would carry, using the API's secret.
const verificationToken = (userId, email) =>
  jwt.sign({ userId, email, purpose: 'email_verify' }, process.env.JWT_SECRET, {
    expiresIn: '1h',
    issuer: process.env.JWT_ISSUER ?? 'careconnect-bn',
    audience: 'isanomed-email-verify',
    algorithm: 'HS256',
  });

const register = async (userType, label, { verify = true } = {}) => {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const email = `${label}.${stamp}@example.test`;
  const phone = `+2507${String(Math.floor(10000000 + Math.random() * 89999999))}`;
  const { status, json } = await call('POST', '/auth/register', {
    body: { email, phoneNumber: phone, password: PASSWORD, userType, firstName: label, lastName: 'Smoke' },
  });
  if (status !== 201 && status !== 200) throw new Error(`register ${userType} failed: ${status} ${JSON.stringify(json)}`);
  const token = await login(email, PASSWORD);
  const user = await me(token);
  if (verify) {
    const confirmed = await call('POST', '/auth/email-verification/confirm', { body: { token: verificationToken(user.userId, email) } });
    if (confirmed.status !== 200) throw new Error(`verify ${email} failed: ${confirmed.status}`);
  }
  return { email, token, userId: user.userId };
};

const patientToken = await login(SEED.patientEmail, 'TestPatient#2026');
const doctorToken = await login(SEED.doctorEmail, 'TestDoctor#2026');
const adminToken = await login(SEED.adminEmail, 'TestAdmin#2026');
const adminTwoToken = await login(SEED.adminTwoEmail, 'TestAdmin#2026');

const sponsor = await register('sponsor', 'sponsor');
const stranger = await register('patient', 'stranger');
const unverified = await register('sponsor', 'unverified', { verify: false });

// Consultation for the seeded patient, as the doctor.
const consultList = await call('GET', `/consultation/consultations?patientId=${SEED.patientId}`, { token: doctorToken });
const consultationId =
  process.env.CONSULTATION_ID ??
  consultList.json?.data?.[0]?.consultationId ??
  consultList.json?.data?.consultations?.[0]?.consultationId ??
  consultList.json?.consultations?.[0]?.consultationId;
if (!consultationId) {
  console.error('No consultation found for the seeded patient. Set CONSULTATION_ID.');
  process.exit(2);
}

// ---------- 1. Public write routes ----------
{
  const r = await call('POST', `/patient/public/${SEED.patientId}/allergies`, { body: { allergenType: 'food', allergenName: 'x' } });
  check('unauthenticated write to patient allergies is rejected', r.status === 401, `status ${r.status}`);
}
{
  const r = await call('POST', `/patient/public/${SEED.patientId}/allergies`, { token: stranger.token, body: { allergenType: 'food', allergenName: 'x' } });
  check('another patient cannot write to this patient record', r.status === 403, `status ${r.status}`);
}

// ---------- 2. Doctor medical reads ----------
{
  const r = await call('GET', `/patient/doctor/${SEED.patientId}/medical-history`, { token: doctorToken });
  check('treating doctor can read patient medical history', r.status === 200, `status ${r.status}`);
}
{
  const r = await call('GET', `/patient/doctor/${SEED.patientId}/medical-history`, { token: stranger.token });
  check('patient cannot use doctor medical route', r.status === 403, `status ${r.status}`);
}

// ---------- 3. Email verification (EML-04) ----------
{
  const r = await call('POST', '/auth/email-verification/confirm', { body: { token: 'not-a-real-token' } });
  check('invalid verification token is rejected', r.status === 401, `status ${r.status}`);
}
{
  const r = await call('POST', '/auth/email-verification/request', { token: unverified.token });
  check('signed-in user can request a verification email', r.status === 200, `status ${r.status}`);
}
{
  const r = await call('POST', '/sponsor/links', { token: unverified.token, body: { patientEmail: SEED.patientEmail, relationship: 'parent' } });
  check('unverified sponsor cannot request a patient link', r.status === 403 && JSON.stringify(r.json).includes('EMAIL_NOT_VERIFIED'), `status ${r.status}`);
}
{
  const r = await call('POST', '/appointments/book', {
    token: unverified.token,
    body: { doctorId: SEED.doctorId, appointmentType: 'consultation', scheduledDate: '2026-12-01', scheduledTime: '10:00:00' },
  });
  check('unverified user cannot book an appointment', r.status === 403, `status ${r.status}`);
}

// ---------- 4. Sponsor has no access before a link exists ----------
{
  const r = await call('GET', `/invoice/invoices/patient/${SEED.patientId}`, { token: sponsor.token });
  check('sponsor without a link cannot list patient invoices', r.status === 403, `status ${r.status}`);
}
{
  const r = await call('GET', '/invoice/invoices', { token: sponsor.token });
  check('sponsor cannot list all invoices', r.status === 403, `status ${r.status}`);
}
{
  const r = await call('POST', '/sponsor/links', { token: sponsor.token, body: { patientEmail: SEED.patientEmail, relationship: 'parent' } });
  check('sponsor link request is accepted', r.status === 202, `status ${r.status}`);
}
{
  const r = await call('POST', '/sponsor/links', { token: sponsor.token, body: { patientEmail: 'nobody.here@example.test', relationship: 'parent' } });
  check('unknown email gets the same reply (no account lookup)', r.status === 202, `status ${r.status}`);
}

// ---------- 5. Patient approves; sponsor dashboard and invoices ----------
const linksForPatient = await call('GET', '/sponsor/links', { token: patientToken });
const link = linksForPatient.json?.data?.find((l) => l.status === 'pending' && l.sponsorUserId === sponsor.userId);
check('patient sees the pending request', Boolean(link), link ? `link ${link.linkId}` : 'none');
const sponsorPending = await call('GET', '/sponsor/dashboard', { token: sponsor.token });
check('sponsor dashboard lists the pending request', sponsorPending.status === 200 && sponsorPending.json.data.pendingRequests.length >= 1, `status ${sponsorPending.status}`);
if (link) {
  const r = await call('PATCH', `/sponsor/links/${link.linkId}`, { token: sponsor.token, body: { medicalAccessGranted: true } });
  check('sponsor cannot grant themselves medical access', r.status === 403, `status ${r.status}`);
}
if (link) {
  const r = await call('PATCH', `/sponsor/links/${link.linkId}`, { token: patientToken, body: { status: 'active' } });
  check('patient approves the link', r.status === 200, `status ${r.status}`);
}
{
  const r = await call('GET', `/invoice/invoices/patient/${SEED.patientId}`, { token: sponsor.token });
  check('active sponsor sees the patient invoices', r.status === 200, `status ${r.status}`);
}
{
  const r = await call('GET', `/invoice/invoices/${SEED.invoiceId}`, { token: sponsor.token });
  check('active sponsor can open the invoice', r.status === 200, `status ${r.status}`);
}
{
  const r = await call('GET', '/sponsor/dashboard', { token: sponsor.token });
  const linked = r.json?.data?.linkedPatients ?? [];
  check('sponsor dashboard shows the linked patient and invoice totals', r.status === 200 && linked.length === 1 && r.json.data.invoices.summary.pendingCount >= 1, `status ${r.status}`);
  check('sponsor dashboard exposes no medical data', !('medicalHistory' in (r.json?.data ?? {})) && !JSON.stringify(r.json?.data ?? {}).includes('allerg'), '');
}
{
  const r = await call('GET', `/consultation/consultations/${consultationId}/summary`, { token: sponsor.token });
  check('payment-only sponsor cannot read consultation summary', r.status === 403, `status ${r.status}`);
}
{
  const r = await call('GET', `/consultation/consultations/patient/${SEED.patientId}`, { token: sponsor.token });
  check('payment-only sponsor cannot read patient consultation history', r.status === 403, `status ${r.status}`);
}

// ---------- 6. Medical consent ----------
if (link) {
  const r = await call('PATCH', `/sponsor/links/${link.linkId}`, { token: patientToken, body: { medicalAccessGranted: true } });
  check('patient grants medical access', r.status === 200, `status ${r.status}`);
}
{
  const r = await call('GET', `/consultation/consultations/${consultationId}/summary`, { token: sponsor.token });
  check('sponsor with medical consent reads consultation summary', r.status === 200, `status ${r.status}`);
}

// ---------- 7. Strangers and the patient ----------
{
  const r = await call('GET', `/consultation/consultations/${consultationId}`, { token: stranger.token });
  check('stranger cannot read a consultation by id', r.status === 403, `status ${r.status}`);
}
{
  const r = await call('GET', `/consultation/consultations?patientId=${SEED.patientId}`, { token: stranger.token });
  check('stranger cannot list another patient consultations', r.status === 403, `status ${r.status}`);
}
{
  const r = await call('GET', `/consultation/consultations/${consultationId}/summary`, { token: patientToken });
  check('patient can read their own consultation summary', r.status === 200, `status ${r.status}`);
}
{
  const r = await call('POST', '/appointments/book', {
    token: stranger.token,
    body: { doctorId: SEED.doctorId, appointmentType: 'consultation', scheduledDate: '2026-12-01', scheduledTime: '10:00:00', patientUserId: SEED.patientId },
  });
  check('stranger cannot book for this patient', r.status === 403, `status ${r.status}`);
}

// ---------- 8. Revocation ----------
if (link) {
  const r = await call('PATCH', `/sponsor/links/${link.linkId}`, { token: sponsor.token, body: { status: 'revoked' } });
  check('sponsor withdraws the link', r.status === 200, `status ${r.status}`);
}
{
  const r = await call('GET', `/invoice/invoices/patient/${SEED.patientId}`, { token: sponsor.token });
  check('revoked sponsor loses invoice access', r.status === 403, `status ${r.status}`);
}
{
  const r = await call('GET', `/consultation/consultations/${consultationId}/summary`, { token: sponsor.token });
  check('revoked sponsor loses medical access', r.status === 403, `status ${r.status}`);
}

// ---------- 9. Provider dashboard (doctor) ----------
{
  const r = await call('GET', '/provider/dashboard', { token: doctorToken });
  const d = r.json?.data;
  check('doctor provider dashboard loads with real counts', r.status === 200 && typeof d?.appointments?.today === 'number' && typeof d?.patients?.total === 'number', `status ${r.status}`);
}
{
  const r = await call('GET', '/provider/dashboard', { token: stranger.token });
  check('patient cannot open the provider dashboard', r.status === 403, `status ${r.status}`);
}
{
  const r = await call('GET', `/provider/dashboard?doctorId=${SEED.doctorId}`, { token: adminToken });
  check('admin can view any provider dashboard', r.status === 200, `status ${r.status}`);
}

// ---------- 10. Facilities and settlement ----------
let facilityId;
{
  const reg = `REG-${Date.now().toString(36)}`;
  const r = await call('POST', '/admin/facilities', {
    token: adminToken,
    body: { name: 'Kigali Smoke Clinic', facilityType: 'clinic', registrationNumber: reg, district: 'Gasabo' },
  });
  facilityId = r.json?.data?.facilityId;
  check('admin registers a facility (pending)', r.status === 200 && r.json?.data?.verificationStatus === 'pending', `status ${r.status}`);
}
if (facilityId) {
  const r = await call('PUT', `/admin/doctors/${SEED.doctorId}/facility`, { token: adminToken, body: { facilityId } });
  check('doctor cannot be assigned to an unverified facility', r.status === 400, `status ${r.status}`);
}
if (facilityId) {
  const r = await call('PATCH', `/admin/facilities/${facilityId}`, { token: adminToken, body: { verificationStatus: 'verified' } });
  check('admin verifies the facility', r.status === 200 && r.json?.data?.verificationStatus === 'verified', `status ${r.status}`);
}
if (facilityId) {
  const r = await call('PUT', `/admin/doctors/${SEED.doctorId}/facility`, { token: adminToken, body: { facilityId } });
  check('verified facility can receive the doctor', r.status === 200, `status ${r.status}`);
}
if (facilityId) {
  const r = await call('GET', `/admin/facilities/${facilityId}/settlement`, { token: adminToken });
  check('facility settlement report loads', r.status === 200 && r.json?.data?.facility?.facilityId === facilityId, `status ${r.status}`);
}
{
  const r = await call('GET', '/provider/dashboard', { token: doctorToken });
  check('provider dashboard shows the facility', r.json?.data?.doctor?.facility?.facilityId === facilityId, '');
}
{
  const r = await call('GET', '/admin/facilities', { token: patientToken });
  check('patient cannot list facilities', r.status === 403, `status ${r.status}`);
}

// ---------- 11. Refunds: maker-checker and payment rule ----------
{
  const r = await call('POST', `/invoice/invoices/${SEED.invoiceId}/refunds`, { token: adminToken, body: { amount: 100, reason: 'Duplicate charge check' } });
  check('refund needs a completed payment (seeded invoice is unpaid)', r.status === 400, `status ${r.status}`);
}
{
  const r = await call('POST', `/invoice/invoices/${SEED.invoiceId}/refunds`, { token: patientToken, body: { amount: 100, reason: 'Please refund me' } });
  check('patient cannot request a refund', r.status === 403, `status ${r.status}`);
}
{
  const r = await call('POST', '/refunds/00000000-0000-4000-8000-000000000000/decision', { token: adminTwoToken, body: { decision: 'approve' } });
  check('refund decision on an unknown refund returns 404', r.status === 404, `status ${r.status}`);
}

// ---------- 12. Reconciliation (PAY-07) ----------
let runId;
{
  const r = await call('POST', '/admin/reconciliation/runs', { token: adminToken });
  runId = r.json?.data?.runId;
  check('admin runs reconciliation', r.status === 200 && r.json?.data?.status === 'completed', `status ${r.status}`);
}
if (runId) {
  const r = await call('GET', `/admin/reconciliation/runs/${runId}`, { token: adminToken });
  check('reconciliation run is stored with findings', r.status === 200 && Array.isArray(r.json?.data?.findings), `status ${r.status}`);
}
{
  const r = await call('POST', '/admin/reconciliation/runs', { token: patientToken });
  check('patient cannot run reconciliation', r.status === 403, `status ${r.status}`);
}

// ---------- 13. Admin dashboard ----------
{
  const r = await call('GET', '/admin/dashboard', { token: adminToken });
  const d = r.json?.data;
  check('admin dashboard returns metrics', r.status === 200 && typeof d?.users?.total === 'number' && Array.isArray(d?.appointments?.daily), `status ${r.status}`);
  check('admin dashboard shows reconciliation status', Boolean(d?.reconciliation?.lastRunId), '');
}
{
  const r = await call('GET', '/admin/dashboard', { token: doctorToken });
  check('doctor cannot open the admin dashboard', r.status === 403, `status ${r.status}`);
}

// ---------- 14. Roles on the profile ----------
{
  const r = await call('GET', '/users/profile', { token: sponsor.token });
  check('profile lists roles including the account type', Array.isArray(r.json?.data?.roles) && r.json.data.roles.includes('sponsor'), `roles ${JSON.stringify(r.json?.data?.roles)}`);
}

// ---------- 15. Misc endpoints ----------
{
  const r = await call('POST', '/misc/send-notification', { body: { to: 'a@b.c', subject: 's', message: 'm' } });
  check('send-notification needs sign-in', r.status === 401, `status ${r.status}`);
}
{
  const r = await call('POST', '/misc/send-notification', { token: patientToken, body: { to: 'a@b.c', subject: 's', message: 'm' } });
  check('send-notification needs an admin', r.status === 403, `status ${r.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
