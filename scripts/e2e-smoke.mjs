// End-to-end smoke test for the combined stack.
// Needs the stack running (docker compose up) and seed data (docker compose run --rm api node dist/db/seed.js).
//
//   API_URL=http://localhost:3000 WEB_URL=http://localhost:3001 \
//   APPOINTMENT_ID=... INVOICE_ID=... PATIENT_ID=... \
//   node scripts/e2e-smoke.mjs
//
// Socket.IO check needs socket.io-client (devDependency): npm install

import { io } from 'socket.io-client';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://localhost:3001';
const V1 = `${API}/api/v1`;
const { APPOINTMENT_ID, INVOICE_ID, PATIENT_ID } = process.env;
if (!APPOINTMENT_ID || !INVOICE_ID || !PATIENT_ID) {
  console.error('Set APPOINTMENT_ID, INVOICE_ID and PATIENT_ID (from the seed output).');
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const call = async (method, path, { token, body, headers = {} } = {}) => {
  const response = await fetch(`${V1}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json, headers: response.headers };
};

const login = async (email, password) => {
  const { status, json } = await call('POST', '/auth/login', { body: { email, password } });
  return status === 200 ? json.data.accessToken : null;
};

const waitFor = (socket, event, ms = 5000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${event}`)), ms);
    socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
  });

