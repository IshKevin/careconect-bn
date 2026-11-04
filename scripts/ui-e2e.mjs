// Browser check of the frontend against the running API.
// Drives Chromium through each role's screens, signs up a sponsor, and records every failed API call
// and every console error. Run inside the Playwright image (see docs/roadmap/06-founder-response-2026-11.md):
//
//   docker run --rm --network host -v "$PWD/scripts:/work" -w /work mcr.microsoft.com/playwright:v1.49.1-noble \
//     sh -c "npm i --no-save --silent playwright-core@1.49.1 && node ui-e2e.mjs"
//
// Needs the frontend on FRONTEND_URL (default http://localhost:3001) and the API on localhost:3000.

import { chromium } from 'playwright-core';

const FE = process.env.FRONTEND_URL ?? 'http://localhost:3001';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await chromium.launch({ headless: true });

// Per-page diagnostics: failed API calls and console errors.
const problems = [];
const newContext = async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); // phone width
  return context;
};
const watch = (page, label) => {
  page.on('response', (r) => {
    if (r.url().includes('/api/v1/') && r.status() >= 400) {
      problems.push(`${label}: ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
    }
  });
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon|Download the React DevTools/.test(m.text())) {
      problems.push(`${label}: console: ${m.text().slice(0, 160)}`);
    }
  });
  page.on('pageerror', (e) => problems.push(`${label}: uncaught: ${e.message.slice(0, 160)}`));
};

const login = async (page, email, password) => {
  await page.goto(`${FE}/login`, { waitUntil: 'load' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
};

// Opens each route and checks it renders without an error screen or a bounce to login.
const visit = async (page, role, routes) => {
  for (const route of routes) {
    problems.length = 0;
    await page.goto(`${FE}${route}`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const url = new URL(page.url());
    const body = (await page.textContent('body').catch(() => '')) ?? '';
    const bounced = url.pathname === '/login' && !route.startsWith('/login');
    const crashed = /Application error|Unhandled Runtime Error/.test(body);
    check(`${role} ${route} renders`, !bounced && !crashed && url.pathname === route, `${url.pathname}${bounced ? ' (bounced to login)' : ''}`);
    if (problems.length) check(`${role} ${route} has no API or console errors`, false, problems.slice(0, 3).join(' | '));
  }
};

// ---------- Patient ----------
{
  const ctx = await newContext();
  const page = await ctx.newPage();
  watch(page, 'patient');
  await login(page, 'patient.test@careconnect.rw', 'TestPatient#2026');
  await page.waitForURL('**/patient', { timeout: 20000 }).catch(() => {});
  check('patient login lands on /patient', new URL(page.url()).pathname === '/patient', page.url());
  await visit(page, 'patient', [
    '/patient', '/patient/appointments', '/patient/invoices', '/patient/medical-history',
    '/patient/allergies', '/patient/medications', '/patient/preferences', '/patient/profile',
    '/patient/sponsors', '/patient/search', '/patient/messages',
  ]);
  await ctx.close();
}

// ---------- Doctor ----------
{
  const ctx = await newContext();
  const page = await ctx.newPage();
  watch(page, 'doctor');
  await login(page, 'doctor.test@careconnect.rw', 'TestDoctor#2026');
  await page.waitForURL('**/doctor', { timeout: 20000 }).catch(() => {});
  check('doctor login lands on /doctor', new URL(page.url()).pathname === '/doctor', page.url());
  await page.waitForTimeout(3000);
  const welcomeCount = await page.getByText(/Welcome|practice at a glance/).count();
  check('doctor dashboard shows provider metrics', welcomeCount > 0, `matches: ${welcomeCount}`);
  await visit(page, 'doctor', [
    '/doctor', '/doctor/appointments', '/doctor/patients', '/doctor/schedule', '/doctor/consultations',
    '/doctor/invoices', '/doctor/profile', '/doctor/search/patients',
  ]);
  await ctx.close();
}

// ---------- Admin ----------
{
  const ctx = await newContext();
  const page = await ctx.newPage();
  watch(page, 'admin');
  await login(page, 'admin.test@careconnect.rw', 'TestAdmin#2026');
  await page.waitForURL('**/admin', { timeout: 20000 }).catch(() => {});
  check('admin login lands on /admin', new URL(page.url()).pathname === '/admin', page.url());
  const metrics = await page.getByText('Operations dashboard').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check('admin metrics dashboard renders', metrics);
  await visit(page, 'admin', [
    '/admin', '/admin/users', '/admin/doctors', '/admin/appointments', '/admin/reports',
    '/admin/audit-logs', '/admin/settings', '/admin/profile', '/admin/facilities', '/admin/refunds',
    '/admin/reconciliation',
  ]);

  // Facility creation through the form (unique registration number per run).
  await page.goto(`${FE}/admin/facilities`, { waitUntil: 'load' });
  const reg = `UI-${Date.now().toString(36)}`;
  await page.fill('#f-name', `UI Test Clinic ${reg}`);
  await page.fill('#f-reg', reg);
  await page.click('button:has-text("Register facility")');
  const created = await page.getByText(`UI Test Clinic ${reg}`).first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check('admin registers a facility from the form', created);

  // Reconciliation run from the button.
  await page.goto(`${FE}/admin/reconciliation`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Run reconciliation")');
  const ran = await page.getByText(/Run complete|finding\(s\)/).first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  check('admin runs reconciliation from the button', ran);

  await ctx.close();
}

// ---------- Sponsor: sign up through the form, then sign in ----------
const sponsorEmail = `ui.sponsor.${Date.now().toString(36)}@example.test`;
{
  const ctx = await newContext();
  const page = await ctx.newPage();
  watch(page, 'sponsor-signup');
  await page.goto(`${FE}/register`, { waitUntil: 'load' });
  await page.check('input[name="userType"][value="sponsor"]');
  await page.fill('input[name="firstName"]', 'Uma');
  await page.fill('input[name="lastName"]', 'Sponsor');
  await page.fill('input[name="phoneNumber"]', `+2507${String(Math.floor(10000000 + Math.random() * 89999999))}`);
  await page.fill('input[name="email"]', sponsorEmail);
  await page.fill('input[name="password"]', 'Sponsor#2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  const registerError = await page.getByText(/already exists|failed|invalid/i).first().isVisible().catch(() => false);
  check('sponsor can register from the form (no error shown)', !registerError);
  await ctx.close();
}
{
  const ctx = await newContext();
  const page = await ctx.newPage();
  watch(page, 'sponsor');
  await login(page, sponsorEmail, 'Sponsor#2026');
  await page.waitForURL('**/sponsor', { timeout: 20000 }).catch(() => {});
  check('sponsor login lands on /sponsor', new URL(page.url()).pathname === '/sponsor', page.url());
  const banner = await page.getByText('Verify your email address to book appointments').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check('unverified sponsor sees the verification banner', banner);
  await visit(page, 'sponsor', ['/sponsor', '/sponsor/links']);

  // Link request through the form: generic reply, no account lookup.
  await page.goto(`${FE}/sponsor/links`, { waitUntil: 'load' });
  await page.fill('#patient-email', 'patient.test@careconnect.rw');
  await page.click('button:has-text("Send request")');
  const toldToVerify = await page.getByText(/verify your email address before/i).first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  check('unverified sponsor is told to verify before linking', toldToVerify);
  await ctx.close();
}

// ---------- Email verification page ----------
{
  const ctx = await newContext();
  const page = await ctx.newPage();
  await page.goto(`${FE}/verify-email?token=not-a-real-token`, { waitUntil: 'load' });
  const failed = await page.getByText(/invalid or expired|invalid or has expired|expired/i).first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  check('verify-email shows an error for a bad token', failed && !new URL(page.url()).pathname.startsWith('/login'), page.url());
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} UI checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
