# Repository Guidelines

## Project Structure & Module Organization
- `packages/bytebot-agent` and `packages/bytebot-agent-cc` coordinate automation flows; keep shared guards, DTOs, and utilities in `packages/shared` and rebuild with `npm run build --prefix packages/shared` after interface changes.
- `packages/bytebot-cv` owns the computer-vision pipelines; colocate specs beside implementations (e.g. `foo.spec.ts`) and document pipeline behaviour in `docs/` when introducing new stages.
- `packages/bytebot-ui` renders dashboards, while `packages/bytebotd` and `packages/bytebot-llm-proxy` handle desktop and LLM traffic; static assets live in `static/`, deployment manifests in `docker/` and `helm/`, and environment presets in `config/`.

## Build, Test, and Development Commands
- `npm install` — bootstrap workspace dependencies from the repo root.
- `npm run start:dev --prefix packages/bytebot-agent` — launch the primary agent backend; swap the prefix to iterate on other services.
- `npm run build --prefix packages/bytebot-ui` — compile production UI bundles; rebuild shared types before consuming them.
- `npm test --prefix <package>` — execute unit and integration suites; pair with `npm run test:e2e --prefix packages/bytebot-agent` ahead of releases.
- `docker compose -f docker/docker-compose.yml up -d` — start the local sandbox stack; stop with `down` to clean containers and volumes.

## Coding Style & Naming Conventions
- Favor TypeScript with 2-space indentation, single quotes, trailing commas, and required semicolons; run `npm run format` to apply Prettier and ESLint.
- Use camelCase for variables and functions, PascalCase for classes, and snake_case for Prisma models; route shared imports through `packages/shared` or relative module aliases.

## Testing Guidelines
- Jest backs all suites; mirror implementation filenames when creating specs and keep fixtures in-package.
- Target high-signal scenarios: verify coordinate telemetry, CV detection accuracy, and UI rendering differences before merging.
- Run affected `npm test --prefix <package>` jobs locally and finish large changes with the agent e2e suite.

## Commit & Pull Request Guidelines
- Write imperative commit subjects (e.g. `Improve coordinate telemetry`) and stage only intentional hunks.
- PRs should outline intent, link issues, flag schema or feature toggles, and include UI captures when dashboards shift; note downstream impacts when shared contracts or CV pipelines change.

## Security & Configuration Tips
- Store secrets in service-level `.env` files or `docker/.env`; never commit credentials or production tokens.
- Document toggled flags like `BYTEBOT_SMART_FOCUS` or `BYTEBOT_COORDINATE_METRICS`, and rerun affected builds/tests after adjusting dependencies or environment knobs.
