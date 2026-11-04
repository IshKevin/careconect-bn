import { config } from '../config/env';
import { closeConnection, healthCheck } from '../config/database';
import { PesapalClient } from '../services/pesapal.client';

// Reports which external integrations are ready. Run after adding keys to .env: npm run check:integrations
// Live calls are made only for keys that are set. Exit code 1 means something needed is missing or rejected.

type Status = 'ok' | 'warn' | 'missing' | 'error';

interface CheckResult {
  name: string;
  status: Status;
  detail: string;
}

const results: CheckResult[] = [];
const add = (name: string, status: Status, detail: string): void => {
  results.push({ name, status, detail });
};

const checkDatabase = async (): Promise<void> => {
  const health = await healthCheck();
  if (health.status === 'healthy') {
    add('Database', 'ok', `reachable (${health.latency} ms)`);
  } else {
    add('Database', 'error', health.error ?? 'unreachable');
  }
};

const checkPesapal = async (): Promise<void> => {
  const { consumerKey, consumerSecret, ipnId, ipnUrl, callbackUrl, environment } = config.pesapal;
  if (!consumerKey || !consumerSecret) {
    add('Pesapal', 'missing', 'PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET are not set');
    return;
  }

  try {
    await new PesapalClient().getToken();
  } catch (error) {
    add('Pesapal', 'error', `token request failed (${environment}): ${error instanceof Error ? error.message : error}`);
    return;
  }

  const missing = [!ipnId && 'PESAPAL_IPN_ID (run npm run pesapal:register-ipn)', !ipnUrl && 'PESAPAL_IPN_URL', !callbackUrl && 'PESAPAL_CALLBACK_URL'].filter(Boolean);
  if (missing.length > 0) {
    add('Pesapal', 'warn', `token OK (${environment}); still missing ${missing.join(', ')}`);
  } else {
    add('Pesapal', 'ok', `token OK (${environment}), IPN and callback set`);
  }
};

const checkResend = async (): Promise<void> => {
  const apiKey = config.email.resendApiKey;
  if (!apiKey) {
    add('Resend', 'missing', 'RESEND_API_KEY is not set (emails are logged and not sent)');
    return;
  }

  const response = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    add('Resend', 'error', `API key rejected: HTTP ${response.status}`);
    return;
  }

  const body = (await response.json()) as { data?: Array<{ name: string; status: string }> };
  const fromDomain = config.email.fromAddress.match(/@([^>\s]+)/)?.[1]?.toLowerCase();
  const domain = body.data?.find((item) => item.name.toLowerCase() === fromDomain);

  if (!domain) {
    add('Resend', 'warn', `key OK, but ${fromDomain ?? 'the sender domain'} is not added to Resend`);
  } else if (domain.status !== 'verified') {
    add('Resend', 'warn', `key OK, domain ${domain.name} status is "${domain.status}" (DNS not verified yet)`);
  } else {
    add('Resend', 'ok', `key OK, sender domain ${domain.name} verified`);
  }

  if (!config.email.webhookSecret) {
    add('Resend webhook', 'warn', 'RESEND_WEBHOOK_SECRET not set: bounce and complaint events are rejected');
  } else {
    add('Resend webhook', 'ok', 'signing secret set');
  }
};

const checkVideo = (): void => {
  const secret = config.video.turnSecret;
  if (!secret) {
    add('Video (TURN)', 'missing', 'VIDEO_TURN_SECRET is not set: video joins will fail');
  } else {
    add('Video (TURN)', 'ok', `secret set (${config.video.turnUrls.join(', ')}); coturn must use the same secret`);
  }
};

const print = (): void => {
  const icon: Record<Status, string> = { ok: 'OK     ', warn: 'WARN   ', missing: 'MISSING', error: 'ERROR  ' };
  console.log('\nIntegration readiness (' + config.env + ')\n');
  for (const result of results) {
    console.log(`${icon[result.status]} ${result.name.padEnd(15)} ${result.detail}`);
  }
  console.log('');
};

const run = async (): Promise<void> => {
  await checkDatabase();
  checkVideo();
  await checkPesapal();
  await checkResend();
  print();

  const failed = results.some((result) => result.status === 'error' || result.status === 'missing');
  if (failed) process.exitCode = 1;
};

run()
  .catch((error) => {
    console.error('Integration check crashed:', error);
    process.exitCode = 1;
  })
  .finally(() => closeConnection());
