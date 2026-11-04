import { config } from '../config/env';
import { PesapalClient } from '../services/pesapal.client';

// Registers PESAPAL_IPN_URL with Pesapal and prints the notification_id.
// Run once per environment (npm run pesapal:register-ipn), then put the printed value in PESAPAL_IPN_ID.
const run = async (): Promise<void> => {
  if (!config.pesapal.ipnUrl) {
    throw new Error('PESAPAL_IPN_URL is not set. Use the public HTTPS URL of /api/v1/payments/webhook/pesapal.');
  }

  if (config.pesapal.ipnId) {
    console.log(`PESAPAL_IPN_ID is already set (${config.pesapal.ipnId}). Register again only if the IPN URL changed.`);
  }

  const client = new PesapalClient();
  const ipnId = await client.registerIpn(config.pesapal.ipnUrl);

  console.log(`Registered ${config.pesapal.ipnUrl} with Pesapal (${config.pesapal.environment}).`);
  console.log(`Set this in .env:\nPESAPAL_IPN_ID=${ipnId}`);
};

run().catch((error) => {
  console.error('Pesapal IPN registration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
