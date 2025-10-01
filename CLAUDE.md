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

## Enhanced Computer Vision Pipeline (OpenCV 4.6.0)

The bytebot-cv package provides comprehensive computer vision capabilities:

### Multi-Method Detection System
- **Template Matching**: Pixel-perfect UI element matching with multi-scale detection
- **Feature Detection**: ORB and AKAZE feature matching with homography-based localization, robust to UI variations
- **Contour Analysis**: Shape-based detection for buttons, input fields, and icons using advanced morphological operations
- **Enhanced OCR Pipeline**: Tesseract with morphological gradients, bilateral filtering, and CLAHE contrast enhancement
- **Multi-Method Fusion**: Combines all detection methods intelligently for maximum reliability

### Core Services
- `EnhancedVisualDetectorService`: Orchestrates all CV methods with performance metrics
- `TemplateMatcherService`: Multi-scale template matching with confidence scoring
- `FeatureMatcherService`: ORB and AKAZE feature detection with homography validation
- `ContourDetectorService`: Advanced shape analysis with morphological operations
- `CVActivityIndicatorService`: Real-time monitoring of active CV methods
- `ElementDetectorService`: Unified element detection with structured metadata output
- `UniversalDetectorService`: High-level API for UI element detection

### OpenCV 4.6.0 Capabilities
- ✅ Template matching, Feature detection (ORB/AKAZE), Morphological operations
- ✅ CLAHE contrast enhancement, Gaussian blur, Bilateral filtering
- ✅ Canny edge detection, Contour analysis, Adaptive thresholding
- ✅ Button detection, Input field identification, Icon recognition
- ✅ Text extraction with preprocessing, Clickable element mapping
- ✅ Real-time CV method tracking with performance metrics

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

## Additional Development Notes

### Running Single Tests
```bash
# bytebot-agent
cd packages/bytebot-agent && npm run test -- --testNamePattern="YourTestName"
cd packages/bytebot-agent && npm run test:e2e -- --testNamePattern="YourE2ETest"

# bytebotd
cd packages/bytebotd && npm run test -- --testNamePattern="YourTestName"

# bytebot-ui (native Node.js test runner)
cd packages/bytebot-ui && npm run test -- --test-name-pattern="YourTestName"
```

### Package Dependencies
The monorepo has these internal dependencies:
- `bytebot-agent` depends on `shared` and `bytebot-cv`
- `bytebot-ui` depends on `shared`
- `bytebotd` depends on `shared` and `bytebot-cv`
- All packages must build `shared` first via npm scripts

### Database Schema Management
```bash
cd packages/bytebot-agent
npm run prisma:dev         # Reset DB + run migrations + generate client
npx prisma migrate dev      # Create and apply new migration
npx prisma generate         # Generate Prisma client only
npx prisma studio          # Open database browser
```

## Computer Vision Development Workflow

When working with the enhanced CV capabilities:

### CV Tool Usage Pattern
```bash
# The AI agent should follow this pattern:
# 1. Take screenshot
# 2. Call computer_detect_elements with target description
# 3. Analyze returned elements (confidence scores, bounding boxes)
# 4. Click using computer_click_element with element_id
# 5. Verify with confirmation screenshot
```

### CV Environment Variables
```bash
# Enhanced CV detection (enabled by default)
BYTEBOT_CV_ENHANCED_DETECTION=true
BYTEBOT_CV_ACTIVITY_TRACKING=true

# CV Method Configuration
BYTEBOT_CV_TEMPLATE_MATCHING=true
BYTEBOT_CV_FEATURE_DETECTION=true
BYTEBOT_CV_CONTOUR_ANALYSIS=true
BYTEBOT_CV_OCR_ENABLED=false  # Expensive, opt-in

# CV Performance Tuning
BYTEBOT_CV_CONFIDENCE_THRESHOLD=0.6
BYTEBOT_CV_MAX_RESULTS=20
BYTEBOT_CV_TEMPLATE_THRESHOLD=0.8
```

### CV Debugging
```bash
# Verify OpenCV capabilities
cd packages/bytebot-cv && npm run verify

# Check CV activity in real-time via REST endpoints:
# GET /cv-activity/status - Current active methods
# GET /cv-activity/performance - Method performance stats
# SSE /cv-activity/stream - Real-time updates
```