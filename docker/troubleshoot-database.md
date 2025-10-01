# Database Connection Troubleshooting Guide

If you're experiencing database connection issues with the Bytebot Hawkeye agent, follow these steps:

## Quick Fixes

### 1. Use Healthchecks (Recommended Solution)
The updated Docker Compose files now include PostgreSQL healthchecks. Make sure you're using the latest version:

```bash
# Pull the latest changes
git pull

# Rebuild with fresh containers
docker compose -f docker/docker-compose.yml down
docker compose -f docker/docker-compose.yml up --build
```

### 2. Manual Container Startup Order
If healthchecks don't work, start containers manually in the correct order:

```bash
# Start PostgreSQL first
docker compose -f docker/docker-compose.yml up postgres -d

# Wait for PostgreSQL to be ready (check logs)
docker compose -f docker/docker-compose.yml logs -f postgres

# Once you see "database system is ready to accept connections", start the rest
docker compose -f docker/docker-compose.yml up
```

## Diagnostic Commands

### Check Container Status
```bash
# View all containers
docker compose -f docker/docker-compose.yml ps

# Check specific container health
docker inspect bytebot-postgres --format='{{.State.Health.Status}}'
```

### Check Database Connectivity
```bash
# Test from host
docker run --rm --network bytebot_bytebot-network postgres:16-alpine \
  psql postgresql://postgres:postgres@postgres:5432/bytebotdb -c "SELECT 1;"

# Test from agent container
docker compose -f docker/docker-compose.yml exec bytebot-agent \
  node -e "const {PrismaClient} = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$queryRaw\`SELECT 1\`.then(() => {console.log('✓ Connected'); process.exit(0)}).catch(e => {console.error('✗ Failed:', e.message); process.exit(1)})"
```

### Check Logs
```bash
# PostgreSQL logs
docker compose -f docker/docker-compose.yml logs postgres

# Agent logs
docker compose -f docker/docker-compose.yml logs bytebot-agent

# Follow logs in real-time
docker compose -f docker/docker-compose.yml logs -f
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

Ensure these variables are properly set in your environment or `.env` file:

```bash
# Required for database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/bytebotdb

# Optional but recommended
BYTEBOT_DB_RESET_ALLOWED=true
BYTEBOT_MIGRATION_STRATEGY=auto
NODE_ENV=production
```

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