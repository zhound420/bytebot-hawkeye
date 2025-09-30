# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Bytebot is an AI Desktop Agent platform consisting of four main components:

1. **bytebot-ui** - Next.js frontend application for task management and desktop viewing
2. **bytebot-agent** - NestJS service that orchestrates AI tasks and manages state
3. **bytebotd** - Desktop daemon that provides computer use capabilities (screenshot, click, type)
4. **shared** - Common TypeScript types and utilities shared across packages

The architecture follows a microservices pattern where:
- The UI communicates with the agent via HTTP/WebSocket
- The agent communicates with the desktop daemon for computer control
- PostgreSQL stores task history and state
- All services run in Docker containers with Docker Compose

## Development Commands

### Root Level Commands
The project uses a monorepo structure. Most commands need to be run from individual package directories.

### Per-Package Commands

**bytebot-ui (Next.js frontend):**
```bash
cd packages/bytebot-ui
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
```

**bytebot-agent (NestJS service):**
```bash
cd packages/bytebot-agent
npm run start:dev    # Development with watch
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint with --fix
npm run test         # Jest tests
npm run test:watch   # Jest in watch mode
npm run test:e2e     # End-to-end tests
npm run prisma:dev   # Run Prisma migrations for development
```

**bytebotd (Desktop daemon):**
```bash
cd packages/bytebotd
npm run start:dev    # Development with watch
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint with --fix
npm run test         # Jest tests
```

**shared (Common utilities):**
```bash
cd packages/shared
npm run build        # Build shared package (required by other packages)
```

### Docker Development
```bash
# Full stack development
docker-compose -f docker/docker-compose.yml up -d

# Individual services
docker-compose -f docker/docker-compose.yml up bytebot-desktop
docker-compose -f docker/docker-compose.yml up bytebot-agent
docker-compose -f docker/docker-compose.yml up bytebot-ui
```

## Key Technical Details

### Database
- Uses PostgreSQL with Prisma ORM
- Database schema is in `packages/bytebot-agent/prisma/schema.prisma`
- Migrations are handled via Prisma CLI
- Connection string format: `postgresql://postgres:postgres@localhost:5432/bytebotdb`

### AI Provider Integration
The agent supports multiple AI providers:
- Anthropic Claude (via `@anthropic-ai/sdk`)
- OpenAI GPT (via `openai`)
- Google Gemini (via `@google/genai`)

### Computer Use
- Screen capture and interaction handled by `bytebotd` service
- Uses `@nut-tree-fork/nut-js` for cross-platform screen automation
- WebSocket communication for real-time desktop streaming
- noVNC integration for browser-based desktop viewing

### Service Ports
- bytebot-ui: 9992 (web interface)
- bytebot-agent: 9991 (API server)
- bytebot-desktop: 9990 (desktop daemon + noVNC)
- PostgreSQL: 5432

### Environment Variables
Key environment variables needed for development:
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` or `GEMINI_API_KEY`
- `DATABASE_URL` (PostgreSQL connection string)
- `BYTEBOT_DESKTOP_BASE_URL` (desktop service URL)

### Testing
- All NestJS services use Jest for testing
- Test files follow `.spec.ts` naming convention
- E2E tests are in `test/` directories with `jest-e2e.json` config