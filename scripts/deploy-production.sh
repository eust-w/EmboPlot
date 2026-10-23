#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY_PATH="${EMBOPLOT_DEPLOY_KEY:-$HOME/.ssh/emboflow-deploy}"
REMOTE="${EMBOPLOT_DEPLOY_REMOTE:-root@8.140.199.153}"
REMOTE_FRONTEND_DIR="${EMBOPLOT_REMOTE_FRONTEND_DIR:-/opt/emboplot/frontend}"
REMOTE_BACKEND_BIN="${EMBOPLOT_REMOTE_BACKEND_BIN:-/opt/emboplot/backend/emboplot-server}"
PUBLIC_URL="${EMBOPLOT_PUBLIC_URL:-https://theater.claworkers.com}"

if [[ ! -r "$KEY_PATH" ]]; then
  echo "Missing deploy key: $KEY_PATH" >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

frontend_archive="$tmpdir/frontend-dist.tgz"
backend_binary="$tmpdir/emboplot-server-linux-amd64"

cd "$ROOT_DIR"

npm run lint
npm run build

(
  cd backend
  GOSUMDB=off go test ./...
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o "$backend_binary" ./cmd/server
)

COPYFILE_DISABLE=1 tar --no-xattrs -C dist -czf "$frontend_archive" .

scp -i "$KEY_PATH" -o IdentitiesOnly=yes "$backend_binary" "$frontend_archive" "$REMOTE:/tmp/"

ssh -i "$KEY_PATH" -o IdentitiesOnly=yes "$REMOTE" <<'REMOTE_SCRIPT'
set -euo pipefail

install -m 755 /tmp/emboplot-server-linux-amd64 /opt/emboplot/backend/emboplot-server
rm -rf /opt/emboplot/frontend/*
tar -C /opt/emboplot/frontend -xzf /tmp/frontend-dist.tgz
rm -f /tmp/emboplot-server-linux-amd64 /tmp/frontend-dist.tgz
chown -R root:root /opt/emboplot

systemctl restart emboplot
nginx -t
systemctl reload nginx

for attempt in {1..20}; do
  if curl --connect-timeout 3 --max-time 10 -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

systemctl --no-pager --full status emboplot
journalctl -u emboplot -n 80 --no-pager
exit 1
REMOTE_SCRIPT

for attempt in {1..20}; do
  if curl --connect-timeout 5 --max-time 15 -fsS "$PUBLIC_URL/api/health" >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" -eq 20 ]]; then
    curl --connect-timeout 5 --max-time 15 -fsS "$PUBLIC_URL/api/health" >/dev/null
  fi
  sleep 1
done

curl --connect-timeout 5 --max-time 15 -fsS "$PUBLIC_URL/api/models/capabilities" >/dev/null

echo "Deployed 随流剧场 to $PUBLIC_URL"
