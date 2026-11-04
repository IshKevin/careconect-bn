// Refund workflow check: maker-checker approval, amount limits, manual processing, and invoice status.
// Pesapal sandbox cannot produce a completed payment here, so this script records one directly in the
// database (as a completed Pesapal payment would be recorded), then runs the admin flow over the API.
//
// Run once against a freshly seeded database. It needs an unpaid seeded invoice.
//   docker compose run --rm --no-deps -v "$PWD/scripts:/app/scripts" -e INVOICE_ID=... api node scripts/refund-flow-smoke.mjs

import pg from 'pg';
import { randomUUID } from 'crypto';

const API = process.env.API_URL ?? 'http://api:3000';
const V1 = `${API}/api/v1`;
const { INVOICE_ID } = process.env;
if (!INVOICE_ID) {
  console.error('Set INVOICE_ID (an unpaid seeded invoice).');
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

const login = async (email, password) => {
  const { status, json } = await call('POST', '/auth/login', { body: { email, password } });
  if (status !== 200) throw new Error(`login failed for ${email}: ${status}`);
  return json.data.accessToken;
};

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows: invoiceRows } = await db.query('select patient_id, invoice_status, total_amount from invoices where invoice_id = $1', [INVOICE_ID]);
if (invoiceRows.length === 0 || invoiceRows[0].invoice_status !== 'pending') {
  console.error('INVOICE_ID must be an existing pending invoice (run against a freshly seeded database).');
  await db.end();
  process.exit(2);
}
const { patient_id: patientId, total_amount: total } = invoiceRows[0];

// Record a completed payment for the invoice, as the Pesapal IPN path would, and mark the invoice paid.
const txId = randomUUID();
await db.query(
  `insert into payment_transactions (id, tx_ref, invoice_id, patient_id, provider, amount, currency, status, confirmation_code, completed_at)
   values ($1, $2, $3, $4, 'pesapal', $5, 'RWF', 'completed', 'SMOKE-CONF', now())`,
  [txId, `smoke-${txId}`, INVOICE_ID, patientId, total],
);
await db.query("update invoices set invoice_status = 'paid', paid_at = now() where invoice_id = $1", [INVOICE_ID]);

const adminOne = await login('admin.test@careconnect.rw', 'TestAdmin#2026');
const adminTwo = await login('admin2.test@careconnect.rw', 'TestAdmin#2026');
const patient = await login('patient.test@careconnect.rw', 'TestPatient#2026');
const total2dp = Math.round(Number(total) * 100);
const first = Math.min(100000, total2dp); // 1,000.00 or less if the invoice is smaller

// 1. Request: a patient cannot, an admin can, and the amount is limited to what was paid.
{
  const r = await call('POST', `/invoice/invoices/${INVOICE_ID}/refunds`, { token: patient, body: { amount: 10, reason: 'Patient asks' } });
  check('patient cannot request a refund', r.status === 403, `status ${r.status}`);
}
{
  const r = await call('POST', `/invoice/invoices/${INVOICE_ID}/refunds`, { token: adminOne, body: { amount: total2dp / 100 + 1, reason: 'Too much money' } });
  check('refund above the paid amount is refused', r.status === 400, `status ${r.status}`);
}
let refundA;
{
  const r = await call('POST', `/invoice/invoices/${INVOICE_ID}/refunds`, { token: adminOne, body: { amount: first / 100, reason: 'Duplicate charge' } });
  refundA = r.json?.data;
  check('admin requests a partial refund (pending)', r.status === 201 && refundA?.status === 'pending', `status ${r.status}`);
}

