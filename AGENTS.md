# Repository Guidelines

This guide covers how to work in the Bytebot monorepo and should be followed across all packages.

## Project Structure & Module Organization

- `packages/` multi-package workspace:
  - `shared` — DTOs and schema utilities shared by services.
  - `bytebot-agent` — NestJS API and Prisma client.
  - `bytebotd` — desktop daemon and socket gateway.
  - `bytebot-ui` — Next.js front end.
- Place new modules beside the service they extend; keep tests next to source as `*.spec.ts`.
- Top-level assets: `docs/`, `helm/`, `docker/`, `static/`.
- Put shared DTOs/validation in `packages/shared` to avoid duplication.

## Build, Test, and Development Commands

- Build shared first: `npm run build --prefix packages/shared`.
- Per package dev: `cd packages/<name> && npm install && npm run start:dev`.
- Prisma (API): `cd packages/bytebot-agent && npm run prisma:dev` (apply migrations, regen client).
- UI dev: `cd packages/bytebot-ui && npm run dev` (Next.js hot reload).
- Full stack: `docker compose -f docker/docker-compose.yml up -d`.
- Target Node 20 across packages.

## Coding Style & Naming Conventions

- TypeScript, 2-space indentation, single quotes, trailing commas.
- Classes: PascalCase; functions/variables: camelCase; Prisma models: snake_case.
- Run `npm run format` before committing (Prettier + ESLint).

## Testing Guidelines

- Jest for unit tests; place specs beside code as `*.spec.ts`.
- Run: `npm test`, `npm run test:watch`, `npm run test:cov` (coverage), `npm run test:e2e` for API surface changes.
- Mock external LLM/desktop integrations to keep tests deterministic.

## Commit & Pull Request Guidelines

- Commits: concise, imperative (e.g., `Add Prisma seed script`).
- PRs: explain intent, list manual/automated tests, link related issues, include UI captures when relevant.
- Call out schema or environment changes so teammates can coordinate migrations/secrets.

## Security & Configuration Tips

- Load secrets from per-package `.env` files or `docker/.env`; never commit credentials.
- After modifying Prisma schemas, rerun `npm run prisma:dev`.
- Prefer existing scripts and Docker services over ad‑hoc tooling for reproducibility.

