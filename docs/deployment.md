# Self-hosting without Docker

This is a deployment outline for Linux/systemd with Nginx, not a one-command managed hosting service. Review [SECURITY](../SECURITY.md) before enabling public accounts or payments. Keep databases, secret files and uploaded user data outside the repository.

## Layout

```text
/opt/emboplot/frontend/               # contents of dist/
/opt/emboplot/backend/emboplot-server # compiled Go binary
/etc/emboplot/emboplot.env            # server-only secrets, mode 0600
/etc/nginx/conf.d/emboplot-theater.conf
```

Build from a trusted checkout:

```bash
npm ci
npm run lint
npm run build
cd backend
go test ./...
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o emboplot-server ./cmd/server
```

Choose the correct `GOARCH` for your server. Copy the artifacts to the layout above using your own deployment account. Preserve previous artifacts and database backups before upgrading. Serve `dist/`, not a Vite development server.

## Server environment

Start from [`.env.example`](../.env.example). Set an authenticated, private `MONGODB_URI`, a dedicated database and random `AUTH_JWT_SECRET`. For a domain such as `theater.example.com`, set:

```dotenv
PORT=8080
PUBLIC_BASE_URL=https://theater.example.com
APP_URL=https://theater.example.com
ALLOWED_ORIGIN=https://theater.example.com
AUTH_COOKIE_SECURE=true
```

Add DashScope and optional payment credentials **on the server only**. Restrict secret-file ownership/permissions; never copy it to `dist` or commit it. The Go binary loads `.env` and `../.env` relative to its working directory; keep those absent so the systemd environment is authoritative.

Use an unprivileged service account with access only to necessary files. A minimal systemd unit:

```ini
[Unit]
Description=EmboPlot API
After=network-online.target
Wants=network-online.target

[Service]
User=emboplot
Group=emboplot
WorkingDirectory=/opt/emboplot/backend
EnvironmentFile=/etc/emboplot/emboplot.env
ExecStart=/opt/emboplot/backend/emboplot-server
Restart=on-failure
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

The current binary listens on `:PORT`; enforce host/cloud firewall rules so only Nginx can reach the backend. Do not expose MongoDB or the API port to the internet.

## DNS and HTTPS

1. Add an A record for your chosen subdomain to your server IP.
2. Adapt the [HTTP template](../deploy/nginx/theater-http.conf.template), replacing `__DOMAIN__`. It serves the frontend, proxies `/api` to port 8080 and exposes the ACME webroot.
3. Validate with `nginx -t`, reload Nginx, and verify DNS/HTTP reachability.
4. Obtain a certificate with your certificate provider or Certbot webroot validation.
5. Adapt the [HTTPS template](../deploy/nginx/theater-https.conf.template), verify certificate paths, validate and reload.
6. Verify automated certificate renewal and an actual public HTTPS request. A successful local Host-header test is not public DNS verification.

The maintainer scripts [`deploy-production.sh`](../scripts/deploy-production.sh) and [`finalize-production-domain.sh`](../scripts/finalize-production-domain.sh) assume the layout above, Linux amd64 and existing `emboplot`/`nginx` systemd services. They are update helpers, not a fresh-server provisioner. Review them before running; use explicit destination environment variables, your own SSH key and your own domain. Never overwrite another application's virtual host.

```bash
export EMBOPLOT_DEPLOY_KEY="$HOME/.ssh/your-deploy-key"
export EMBOPLOT_DEPLOY_REMOTE="your-deploy-account@your-server"
export EMBOPLOT_PUBLIC_URL="https://theater.example.com"
export EMBOPLOT_DOMAIN="theater.example.com"
export EMBOPLOT_SERVER_IP="YOUR_SERVER_IPV4"
```

The scripts fail before connecting if required destination settings are missing. Real maintainer destinations belong in an ignored local file or shell environment, not shared defaults. Do not turn off Go module checksum verification to work around network problems.

## Acceptance checks

```bash
curl --fail https://theater.example.com/api/health
curl --fail https://theater.example.com/api/auth/session
curl --fail https://theater.example.com/api/models/capabilities
```

Then register/login in a browser, create a room, write a line, exit and reenter, and verify persistence. Test images/audio independently, including provider URL expiry. Inspect both the app points ledger and provider usage. Only enable top-ups after validating merchant callbacks, signatures, duplicate notifications and amount checks with your own payment account.

No production hostname is advertised as a working public demo by this release. Use the downloadable walkthrough or a local instance.