const main = async () => {
  // ── Health and web ───────────────────────────────────────────────────────────
  const health = await fetch(`${API}/health`).then((r) => r.status).catch(() => 0);
  check('API health is 200', health === 200, `status ${health}`);

  const web = await fetch(WEB).then((r) => r.status).catch(() => 0);
  check('web app responds', web === 200, `status ${web}`);

  const cors = await fetch(`${API}/health`, { headers: { Origin: WEB } });
  check('CORS allows the web origin', cors.headers.get('access-control-allow-origin') === WEB, cors.headers.get('access-control-allow-origin') ?? 'none');

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const patientToken = await login('patient.test@careconnect.rw', 'TestPatient#2026');
  const doctorToken = await login('doctor.test@careconnect.rw', 'TestDoctor#2026');
  check('seeded patient can log in', Boolean(patientToken));
  check('seeded doctor can log in', Boolean(doctorToken));
  if (!patientToken || !doctorToken) return;

  const reg = await call('POST', '/auth/register', {
    body: { email: `stranger.${Date.now()}@example.com`, password: 'Stranger#2026', userType: 'patient', phoneNumber: `+2507${Math.floor(10000000 + Math.random() * 89999999)}`, firstName: 'Other', lastName: 'Patient' },
  });
  check('register returns no password hash', reg.status === 201 && !JSON.stringify(reg.json).includes('passwordHash'), `status ${reg.status}`);
  const strangerToken = await login(reg.json.data?.email ?? '', 'Stranger#2026');

  // ── Invoice ownership ────────────────────────────────────────────────────────
  const own = await call('GET', `/invoice/invoices/patient/${PATIENT_ID}`, { token: patientToken });
  check('patient sees own invoices', own.status === 200, `status ${own.status}`);

  const otherPatients = strangerToken ? await call('GET', `/invoice/invoices/patient/${PATIENT_ID}`, { token: strangerToken }) : { status: 0 };
  check('other patient cannot list these invoices (403)', otherPatients.status === 403, `status ${otherPatients.status}`);

  const otherInvoice = strangerToken ? await call('GET', `/invoice/invoices/${INVOICE_ID}`, { token: strangerToken }) : { status: 0 };
  check('other patient cannot read this invoice (403)', otherInvoice.status === 403, `status ${otherInvoice.status}`);

  const patientPay = await call('POST', `/invoice/invoices/${INVOICE_ID}/pay`, { token: patientToken, body: { paymentMethod: 'cash' } });
  check('patient cannot mark an invoice paid manually (403)', patientPay.status === 403, `status ${patientPay.status}`);

  // ── Payments (Pesapal) ───────────────────────────────────────────────────────
  const initiate = await call('POST', '/payments/initiate', { token: patientToken, body: { invoiceId: INVOICE_ID } });
  const pesapalConfigured = Boolean(process.env.PESAPAL_CONFIGURED);
  if (pesapalConfigured) {
    check('payment initiate returns a Pesapal redirect', initiate.status === 201 && Boolean(initiate.json.data?.redirectUrl), `status ${initiate.status}`);
  } else {
    check('payment initiate refuses cleanly without Pesapal keys', initiate.status >= 400 && initiate.status < 500, `status ${initiate.status}: ${initiate.json.error?.message ?? ''}`);
  }

  const ipn = await fetch(`${V1}/payments/webhook/pesapal`);
  check('Pesapal IPN endpoint answers with a receipt', ipn.status === 200 || ipn.status === 400, `status ${ipn.status}`);

  // ── Video: join rules and signalling ─────────────────────────────────────────
  const joinPatient = await call('GET', `/consultation/appointments/${APPOINTMENT_ID}/join`, { token: patientToken });
  check('patient gets a join token inside the window', joinPatient.status === 200 && Boolean(joinPatient.json.data?.joinToken), `status ${joinPatient.status}`);

  const joinDoctor = await call('GET', `/consultation/appointments/${APPOINTMENT_ID}/join`, { token: doctorToken });
  check('doctor gets a join token marked as owner', joinDoctor.status === 200 && joinDoctor.json.data?.isOwner === true, `status ${joinDoctor.status}`);

  const joinStranger = strangerToken ? await call('GET', `/consultation/appointments/${APPOINTMENT_ID}/join`, { token: strangerToken }) : { status: 0 };
  check('stranger cannot join the call (403)', joinStranger.status === 403, `status ${joinStranger.status}`);

  if (joinPatient.json.data && joinDoctor.json.data) {
    const iceOk = joinPatient.json.data.iceServers?.some((s) => String(s.urls).startsWith('turn')) && joinPatient.json.data.iceServers?.some((s) => String(s.urls).startsWith('stun'));
    check('join response includes STUN and TURN servers', Boolean(iceOk));

    const doctorSocket = io(`${API}/video`, { path: '/socket.io', transports: ['websocket'], auth: { token: joinDoctor.json.data.joinToken }, reconnection: false });
    let patientSocket;
    try {
      await waitFor(doctorSocket, 'joined');
      // Open the patient socket only after the doctor is in the room, so the listener below is ready.
      const peer = waitFor(doctorSocket, 'peer-joined');
      patientSocket = io(`${API}/video`, { path: '/socket.io', transports: ['websocket'], auth: { token: joinPatient.json.data.joinToken }, reconnection: false });
      await waitFor(patientSocket, 'joined');
      const arrived = await peer;
      check('doctor is told the patient joined', arrived.role === 'patient');

      const relayed = waitFor(patientSocket, 'signal');
      doctorSocket.emit('signal', { description: { type: 'offer', sdp: 'e2e' } });
      const signal = await relayed;
      check('offer relays from doctor to patient', signal.description?.type === 'offer');
    } catch (error) {
      check('video signalling round trip', false, error.message);
    } finally {
      doctorSocket.close();
      patientSocket?.close();
    }
  }

  // ── Email webhook and password reset ─────────────────────────────────────────
  const badHook = await call('POST', '/webhooks/resend', { body: { type: 'email.bounced', data: { to: ['x@example.com'] } }, headers: { 'svix-id': 'x', 'svix-timestamp': String(Math.floor(Date.now() / 1000)), 'svix-signature': 'v1,AAAA' } });
  check('Resend webhook rejects unsigned events', badHook.status === 400 || badHook.status === 503, `status ${badHook.status}`);

  const reset = await call('POST', '/auth/forgot-password', { body: { email: 'patient.test@careconnect.rw' } });
  check('forgot-password responds 200', reset.status === 200, `status ${reset.status}`);

  // ── Search ───────────────────────────────────────────────────────────────────
  const search = await call('GET', '/search/doctors', { token: patientToken });
  check('doctor search works for patients', search.status === 200, `status ${search.status}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
};

main().catch((error) => {
  console.error('E2E run crashed:', error);
  process.exit(1);
});
