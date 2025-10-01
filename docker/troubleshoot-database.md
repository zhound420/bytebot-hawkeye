# Database Connection Troubleshooting Guide

If you're experiencing database connection issues with the Bytebot Hawkeye agent, follow these steps:

## Quick Fixes

### 1. Use Healthchecks (Recommended Solution)
The updated Docker Compose files now include PostgreSQL healthchecks. Make sure you're using the latest version:

#### Option A: Using the helper script (Recommended)
```bash
# Pull the latest changes
git pull

# From project root - the script handles environment loading
./run-docker.sh down
./run-docker.sh up --build -d
```

#### Option B: Manual docker-compose commands
```bash
# Pull the latest changes
git pull

# IMPORTANT: Run from the docker/ directory to pick up .env file
cd docker

# Rebuild with fresh containers
docker compose -f docker-compose.proxy.yml down
docker compose -f docker-compose.proxy.yml up --build -d
```

### 2. Manual Container Startup Order
If healthchecks don't work, start containers manually in the correct order:

```bash
# Change to docker directory first
cd docker

# Start PostgreSQL first
docker compose -f docker-compose.yml up postgres -d

# Wait for PostgreSQL to be ready (check logs)
docker compose -f docker-compose.yml logs -f postgres

# Once you see "database system is ready to accept connections", start the rest
docker compose -f docker-compose.yml up
```

## Diagnostic Commands

### Check Container Status
```bash
# Change to docker directory first
cd docker

# View all containers
docker compose -f docker-compose.yml ps

# Check specific container health
docker inspect bytebot-postgres --format='{{.State.Health.Status}}'
```

### Check Database Connectivity
```bash
# Change to docker directory first
cd docker

# Test from host
docker run --rm --network bytebot_bytebot-network postgres:16-alpine \
  psql postgresql://postgres:postgres@postgres:5432/bytebotdb -c "SELECT 1;"

# Test from agent container
docker compose -f docker-compose.yml exec bytebot-agent \
  node -e "const {PrismaClient} = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$queryRaw\`SELECT 1\`.then(() => {console.log('✓ Connected'); process.exit(0)}).catch(e => {console.error('✗ Failed:', e.message); process.exit(1)})"
```

### Check Logs
```bash
# Change to docker directory first
cd docker

# PostgreSQL logs
docker compose -f docker-compose.yml logs postgres

# Agent logs
docker compose -f docker-compose.yml logs bytebot-agent

# Follow logs in real-time
docker compose -f docker-compose.yml logs -f
```

## Architecture-Specific Issues

### x86 VM Issues
If running on x86 VM (different from your MacBook), you may need:

1. **Platform specification:**
```bash
docker compose -f docker/docker-compose.yml build --platform linux/amd64
```

2. **Memory/resource limits:**
```bash
# Add to your .env file
COMPOSE_DOCKER_CLI_BUILD=1
DOCKER_BUILDKIT=1
```

3. **Build without cache:**
```bash
docker compose -f docker/docker-compose.yml build --no-cache
```

## Environment Variables

Ensure these variables are properly set in your `docker/.env` file:

```bash
# Required for database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/bytebotdb

# AI Provider API Keys
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
OPENROUTER_API_KEY=your-openrouter-key

# Analytics Configuration
BYTEBOT_ANALYTICS_ENDPOINT=http://localhost:9991/api/analytics
BYTEBOT_ANALYTICS_ENABLED=true

# Database Migration Settings
BYTEBOT_DB_RESET_ALLOWED=true
BYTEBOT_MIGRATION_STRATEGY=auto
NODE_ENV=production
```

**IMPORTANT**: Make sure to run `docker compose` commands from the `docker/` directory so the `.env` file is properly loaded. API key warnings will appear if docker-compose can't find the environment variables.

## Manual Database Reset

If the database gets into a bad state:

```bash
# Stop containers
docker compose -f docker/docker-compose.yml down

# Remove database volume
docker volume rm bytebot_postgres_data

# Start fresh
docker compose -f docker/docker-compose.yml up --build
```

## Still Having Issues?

1. Check that your VM has enough resources (4GB+ RAM recommended)
2. Verify network connectivity between containers
3. Try the proxy compose file instead: `docker-compose.proxy.yml`
4. Check for firewall/security software blocking container communication

For persistent issues, share the output of:
```bash
docker compose -f docker/docker-compose.yml logs bytebot-agent
docker compose -f docker/docker-compose.yml logs postgres
docker system info
```