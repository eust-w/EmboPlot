# Changelog

## 0.1.0-alpha.1 - 2026-10-25

First packaged public alpha. The application existed in the public repository before this release.

### Added

- Illustrated Chinese/English READMEs and an original sample scenario.
- A real local workflow recording, bilingual captions, GIF preview and reproducible Playwright capture scripts.
- Local setup, architecture/context policy, non-Docker deployment, contribution and security documentation.
- Frontend, backend and browser CI; dependency-update configuration; issue and pull request templates.

### Fixed

- Mobile theater drawer now receives real state/setter props instead of a permanently open value and no-op callback.
- Compatible dependency updates address the vulnerabilities reported by the release-time npm audit.
- Deployment helpers require explicit targets instead of defaulting to a maintainer's host; Go checksum verification remains enabled.

### Boundaries

- UI is primarily Chinese; the docs are bilingual.
- The recording uses prewritten fixture content, not live AI output. Model credentials and payment acceptance are the operator's responsibility.
- Bounded prompt context, expiring provider media URLs and development fallbacks are documented, not presented as solved production guarantees.
