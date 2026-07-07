#!/usr/bin/env bash
# Install nginx + Let's Encrypt for dentax.cloud on the VPS host.
# Run as root on the VPS AFTER DNS points to this server's public IP.
#
# Usage:
#   sudo CERTBOT_EMAIL=you@example.com APP_PORT=3100 EXPECTED_IP=145.223.90.247 ./deploy/setup-https.sh
#
set -euo pipefail

DOMAIN="${DOMAIN:-dentax.cloud}"
WWW="${WWW_DOMAIN:-www.dentax.cloud}"
APP_PORT="${APP_PORT:-3100}"
EXPECTED_IP="${EXPECTED_IP:-145.223.90.247}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

if [ -z "$CERTBOT_EMAIL" ]; then
  echo "Set CERTBOT_EMAIL for Let's Encrypt expiry notices." >&2
  echo "Example: sudo CERTBOT_EMAIL=admin@dentax.cloud $0" >&2
  exit 1
fi

resolve_domain() {
  if command -v dig >/dev/null 2>&1; then
    dig +short "$1" A | tail -1
  elif command -v getent >/dev/null 2>&1; then
    getent ahosts "$1" | awk '/STREAM/ {print $1; exit}'
  else
    host -t A "$1" 2>/dev/null | awk '/has address/ {print $4; exit}'
  fi
}

APEX_IP="$(resolve_domain "$DOMAIN")"
WWW_IP="$(resolve_domain "$WWW")"

echo "DNS check:"
echo "  $DOMAIN -> ${APEX_IP:-<unresolved>}"
echo "  $WWW -> ${WWW_IP:-<unresolved>}"
echo "  Expected VPS IP: $EXPECTED_IP"

if [ "$APEX_IP" != "$EXPECTED_IP" ] || [ "$WWW_IP" != "$EXPECTED_IP" ]; then
  echo "ERROR: DNS does not point both hostnames to $EXPECTED_IP. Fix DNS and wait for propagation before issuing certificates." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx curl

NGINX_SITE="/etc/nginx/sites-available/dentax.cloud"
sed "s/127.0.0.1:3100/127.0.0.1:${APP_PORT}/g" "$REPO_ROOT/deploy/nginx/dentax.cloud.conf" >"$NGINX_SITE"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/dentax.cloud
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl reload nginx

certbot --nginx \
  -d "$DOMAIN" \
  -d "$WWW" \
  --non-interactive \
  --agree-tos \
  -m "$CERTBOT_EMAIL" \
  --redirect

systemctl enable certbot.timer
systemctl start certbot.timer

echo ""
echo "HTTPS setup complete."
echo "  Site: https://${DOMAIN}"
echo "  Cert renewal timer:"
systemctl status certbot.timer --no-pager || true
echo ""
echo "Next steps on the VPS:"
echo "  1. Set NEXTAUTH_URL=https://${DOMAIN} and NEXT_PUBLIC_APP_URL=https://${DOMAIN} in .env.production"
echo "  2. docker compose -f docker-compose.prod.yml up -d --build"
echo "  3. curl -fsS https://${DOMAIN}/api/health"
