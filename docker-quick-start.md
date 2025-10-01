# ByteBot Hawkeye - Quick Start Guide

## Starting the Services

You can now start ByteBot Hawkeye from the project root using either method:

### Option 1: Helper Script (Recommended)

```bash
# Start all services with proxy + pre-built UI (fast, recommended)
./run-docker.sh up -d --build

# Start with locally built UI (slower, includes your UI changes)
./run-docker.sh --build-ui up -d --build

# View logs
./run-docker.sh logs -f

# Stop services
./run-docker.sh down

# Get help
./run-docker.sh --help
```

### Option 2: Manual Docker Compose

```bash
# From project root - pre-built UI (fast)
docker-compose -f docker/docker-compose.proxy.yml up -d --build

# From project root - build UI from source (slow, includes local changes)
BYTEBOT_UI_IMAGE=bytebot-ui:local docker-compose -f docker/docker-compose.proxy.yml up -d --build

# Or from docker directory
cd docker
docker-compose -f docker-compose.proxy.yml up -d --build
```

## UI Build Options

**Pre-built UI (Default)**: ⚡ Fast startup, stable, but won't include your local UI changes
**Local UI Build**: 🔨 Slower build (~5-10 min), includes all your local modifications

## Why Use the Proxy Version?

The proxy setup (`docker-compose.proxy.yml`) provides:

- ✅ **Full Hawkeye CV capabilities** with OpenCV 4.6.0 enhancements
- ✅ **Multi-provider AI support** via LiteLLM (Anthropic, OpenAI, Gemini, OpenRouter)
- ✅ **Model switching and load balancing**
- ✅ **Latest UI features** (built from source)
- ✅ **Better error handling** and rate limit management

## Environment Configuration

Make sure your `docker/.env` file contains your API keys:

```bash
# AI Provider API Keys (at least one required)
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
GEMINI_API_KEY=your-key-here
OPENROUTER_API_KEY=your-key-here

# Analytics & Database
BYTEBOT_ANALYTICS_ENABLED=true
BYTEBOT_MIGRATION_STRATEGY=auto
```

## Service URLs

- **Web Interface**: http://localhost:9992
- **Agent API**: http://localhost:9991
- **Desktop VNC**: http://localhost:9990
- **LLM Proxy**: http://localhost:4000

## Troubleshooting

If you encounter issues, see `docker/troubleshoot-database.md` for detailed troubleshooting steps.

Common issues:
- **Missing API keys**: Check `docker/.env` file
- **Database errors**: The enhanced startup script will handle migrations automatically
- **Container startup order**: Healthchecks ensure proper startup sequence