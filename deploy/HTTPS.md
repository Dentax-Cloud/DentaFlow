# HTTPS on dentax.cloud

Production TLS is terminated by **nginx on the VPS host**, which reverse-proxies to the Docker web container on `127.0.0.1:3100`.

## Prerequisites

1. DNS **must** resolve before running certbot:
   ```bash
   dig dentax.cloud +short
   dig www.dentax.cloud +short
   ```
   Both must return your VPS public IP (e.g. `145.223.90.247`).

2. `.env.production` on the VPS:
   ```bash
   NEXTAUTH_URL=https://dentax.cloud
   NEXT_PUBLIC_APP_URL=https://dentax.cloud
   WEB_PORT=3100
   ```

3. Web container bound to localhost only (`docker-compose.prod.yml`):
   ```yaml
   ports:
     - "127.0.0.1:3100:3000"
   ```

## One-time setup (on VPS)

```bash
cd /opt/DentaFlow
git pull
chmod +x deploy/setup-https.sh scripts/backup-db.sh scripts/restore-db.sh

sudo CERTBOT_EMAIL=admin@dentax.cloud \
     APP_PORT=3100 \
     EXPECTED_IP=145.223.90.247 \
     ./deploy/setup-https.sh

docker compose -f docker-compose.prod.yml up -d --build
```

Certbot installs a **systemd timer** for renewal. Confirm:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

## Verification

| Check | Command |
|-------|---------|
| TLS | Open `https://dentax.cloud` — valid padlock |
| Health | `curl -fsS https://dentax.cloud/api/health` |
| DB down | `docker stop dentaflow-db` → health returns **503** → `docker start dentaflow-db` |
| Login/logout | Manual test on HTTPS domain |
| Webcam | Photo capture requires HTTPS (should work after TLS) |
| Pusher | Uses `wss://` via Pusher CDN — no app changes needed |
| Stripe | Update dashboard webhook URL to `https://dentax.cloud/api/stripe/webhook` if still on old IP |

## Backups

See [BACKUP.md](./BACKUP.md).
