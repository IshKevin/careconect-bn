# Deployment: Coolify (production)

Written for: whoever deploys and runs the IsanoMed backend on the Coolify server.

## 1. Overview

| Item | Value |
|---|---|
| API | `https://api.isanomed.org` (health: `/health`, API base: `/api/v1`) |
| Video relay (TURN over TLS) | `turn.isanomed.org`, port 443 |
| Server public IP | `197.243.27.200` (behind NAT; only ports 80 and 443 reach it) |
| DNS host | Hostinger |
| Email sender | `no-reply@isanomed.org` (Resend) |
| Payments | Pesapal |

The stack is the repository's `docker-compose.yml`:

| Service | Role | Public? |
|---|---|---|
| `db` | Postgres 16 | No |
| `migrate` | Applies migrations, then exits | No |
| `api` | Express API and video signalling (Socket.IO) | Yes, through the Coolify domain |
| `coturn` | TURN relay for video | Yes, through its own Traefik labels on 443 |

Other projects share the server. The compose file only adds routes for its own host names (`api.isanomed.org` from Coolify, `turn.isanomed.org` from coturn's labels), and its router names start with `isanomed-`, so it does not affect them. No server-wide proxy configuration is needed.

## 2. DNS records (Hostinger)

| Type | Name | Value | For |
|---|---|---|---|
| A | `api` | `197.243.27.200` | API |
| A | `turn` | `197.243.27.200` | Video relay |
| TXT | `resend._domainkey` | DKIM key shown by Resend | Email signing |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` (priority 10) | Email bounces |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | Email sender authorisation |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | Email reports |

Copy the email records from the Resend dashboard; the values above show their usual shape for the `eu-west-1` region.

`support@isanomed.org` (the reply-to address) needs a real mailbox, for example Hostinger email. Until then, set `RESEND_REPLY_TO` to an address that receives mail.

## 3. Coolify setup

1. Create a Docker Compose resource from the repository; Coolify uses `docker-compose.yml`.
2. Assign the domain `https://api.isanomed.org` to the **api** service, port 3000.
3. Do **not** assign a domain to **coturn**. Its labels route `VIDEO_TURN_DOMAIN` on port 443 and request its certificate.
4. Do not assign domains to **db** or **migrate**.
5. Paste the environment variables (section 4) and deploy.

coturn joins the proxy's shared Docker network (`coolify`) so Traefik can always reach it. If the proxy uses a different network, set `PROXY_NETWORK`.

## 4. Environment variables

Start from `.env.example`; it lists every variable with a comment. Values specific to production:

```
NODE_ENV=production
FRONTEND_URL=https://<web app domain>
CORS_ORIGIN=https://<web app domain>
POSTGRES_PASSWORD=<long random value>

PESAPAL_ENVIRONMENT=production            # sandbox while testing
PESAPAL_IPN_URL=https://api.isanomed.org/api/v1/payments/webhook/pesapal
PESAPAL_IPN_ID=<printed by the registration step, section 6>
PESAPAL_CALLBACK_URL=https://<web app domain>/patient/invoices/return

RESEND_API_KEY=re_...
RESEND_FROM_ADDRESS=IsanoMed <no-reply@isanomed.org>
RESEND_REPLY_TO=support@isanomed.org
RESEND_WEBHOOK_SECRET=whsec_...

VIDEO_TURN_SECRET=<openssl rand -hex 32>
VIDEO_PUBLIC_IP=197.243.27.200
VIDEO_TURN_DOMAIN=turn.isanomed.org
VIDEO_STUN_URLS=
VIDEO_TURN_URLS=turns:turn.isanomed.org:443?transport=tcp
```

Generate the JWT secrets, `ENCRYPTION_KEY` and `VIDEO_TURN_SECRET` with `openssl` as described at the top of `.env.example`.

With `NODE_ENV=production` the API refuses to start if any of these are missing: `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, `PESAPAL_IPN_ID`, `PESAPAL_IPN_URL`, `PESAPAL_CALLBACK_URL`, `RESEND_API_KEY`, `VIDEO_TURN_SECRET`.

## 5. Resend

1. **Domains → Add Domain:** `isanomed.org`, region `eu-west-1`. Add the records it shows (section 2) and wait until it says Verified.
2. **API Keys → Create:** permission "Sending access", domain `isanomed.org`. Put it in `RESEND_API_KEY`.
3. **Webhooks → Add Endpoint:**
   - URL: `https://api.isanomed.org/api/v1/webhooks/resend`
   - Events: `email.bounced`, `email.complained`
   - Put the signing secret (`whsec_...`) in `RESEND_WEBHOOK_SECRET`.

Without the webhook secret the API still runs, but bounce and complaint events are refused and those addresses are not suppressed.

## 6. Pesapal notification (IPN) registration

Pesapal must know the IPN URL, and registration returns the `PESAPAL_IPN_ID`. Register again whenever `PESAPAL_IPN_URL` changes (for example after a domain change); the old ID keeps pointing at the old URL.

In Coolify, open the terminal of the **api** container and run:

```bash
NODE_ENV=development node dist/scripts/register-pesapal-ipn.js
```

`NODE_ENV=development` is needed only for this command, because production startup refuses to run while `PESAPAL_IPN_ID` is still empty. Copy the printed `PESAPAL_IPN_ID` into Coolify and redeploy.

## 7. Checks after each deploy

```bash
# From any machine
curl https://api.isanomed.org/health          # 200, "environment":"production"

# In the api container terminal
node dist/scripts/check-integrations.js       # reports Pesapal, Resend and video readiness
```

Video relay: the TURN certificate is issued on the first connection to `turn.isanomed.org` and can take about a minute. To check it:

```bash
echo | openssl s_client -connect turn.isanomed.org:443 -servername turn.isanomed.org 2>/dev/null | openssl x509 -noout -issuer
# expected: a Let's Encrypt issuer, not "TRAEFIK DEFAULT CERT"
```

If it still shows the Traefik default certificate, check on the server:

```bash
docker inspect $(docker ps -q --filter name=coturn) --format '{{json .Config.Labels}}' | tr ',' '\n' | grep traefik
docker logs coolify-proxy 2>&1 | grep -iE "isanomed-turn|turn\.isanomed" | tail -20
```

## 8. Do not

- Run the seed script in production. It refuses unless `ALLOW_SEED=true`, and it creates test accounts with known passwords.
- Publish `db`, `api` or `coturn` ports to the internet. They are bound to `127.0.0.1` on purpose; traffic goes through the proxy.
- Commit `.env` files or paste secrets into issues and chat.
