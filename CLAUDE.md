# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Bytebot Hawkeye is a precision-enhanced fork of the open-source AI Desktop Agent platform. It consists of these main packages:

1. **bytebot-agent** - NestJS service that orchestrates AI tasks, computer use, and precision targeting
2. **bytebot-ui** - Next.js frontend with desktop dashboard and task management
3. **bytebotd** - Desktop daemon providing computer control with enhanced coordinate accuracy
4. **bytebot-cv** - Computer vision package with OpenCV bindings for element detection
5. **shared** - Common TypeScript types, utilities, and universal coordinate mappings

## Key Hawkeye Enhancements

This fork adds precision tooling on top of upstream Bytebot:
- **Smart Focus System**: 3-stage coarse→focus→click workflow with tunable grids
- **Progressive zoom capture**: Deterministic zoom ladder with coordinate reconciliation
- **Universal element detection**: CV pipeline with visual pattern detection + OCR enrichment
- **Coordinate telemetry**: Accuracy metrics and adaptive calibration
- **Grid overlay guidance**: Always-on coordinate grids with debug overlays

## Development Commands

### Build Dependencies
The shared package must be built first as other packages depend on it:
```bash
cd packages/shared && npm run build
```

### bytebot-agent (NestJS API service)
```bash
cd packages/bytebot-agent

# Development
npm run start:dev          # Watch mode with shared build
npm run prisma:dev         # Run migrations + generate client

# Testing
npm run test               # Jest unit tests
npm run test:watch         # Jest watch mode
npm run test:e2e           # End-to-end tests

# Production
npm run build              # Build with shared dependencies
npm run start:prod         # Production server
npm run lint               # ESLint with --fix
```

### bytebot-ui (Next.js frontend)
```bash
cd packages/bytebot-ui

npm run dev                # Development server
npm run build              # Production build
npm run start              # Production server
npm run lint               # Next.js linting
npm run test               # Native Node.js tests
```

### bytebotd (Desktop daemon)
```bash
cd packages/bytebotd

npm run start:dev          # Watch mode with shared build
npm run build              # Nest build
npm run start:prod         # Production server
npm run test               # Jest tests
npm run lint               # ESLint with --fix
```

### bytebot-cv (Computer vision)
```bash
cd packages/bytebot-cv

npm run build              # TypeScript compilation
npm run dev                # Watch mode
npm run verify             # Check OpenCV capabilities
npm run patch              # Patch OpenCV bindings
```

## Docker Development

### Full Stack (Standard)
```bash
docker compose -f docker/docker-compose.yml up -d --build
```

### Proxy Stack (with LiteLLM)
```bash
# Configure docker/.env with API keys and Hawkeye settings first
docker compose -f docker/docker-compose.proxy.yml up -d --build
```

### Service Ports
- bytebot-ui: 9992 (web interface)
- bytebot-agent: 9991 (API server)
- bytebotd: 9990 (desktop daemon + noVNC)
- PostgreSQL: 5432

## Database

Uses PostgreSQL with Prisma ORM:
- Schema: `packages/bytebot-agent/prisma/schema.prisma`
- Migrations: `npm run prisma:dev` (in bytebot-agent)
- Connection: `postgresql://postgres:postgres@localhost:5432/bytebotdb`

## AI Provider Integration

Supports multiple providers via environment variables:
- `ANTHROPIC_API_KEY` - Claude models
- `OPENAI_API_KEY` - GPT models
- `GEMINI_API_KEY` - Gemini models
- `OPENROUTER_API_KEY` - OpenRouter proxy

## Hawkeye-Specific Configuration

Key environment variables for precision features:
```bash
# Smart Focus System
BYTEBOT_SMART_FOCUS=true
BYTEBOT_SMART_FOCUS_MODEL=gpt-4o-mini
BYTEBOT_OVERVIEW_GRID=200
BYTEBOT_FOCUSED_GRID=25

# Grid Overlays
BYTEBOT_GRID_OVERLAY=true
BYTEBOT_GRID_DEBUG=false

# Coordinate Accuracy
BYTEBOT_COORDINATE_METRICS=true
BYTEBOT_COORDINATE_DEBUG=false
BYTEBOT_SMART_CLICK_SUCCESS_RADIUS=12

# Progressive Zoom
BYTEBOT_PROGRESSIVE_ZOOM_USE_AI=true
BYTEBOT_ZOOM_REFINEMENT=true

# Universal Element Detection
BYTEBOT_UNIVERSAL_TEACHING=true
BYTEBOT_ADAPTIVE_CALIBRATION=true
```

## Computer Vision Pipeline

The bytebot-cv package provides:
- OpenCV 4.6.x - 4.8.x bindings via `@u4/opencv4nodejs` v7.1.2
- CLAHE contrast enhancement with graceful fallbacks
- Morphological operations for UI element detection
- OCR via Tesseract.js with preprocessing
- Element detection services for buttons, inputs, and clickable controls

## Testing

All NestJS packages use Jest:
- Test files: `*.spec.ts`
- E2E tests: `test/jest-e2e.json` config
- UI tests: Native Node.js test runner

## Key Technical Notes

- Node.js ≥20.0.0 required for all packages
- TypeScript strict mode enabled
- Monorepo structure requires building shared package first
- OpenCV capabilities checked at startup with compatibility matrix
- Universal coordinates stored in `config/universal-coordinates.yaml`
- Desktop accuracy metrics available at `/desktop` UI route