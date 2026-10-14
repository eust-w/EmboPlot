# Release validation

Date: 2026-10-14. Checks are executed in an isolated working checkout. Screenshots use local synthetic/demo data. A source implementation, a passing automated test and external-service acceptance are separate claims.

## Commands

```bash
npm run backend:test
npm run lint
npm run build
```

PASS: TypeScript checks, frontend build and Go backend tests; local MongoDB/API registration, login, seeded theater and manual deterministic fallback were exercised. No external model or payment call was performed. Hardware, external credentials, signing and production deployment are separate setup/acceptance steps.
