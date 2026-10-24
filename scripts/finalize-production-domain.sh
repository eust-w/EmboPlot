#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${EMBOPLOT_DOMAIN:?Set your theater domain}"
: "${EMBOPLOT_SERVER_IP:?Set the destination server IPv4 address}"
: "${EMBOPLOT_DEPLOY_KEY:?Set the path to your SSH deployment key}"
: "${EMBOPLOT_DEPLOY_REMOTE:?Set your deployment account and host}"
DOMAIN="$EMBOPLOT_DOMAIN"
SERVER_IP="$EMBOPLOT_SERVER_IP"
KEY_PATH="$EMBOPLOT_DEPLOY_KEY"
REMOTE="$EMBOPLOT_DEPLOY_REMOTE"
CERTBOT_EMAIL="${CERTBOT_EMAIL:--}"
PREPARE_ONLY="${EMBOPLOT_PREPARE_ONLY:-0}"

if [[ ! "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
  echo "Invalid domain: $DOMAIN" >&2
  exit 1
fi

if [[ "$CERTBOT_EMAIL" != "-" && ! "$CERTBOT_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
  echo "Invalid certificate contact email." >&2
  exit 1
fi

if [[ ! "$PREPARE_ONLY" =~ ^[01]$ || ! "$SERVER_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "Use an IPv4 EMBOPLOT_SERVER_IP and EMBOPLOT_PREPARE_ONLY=0 or 1." >&2
  exit 1
fi

if [[ ! -r "$KEY_PATH" ]]; then
  echo "Missing deploy key: $KEY_PATH" >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
sed "s|__DOMAIN__|$DOMAIN|g" "$ROOT_DIR/deploy/nginx/theater-http.conf.template" > "$tmpdir/http.conf"
sed "s|__DOMAIN__|$DOMAIN|g" "$ROOT_DIR/deploy/nginx/theater-https.conf.template" > "$tmpdir/https.conf"

remote_tmp="$(ssh -i "$KEY_PATH" -o IdentitiesOnly=yes "$REMOTE" 'mktemp -d /tmp/emboplot-domain.XXXXXX')"
scp -i "$KEY_PATH" -o IdentitiesOnly=yes "$tmpdir/http.conf" "$tmpdir/https.conf" "$REMOTE:$remote_tmp/"

ssh -i "$KEY_PATH" -o IdentitiesOnly=yes "$REMOTE" bash -s -- "$DOMAIN" "$CERTBOT_EMAIL" "$PREPARE_ONLY" "$SERVER_IP" "$remote_tmp" <<'REMOTE_SCRIPT'
set -euo pipefail

domain="$1"
email="$2"
prepare_only="$3"
server_ip="$4"
remote_tmp="$5"
env_file=/etc/emboplot/emboplot.env
nginx_file=/etc/nginx/conf.d/emboplot-theater.conf
trap 'rm -rf "$remote_tmp"' EXIT

install -d /var/www/letsencrypt
if [[ -f "$nginx_file" ]]; then
  if ! grep -Fq "server_name $domain;" "$nginx_file"; then
    echo "The dedicated theater site already uses another domain; review $nginx_file before changing it." >&2
    exit 1
  fi
  cp "$nginx_file" "$remote_tmp/previous.conf"
fi

restore_nginx() {
  if [[ -f "$remote_tmp/previous.conf" ]]; then
    install -m 644 "$remote_tmp/previous.conf" "$nginx_file"
  else
    rm -f "$nginx_file"
  fi
}

if [[ ! -f "$nginx_file" ]]; then
  install -m 644 "$remote_tmp/http.conf" "$nginx_file"
  if ! nginx -t; then
    restore_nginx
    exit 1
  fi
  systemctl reload nginx
fi

if [[ "$prepare_only" == "1" ]]; then
  echo "HTTP site prepared for $domain. Add DNS A record pointing to $server_ip, then rerun without EMBOPLOT_PREPARE_ONLY."
  exit 0
fi

if ! getent ahostsv4 "$domain" | awk '{print $1}' | sort -u | grep -Fxq "$server_ip"; then
  echo "$domain must resolve to $server_ip before HTTPS can be issued. HTTP site is prepared." >&2
  exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "Install certbot on the server before enabling HTTPS." >&2
  exit 1
fi

certbot_args=(certonly --webroot -w /var/www/letsencrypt -d "$domain" --cert-name "$domain" --non-interactive --keep-until-expiring --deploy-hook "systemctl reload nginx")
if [[ "$email" != "-" ]]; then
  certbot_args+=(--email "$email" --agree-tos)
fi
certbot "${certbot_args[@]}"

backup_dir="/etc/emboplot/backups/domain-$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$backup_dir"
cp "$env_file" "$backup_dir/emboplot.env"
cp "$nginx_file" "$backup_dir/nginx.conf"
chmod 600 "$backup_dir/emboplot.env"

install -m 644 "$remote_tmp/https.conf" "$nginx_file"
if ! nginx -t; then
  restore_nginx
  exit 1
fi

tmp="$remote_tmp/emboplot.env"
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

systemctl restart emboplot
systemctl reload nginx
for attempt in {1..20}; do
  if curl --connect-timeout 3 --max-time 10 -fsS --resolve "$domain:443:127.0.0.1" "https://${domain}/api/health"; then
    exit 0
  fi
  sleep 1
done

echo "Backend did not recover after domain update; restoring its previous environment." >&2
install -m 600 "$backup_dir/emboplot.env" "$env_file"
systemctl restart emboplot
exit 1
REMOTE_SCRIPT

if [[ "$PREPARE_ONLY" != "1" ]]; then
  curl --connect-timeout 5 --max-time 15 -fsS "https://$DOMAIN/api/health"
  echo "HTTPS is active for https://$DOMAIN"
fi
