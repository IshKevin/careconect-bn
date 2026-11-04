// Live coverage check: every endpoint the frontend calls, called with the role the frontend uses it with.
//
// A call passes when the route exists (not 404 for a real resource) and the handler does not fail (no 5xx).
// Where the expected result is known, the status must match exactly.
//
// Runs inside the API image so it can mint verification tokens with the API's own secret:
//   docker compose run --rm --no-deps -v "$PWD/scripts:/app/scripts" \
//     -e PATIENT_ID=... -e DOCTOR_ID=... -e DOCTOR_USER_ID=... -e INVOICE_ID=... -e APPOINTMENT_ID=... \
//     api node scripts/api-coverage-smoke.mjs

import jwt from 'jsonwebtoken';

const API = process.env.API_URL ?? 'http://api:3000';
const V1 = `${API}/api/v1`;
const { PATIENT_ID, DOCTOR_ID, DOCTOR_USER_ID, INVOICE_ID, APPOINTMENT_ID } = process.env;
for (const [k, v] of Object.entries({ PATIENT_ID, DOCTOR_ID, DOCTOR_USER_ID, INVOICE_ID, APPOINTMENT_ID })) {
  if (!v) {
    console.error(`Set ${k} (see the seed output or the database).`);
    process.exit(2);
  }
}
const FAKE_ID = '00000000-0000-4000-8000-000000000000';
const TODAY = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);

const results = [];
const note = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
};

const call = async (method, path, token, body) => {
  const response = await fetch(`${V1}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* binary or empty */
  }
  return { status: response.status, json, contentType: response.headers.get('content-type') ?? '' };
};

const PASSWORD = 'Coverage#2026';
const login = async (email, password) => {
  const r = await call('POST', '/auth/login', undefined, { email, password });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status}`);
  return r.json.data.accessToken;
};

const registerVerified = async (userType, label) => {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const email = `${label}.${stamp}@example.test`;
  const phone = `+2507${String(Math.floor(10000000 + Math.random() * 89999999))}`;
  const reg = await call('POST', '/auth/register', undefined, {
    email, phoneNumber: phone, password: PASSWORD, userType, firstName: label, lastName: 'Cover',
  });
  if (reg.status !== 201 && reg.status !== 200) throw new Error(`register ${label}: ${reg.status}`);
  const token = await login(email, PASSWORD);
  const profile = await call('GET', '/users/profile', token);
  const token2 = jwt.sign(
    { userId: profile.json.data.userId, email, purpose: 'email_verify' },
    process.env.JWT_SECRET,
    { expiresIn: '1h', issuer: process.env.JWT_ISSUER ?? 'careconnect-bn', audience: 'isanomed-email-verify', algorithm: 'HS256' },
  );
  await call('POST', '/auth/email-verification/confirm', undefined, { token: token2 });
  return { token, userId: profile.json.data.userId, email };
};

const tokens = {
  anon: undefined,
  patient: await login('patient.test@careconnect.rw', 'TestPatient#2026'),
  doctor: await login('doctor.test@careconnect.rw', 'TestDoctor#2026'),
  admin: await login('admin.test@careconnect.rw', 'TestAdmin#2026'),
};
tokens.sponsor = (await registerVerified('sponsor', 'coversponsor')).token;

