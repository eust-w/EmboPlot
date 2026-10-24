# Security policy

## Report privately

Please use [GitHub private vulnerability reporting](https://github.com/eust-w/EmboPlot/security/advisories/new). Do not include exploits, credentials or customer data in public issues. Include the affected commit, prerequisites, impact and a minimal reproduction with synthetic data. This project does not promise a response SLA or a bug bounty.

安全问题请通过上述私密入口反馈，不要在公开 Issue 中发布密钥、利用细节或用户数据。

## Supported scope

Security fixes target the latest `main` and current alpha release. Older snapshots are not separately maintained. This is an early-stage application, not a security-audited, production-certified service.

## Self-hosting checklist

- Generate a long, unique `AUTH_JWT_SECRET`; never use the development default.
- Keep MongoDB private and authenticated. Use a dedicated database and restricted database user.
- Keep model and payment credentials on the backend. Never prefix them with `VITE_`.
- Use HTTPS, `AUTH_COOKIE_SECURE=true`, and an exact `ALLOWED_ORIGIN`.
- Keep Vite bound to loopback for local development; serve the built frontend behind a reverse proxy in production.
- Apply request-size limits, rate limiting and abuse controls before opening registration to the public. The repository does not provide a complete abuse-prevention system.
- Treat user-supplied URLs and file uploads as untrusted. Review outbound network access, SSRF exposure, allowed media hosts and content validation for your deployment.
- Local fallback is for development. It is not a safety filter, model-quality guarantee, or billing acceptance test.
- Provider media URLs may expire. Persistence of a URL is not durable storage of the underlying image or audio; arrange authorized object storage and backups.
- Review payment signatures, amount checks, replay handling, refunds and real provider callbacks before enabling purchases. Automated tests do not settle a real payment.
- Check dependencies regularly (`npm audit`, Go vulnerability tooling) and rotate any credential exposed outside your intended secret store.

See [deployment](docs/deployment.md) and [verification evidence](docs/readme/validation.md) for configuration and current test boundaries.
