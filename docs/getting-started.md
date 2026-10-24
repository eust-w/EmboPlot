# Local setup / 本地启动

[中文 README](../README.md) · [English README](../README.en.md)

## Prerequisites

- Node.js 22.12+, npm and Go 1.24+.
- A running MongoDB 7+ instance. Use a dedicated local database, not production data.
- Optional: your own DashScope account with access to the configured models. Credentials are not included.
- Optional: Hupijiao merchant credentials for payments; not needed for local story editing.

## Install

```bash
git clone https://github.com/eust-w/EmboPlot.git
cd EmboPlot
npm ci
cp .env.example .env
openssl rand -hex 32
```

Edit `.env`: replace `AUTH_JWT_SECRET` with the generated random value. Start MongoDB with your normal local installation and set its URI. The API creates collections and sample resources at startup.

```bash
# Terminal A, repository root
npm run backend:dev

# Terminal B, repository root
npm run dev -- --host 127.0.0.1
```

Open [http://localhost:3000](http://localhost:3000) and select **注册** to create an account. A new account currently starts with 300 application points. That balance does not grant provider credits.

```bash
curl --fail http://localhost:8080/api/health
curl --fail http://localhost:8080/api/models/capabilities
```

Health should return `{"ok":true}`. Capabilities reports `live` or `fallback` configuration, not whether every provider request will succeed. Restart the API after changing model configuration.

## Important settings

| Variable | Local default / purpose |
| --- | --- |
| `PORT` | `8080`, Go API listener |
| `MONGODB_URI` | `mongodb://localhost:27017` |
| `MONGODB_DATABASE` | `emboplot`, use a dedicated database |
| `VITE_API_PROXY_TARGET` | `http://localhost:8080`, Vite development proxy |
| `ALLOWED_ORIGIN` | `http://localhost:3000`, exact browser origin |
| `PUBLIC_BASE_URL` | Public API origin for payment URLs; default `http://localhost:8080` |
| `AUTH_JWT_SECRET` | Unique random secret; do not use the example value |
| `AUTH_COOKIE_SECURE` | `false` for local HTTP; `true` for production HTTPS |
| `DASHSCOPE_API_KEY` | Backend only; empty enables development fallback |
| `DASHSCOPE_*_MODEL` | Individual model IDs; see [architecture](architecture.md) |
| `HUPIJIAO_APP_ID`, `HUPIJIAO_APP_SECRET` | Optional payment credentials, backend only |

The backend loads `.env` from its working directory and then `../.env` using `godotenv.Overload`. These files can override shell variables. Run deployed/test binaries from an isolated directory without either file; do not assume a shell override beats the checked-out `.env`. Never put secrets in `VITE_` variables, which are exposed to the browser.

## Model modes

| Operation | Working DashScope credentials | Without credentials / fallback |
| --- | --- | --- |
| Story turns, character/story drafts | Model output | Deterministic local templates |
| Text-to-image / image edit | Generated media | Error; no fake generated image |
| TTS | Generated audio URL | Short test tone, not speech |
| ASR / vision / embeddings / moderation | Provider result | Placeholder text, vectors or lightweight rules |

Fallback is for development. Some upstream errors also trigger it; inspect backend logs. Do not use it to evaluate writing quality, safety filtering or voices. The application ledger still applies to successful fallback operations.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| API exits at startup | MongoDB reachability, credentials and database name |
| Port 3000 occupied | Run `npm run dev -- --port 3001 --host 127.0.0.1`; set `ALLOWED_ORIGIN=http://localhost:3001` and restart API |
| Port 8080 occupied | Change `PORT` and `VITE_API_PROXY_TARGET` together |
| Login does not persist | Use one hostname consistently; local HTTP needs `AUTH_COOKIE_SECURE=false` |
| Repetitive text / audio beeps | Inspect capabilities and provider error logs for fallback |
| Model permission / region error | Use model IDs/endpoints available to your account and region |
| `402 insufficient points` | Check balance and ledger; AI operations consume application points |
| Old image/audio no longer loads | Signed URL may have expired; persistence does not archive media bytes |

## Checks

```bash
npm run lint
npm run build
npm run docs:check
npm run backend:test
npm audit
```

For an illustrated workflow without provider calls, use the [showcase recording](showcase.md). Before opening a public service, read [deployment](deployment.md) and [security](../SECURITY.md).
