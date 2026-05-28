#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${EMBOPLOT_DOMAIN:-claworkers.com}"
SERVER_IP="${EMBOPLOT_SERVER_IP:-8.140.199.153}"
KEY_PATH="${EMBOPLOT_DEPLOY_KEY:-$HOME/.ssh/emboflow-deploy}"
REMOTE="${EMBOPLOT_DEPLOY_REMOTE:-root@8.140.199.153}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [[ -z "$CERTBOT_EMAIL" ]]; then
  echo "Set CERTBOT_EMAIL before running, for example: CERTBOT_EMAIL=you@example.com $0" >&2
  exit 1
fi

resolved="$(dig @223.5.5.5 +short "$DOMAIN" | tail -n1)"
if [[ "$resolved" != "$SERVER_IP" ]]; then
  echo "$DOMAIN currently resolves to ${resolved:-<empty>}, expected $SERVER_IP. Update DNS first." >&2
  exit 1
fi

ssh -i "$KEY_PATH" -o IdentitiesOnly=yes "$REMOTE" bash -s -- "$DOMAIN" "$CERTBOT_EMAIL" <<'REMOTE_SCRIPT'
set -euo pipefail

domain="$1"
email="$2"
env_file=/etc/emboplot/emboplot.env

if ! command -v certbot >/dev/null 2>&1; then
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y certbot python3-certbot-nginx
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
  else
    echo "No supported package manager found for certbot installation." >&2
    exit 1
  fi
fi

certbot --nginx -d "$domain" --redirect --agree-tos -m "$email" --no-eff-email

tmp="$(mktemp)"
cp "$env_file" "$tmp"
set_kv() {
  key="$1"
  value="$2"
  if grep -q "^${key}=" "$tmp"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$tmp"
  else
    printf "%s=%s\n" "$key" "$value" >> "$tmp"
  fi
}

set_kv PUBLIC_BASE_URL "https://${domain}"
set_kv APP_URL "https://${domain}"
set_kv ALLOWED_ORIGIN "https://${domain}"
set_kv AUTH_COOKIE_SECURE "true"

install -m 600 "$tmp" "$env_file"
rm -f "$tmp"

systemctl restart emboplot
nginx -t
systemctl reload nginx
curl -fsS "https://${domain}/api/health"
REMOTE_SCRIPT

echo "HTTPS is active for https://$DOMAIN"
