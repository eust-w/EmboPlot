<div align="center">
  <img src="docs/readme/hero.svg" width="100%" alt="EmboPlot · 随流剧场 workflow overview">
  <h1>EmboPlot · 随流剧场</h1>
  <p><strong>Create characters. Stage a story. Inspect every mode.</strong></p>
  <p><a href="LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/License-Apache--2.0-d99536?style=flat-square"></a> <a href="docs/readme/validation.md"><img alt="Validation notes" src="https://img.shields.io/badge/Validation-repository%20checks-547ac4?style=flat-square"></a></p>
  <p><a href="#overview">Overview</a> · <a href="#quick-start">Quick start</a> · <a href="#workflow">Workflow</a> · <a href="#validation">Validation</a> · <a href="#documentation">Docs</a></p>
  <p><a href="README.en.md">English</a> · <a href="README.md">简体中文</a></p>
</div>

---

<a id="overview"></a>
## Overview

An interactive character-and-story theater with React, a Go API, MongoDB workspaces and a model gateway. The local demo uses original abstract SVG imagery.

| Capability | What it provides |
| :--- | :--- |
| **Story workspace** | Characters, backgrounds, rooms and script exports. |
| **Account API** | HttpOnly sessions and per-user MongoDB workspaces. |
| **Model gateway** | DashScope adapters plus deterministic development fallback. |

### Local demo

![EmboPlot · 随流剧场 local demonstration](docs/readme/theater.jpg)

*Captured locally for this release; sample data, replay and fallback boundaries are stated below.*

<a id="quick-start"></a>
## Quick start

```bash
git clone https://github.com/eust-w/EmboPlot.git
cd EmboPlot
npm ci
cp .env.example .env
# Set a random AUTH_JWT_SECRET in .env.
# Start MongoDB locally, or set MONGODB_URI to your own instance.
npm run backend:dev
# In another terminal:
npm run dev
```

<a id="workflow"></a>
## Workflow

```text
CREATE → DIRECT → PERFORM
```

```bash
npm run backend:test
npm run lint
npm run build
```

<a id="validation"></a>
## Validation

```bash
npm run backend:test
npm run lint
npm run build
```

Recorded environment and executed checks: [validation notes](docs/readme/validation.md).

| Area | Current boundary |
| :--- | :--- |
| Model mode | Without DASHSCOPE_API_KEY, the backend uses local fallback. An unavailable API may trigger frontend demo data. |
| Deployment | Use a random JWT secret, correct ALLOWED_ORIGIN and HTTPS secure cookies for deployment. |
| Payment | The payment adapter requires merchant credentials; no production payment acceptance is claimed. |

<a id="documentation"></a>
## Docs

- [Original demo assets / 原创示例](public/demo/README.md)
- [Backend / 后端](backend/)
- [Model gateway / 模型网关](backend/internal/modelgateway/)

## License and provenance

Original code and newly created demo assets are licensed under [Apache-2.0](LICENSE). Dependencies, models, datasets and external resources retain their terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