// 2. Maker-checker: the requester cannot approve their own refund.
if (refundA) {
  const r = await call('POST', `/refunds/${refundA.refundId}/decision`, { token: adminOne, body: { decision: 'approve' } });
  check('requesting admin cannot approve their own refund', r.status === 403, `status ${r.status}`);
}
if (refundA) {
  const r = await call('POST', `/refunds/${refundA.refundId}/decision`, { token: adminTwo, body: { decision: 'approve', note: 'Verified duplicate' } });
  check('second admin approves; processing is manual (Pesapal refunds disabled)', r.status === 200 && r.json?.data?.status === 'approved' && r.json?.data?.processing === 'manual', `status ${r.status} ${r.json?.data?.status}`);
}
if (refundA) {
  const r = await call('POST', `/refunds/${refundA.refundId}/mark-processed`, { token: adminOne, body: { note: 'Refunded in Pesapal dashboard' } });
  check('approved refund is marked processed by hand', r.status === 200 && r.json?.data?.status === 'processed', `status ${r.status}`);
}
{
  const r = await call('GET', `/invoice/invoices/${INVOICE_ID}`, { token: adminOne });
  check('invoice stays paid after a partial refund', r.json?.data?.invoiceStatus === 'paid', `status ${r.json?.data?.invoiceStatus}`);
}

// 3. Remaining amount: anything above what is left is refused.
const remaining = total2dp - first;
{
  const r = await call('POST', `/invoice/invoices/${INVOICE_ID}/refunds`, { token: adminOne, body: { amount: remaining / 100 + 0.01, reason: 'Over the remaining amount' } });
  check('refund above the remaining amount is refused', r.status === 400, `status ${r.status}`);
}

// 4. Rejection path: a rejected refund releases its reserved amount and cannot be approved later.
let refundB;
{
  const r = await call('POST', `/invoice/invoices/${INVOICE_ID}/refunds`, { token: adminOne, body: { amount: 5, reason: 'Small adjustment' } });
  refundB = r.json?.data;
  check('admin requests a small refund', r.status === 201, `status ${r.status}`);
}
if (refundB) {
  const r = await call('POST', `/refunds/${refundB.refundId}/decision`, { token: adminTwo, body: { decision: 'reject', note: 'Not supported by the records' } });
  check('second admin can reject a refund', r.status === 200 && r.json?.data?.status === 'rejected', `status ${r.status}`);
}
{
  const r = await call('POST', `/refunds/${refundB?.refundId ?? '00000000-0000-4000-8000-000000000000'}/decision`, { token: adminTwo, body: { decision: 'approve' } });
  check('a rejected refund cannot be approved afterwards', r.status === 409, `status ${r.status}`);
}

// 5. The exact remaining amount, approved and processed, makes the invoice refunded.
let refundC;
if (remaining > 0) {
  const r = await call('POST', `/invoice/invoices/${INVOICE_ID}/refunds`, { token: adminOne, body: { amount: remaining / 100, reason: 'Full remaining refund' } });
  refundC = r.json?.data;
  check('admin requests the remaining amount', r.status === 201, `status ${r.status}`);
}
if (refundC) {
  await call('POST', `/refunds/${refundC.refundId}/decision`, { token: adminTwo, body: { decision: 'approve' } });
  const r = await call('POST', `/refunds/${refundC.refundId}/mark-processed`, { token: adminTwo });
  check('remaining refund processed', r.status === 200 && r.json?.data?.status === 'processed', `status ${r.status}`);
}
{
  const r = await call('GET', `/invoice/invoices/${INVOICE_ID}`, { token: adminOne });
  check('invoice becomes refunded once everything is refunded', r.json?.data?.invoiceStatus === 'refunded', `status ${r.json?.data?.invoiceStatus}`);
}

// 5. Refund history is visible to the patient, and the admin queue shows the refund.
{
  const r = await call('GET', `/invoice/invoices/${INVOICE_ID}/refunds`, { token: patient });
  check('patient can see refund history for their invoice', r.status === 200 && Array.isArray(r.json?.data) && r.json.data.length >= 3, `status ${r.status}`);
}
{
  const r = await call('GET', '/admin/refunds?status=rejected', { token: adminOne });
  check('admin refund queue filters by status', r.status === 200 && r.json.data.some((x) => x.refundId === refundB?.refundId), `status ${r.status}`);
}

await db.end();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