// Probe: [label, method, path, role, body?, expect]
// expect = array of acceptable statuses (exact), or 'exists' (any non-404, non-5xx).
const probes = [
  // ---- auth ----
  ['login rejects bad password', 'POST', '/auth/login', 'anon', { email: 'patient.test@careconnect.rw', password: 'wrong-password' }, [401]],
  ['verification confirm rejects bad token', 'POST', '/auth/email-verification/confirm', 'anon', { token: 'nope' }, [401]],
  ['verification request (patient)', 'POST', '/auth/email-verification/request', 'patient', undefined, [200]],

  // ---- profile ----
  ['profile /users/profile', 'GET', '/users/profile', 'patient', undefined, [200]],
  ['profile completeness', 'GET', '/users/profile/completeness', 'patient', undefined, [200]],
  ['user exists check', 'GET', `/users/exists?email=patient.test@careconnect.rw`, 'anon', undefined, [200]],
  ['patient profile', 'GET', '/patient/profile', 'patient', undefined, 'exists'],
  ['patient medical summary', 'GET', '/patient/medical-summary', 'patient', undefined, 'exists'],
  ['patient medical history', 'GET', '/patient/medical-history', 'patient', undefined, [200]],
  ['patient allergies', 'GET', '/patient/allergies', 'patient', undefined, [200]],
  ['patient medications', 'GET', '/patient/medications', 'patient', undefined, [200]],
  ['patient preferences', 'GET', '/patient/preferences', 'patient', undefined, [200]],

  // ---- doctors and provider ----
  ['public doctor search', 'GET', '/doctors/public/search', 'anon', undefined, 'exists'],
  ['public doctor profile', 'GET', `/doctors/public/${DOCTOR_ID}/profile`, 'anon', undefined, [200]],
  ['doctor record (any signed-in user)', 'GET', `/doctors/${DOCTOR_ID}`, 'patient', undefined, [200]],
  ['doctor stats (admin)', 'GET', `/doctors/${DOCTOR_ID}/stats`, 'admin', undefined, [200]],
  ['provider dashboard (doctor)', 'GET', '/provider/dashboard', 'doctor', undefined, [200]],
  ['doctor list (admin)', 'GET', '/doctors', 'admin', undefined, [200]],
  ['doctor patients via users list', 'GET', '/users/doctors', 'admin', undefined, [200]],
  ['doctor patient list (doctor)', 'GET', '/provider/patients', 'doctor', undefined, [200]],
  ['doctor patient search (doctor)', 'GET', '/provider/patients?search=test', 'doctor', undefined, [200]],
  ['doctor list with query-string paging (admin)', 'GET', '/doctors/?page=1&limit=10', 'admin', undefined, [200]],
  ['invoice list with query-string paging (patient)', 'GET', '/invoice/invoices?page=1&limit=5', 'patient', undefined, [200]],
  ['appointments list with query-string paging (admin)', 'GET', '/appointments?page=1&limit=5', 'admin', undefined, [200]],
  ['patient cannot use the doctor patient list', 'GET', '/provider/patients', 'patient', undefined, [403]],

  // ---- schedule and booking ----
  ['doctor availability', 'GET', `/schedule/doctors/${DOCTOR_ID}/availability`, 'anon', undefined, [200]],
  ['available slots', 'GET', `/schedule/slots/${DOCTOR_ID}/${TODAY}`, 'anon', undefined, [200]],
  ['appointment availability', 'GET', `/appointments/availability/${DOCTOR_ID}/${TODAY}`, 'anon', undefined, [200]],
  ['my appointments (patient)', 'GET', '/appointments/my-appointments', 'patient', undefined, [200]],
  ['doctor appointments (doctor)', 'GET', '/appointments/doctor-appointments', 'doctor', undefined, [200]],
  ['all appointments (admin)', 'GET', '/appointments', 'admin', undefined, [200]],
  ['one appointment (admin)', 'GET', `/appointments/${APPOINTMENT_ID}`, 'admin', undefined, [200]],
  ['booking validation (patient)', 'POST', '/appointments/book', 'patient', { doctorId: 'x' }, [400]],

  // ---- consultations and video ----
  ['consultation list (doctor)', 'GET', '/consultation/consultations', 'doctor', undefined, [200]],
  ['patient consultation history (doctor)', 'GET', `/consultation/consultations/patient/${PATIENT_ID}`, 'doctor', undefined, [200]],
  ['doctor consultations (doctor)', 'GET', `/consultation/consultations/doctor/${DOCTOR_ID}`, 'doctor', undefined, [200]],
  ['video join window (patient)', 'GET', `/consultation/appointments/${APPOINTMENT_ID}/join`, 'patient', undefined, 'exists'],

  // ---- invoices, payments, search ----
  ['patient invoices (patient)', 'GET', `/invoice/invoices/patient/${PATIENT_ID}`, 'patient', undefined, [200]],
  ['invoice list (patient)', 'GET', '/invoice/invoices', 'patient', undefined, [200]],
  ['invoice detail (patient)', 'GET', `/invoice/invoices/${INVOICE_ID}`, 'patient', undefined, [200]],
  ['invoice download (patient)', 'GET', `/invoice/invoices/${INVOICE_ID}/download`, 'patient', undefined, [200]],
  ['invoice refunds list (patient)', 'GET', `/invoice/invoices/${INVOICE_ID}/refunds`, 'patient', undefined, [200]],
  ['overdue invoices (admin)', 'GET', '/invoice/invoices/overdue', 'admin', undefined, [200]],
  ['payment status unknown ref', 'GET', `/payments/status/${FAKE_ID}`, 'patient', undefined, [404]],
  ['payment initiate (patient, Pesapal not configured)', 'POST', '/payments/initiate', 'patient', { invoiceId: INVOICE_ID }, 'exists'],
  ['search doctors', 'GET', '/search/doctors?term=a', 'patient', undefined, [200]],
  ['search appointments (admin)', 'GET', '/search/appointments', 'admin', undefined, [200]],
  ['search invoices (admin)', 'GET', '/search/invoices', 'admin', undefined, [200]],
  ['global search', 'GET', '/search/global?q=INV', 'patient', undefined, [200]],
  ['search suggestions', 'GET', '/search/suggestions?term=Te', 'patient', undefined, [200]],
  ['search history', 'GET', '/search/history', 'patient', undefined, [200]],

  // ---- sponsor ----
  ['sponsor dashboard', 'GET', '/sponsor/dashboard', 'sponsor', undefined, [200]],
  ['sponsor links', 'GET', '/sponsor/links', 'sponsor', undefined, [200]],
  ['sponsor link request (unknown email, generic)', 'POST', '/sponsor/links', 'sponsor', { patientEmail: 'nobody@example.test', relationship: 'other' }, [202]],
  ['sponsor link update (unknown link)', 'PATCH', `/sponsor/links/${FAKE_ID}`, 'sponsor', { status: 'revoked' }, [404]],

  // ---- admin ----
  ['admin user list', 'GET', '/admin/users', 'admin', undefined, [200]],
  ['admin user detail', 'GET', `/admin/users/${PATIENT_ID}`, 'admin', undefined, [200]],
  ['admin users search', 'GET', '/users/search?search=test', 'admin', undefined, [200]],
  ['admin users by type', 'GET', '/users/type/patient', 'admin', undefined, [200]],
  ['admin users stats', 'GET', '/users/stats', 'admin', undefined, [200]],
  ['admin user profile', 'GET', `/users/${PATIENT_ID}/profile`, 'admin', undefined, [200]],
  ['admin patient profile by user id', 'GET', `/patient/admin/${PATIENT_ID}/profile`, 'admin', undefined, [200]],
  ['doctor reads patient medical history', 'GET', `/patient/doctor/${PATIENT_ID}/medical-history`, 'doctor', undefined, [200]],
  ['admin metrics overview', 'GET', '/admin/metrics/overview', 'admin', undefined, [200]],
  ['admin audit logs', 'GET', '/admin/audit-logs', 'admin', undefined, [200]],
  ['admin dashboard', 'GET', '/admin/dashboard', 'admin', undefined, [200]],
  ['report: activity logs', 'GET', '/reports/admin/activity/logs', 'admin', undefined, 'exists'],
  ['report: appointments', 'GET', '/reports/admin/reports/appointments', 'admin', undefined, 'exists'],
  ['report: invoices', 'GET', '/reports/admin/reports/invoices', 'admin', undefined, 'exists'],
  ['report: financial', 'GET', '/reports/admin/reports/financial', 'admin', undefined, 'exists'],
  ['report: clinical', 'GET', '/reports/admin/reports/clinical', 'admin', undefined, 'exists'],
  ['report: user activity', 'GET', '/reports/admin/reports/user-activity', 'admin', undefined, 'exists'],
  ['report: system performance', 'GET', '/reports/admin/reports/system-performance', 'admin', undefined, 'exists'],
  ['facilities list', 'GET', '/admin/facilities', 'admin', undefined, [200]],
  ['facility settlement', 'GET', `/admin/facilities/${FAKE_ID}/settlement`, 'admin', undefined, [404]],
  ['refund queue', 'GET', '/admin/refunds', 'admin', undefined, [200]],
  ['reconciliation runs list', 'GET', '/admin/reconciliation/runs', 'admin', undefined, [200]],
  ['reconciliation run detail (unknown)', 'GET', `/admin/reconciliation/runs/${FAKE_ID}`, 'admin', undefined, [400]],
  ['misc specialties', 'GET', '/misc/specialties', 'anon', undefined, [200]],
  ['misc configuration', 'GET', '/misc/configuration', 'anon', undefined, [200]],

  // ---- access rules (must refuse) ----
  ['patient cannot read admin users', 'GET', '/admin/users', 'patient', undefined, [403]],
  ['doctor cannot open admin dashboard', 'GET', '/admin/dashboard', 'doctor', undefined, [403]],
  ['sponsor cannot open provider dashboard', 'GET', '/provider/dashboard', 'sponsor', undefined, [403]],
  ['anonymous cannot read sponsor dashboard', 'GET', '/sponsor/dashboard', 'anon', undefined, [401]],
];

for (const [label, method, path, role, body, expect] of probes) {
  const r = await call(method, path, tokens[role], body);
  if (expect === 'exists') {
    note(label, r.status !== 404 && r.status < 500, `${method} ${path} -> ${r.status}`);
  } else {
    note(label, expect.includes(r.status), `${method} ${path} -> ${r.status}, expected ${expect.join('|')}`);
  }
}

// PDF download must actually be a PDF.
{
  const r = await call('GET', `/invoice/invoices/${INVOICE_ID}/download`, tokens.patient);
  note('invoice download returns a PDF', r.contentType.includes('application/pdf'), r.contentType);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} endpoint checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
