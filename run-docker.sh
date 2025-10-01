#!/bin/bash

# ByteBot Hawkeye Docker Compose Helper Script
# This script allows you to run docker-compose commands from the project root
# while properly handling environment variables from docker/.env

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[bytebot]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[bytebot]${NC} ✓ $1"
}

print_warning() {
    echo -e "${YELLOW}[bytebot]${NC} ⚠ $1"
}

print_error() {
    echo -e "${RED}[bytebot]${NC} ✗ $1"
}

# Check if we're in the project root
if [[ ! -f "docker/docker-compose.yml" ]] || [[ ! -f "docker/docker-compose.proxy.yml" ]]; then
    print_error "This script must be run from the project root directory"
    print_error "Make sure you can see docker/docker-compose.yml and docker/docker-compose.proxy.yml"
    exit 1
fi

# Check if docker/.env exists
if [[ ! -f "docker/.env" ]]; then
    print_error "docker/.env file not found"
    print_error "Please create docker/.env with your API keys and configuration"
    print_error "You can use docker/.env.defaults as a template"
    exit 1
fi

# Default to proxy compose file (recommended for Hawkeye features)
COMPOSE_FILE="docker/docker-compose.proxy.yml"
USE_PROXY=true

# Parse command line arguments
DOCKER_COMPOSE_ARGS=()
SHOW_HELP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --standard)
            COMPOSE_FILE="docker/docker-compose.yml"
            USE_PROXY=false
            print_status "Using standard compose file (no LLM proxy)"
            shift
            ;;
        --proxy)
            COMPOSE_FILE="docker/docker-compose.proxy.yml"
            USE_PROXY=true
            print_status "Using proxy compose file (recommended)"
            shift
            ;;
        --fast)
            export BYTEBOT_UI_IMAGE="ghcr.io/bytebot-ai/bytebot-ui:edge"
            print_status "Using pre-built UI image (fast but excludes local changes)"
            shift
            ;;
        --help|-h)
            SHOW_HELP=true
            shift
            ;;
        *)
            DOCKER_COMPOSE_ARGS+=("$1")
            shift
            ;;
    esac
done

# Show help
if [[ "$SHOW_HELP" == "true" ]]; then
    echo "ByteBot Hawkeye Docker Compose Helper"
    echo ""
    echo "Usage: ./run-docker.sh [OPTIONS] [DOCKER_COMPOSE_ARGS...]"
    echo ""
    echo "Options:"
    echo "  --proxy     Use proxy compose file (default, recommended for Hawkeye)"
    echo "  --standard  Use standard compose file (direct AI provider connection)"
    echo "  --fast      Use pre-built UI image (faster but excludes your UI improvements)"
    echo "  --help, -h  Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./run-docker.sh up -d --build                    # Start with proxy + your UI improvements (default)"
    echo "  ./run-docker.sh --fast up -d --build             # Start with pre-built UI (faster, no local UI)"
    echo "  ./run-docker.sh --standard up -d --build         # Start with standard setup"
    echo "  ./run-docker.sh down                             # Stop services"
    echo "  ./run-docker.sh logs -f bytebot-agent            # Follow agent logs"
    echo "  ./run-docker.sh ps                               # Show running containers"
    echo ""
    echo "The proxy version is recommended because it:"
    echo "  - Supports all Hawkeye CV improvements"
    echo "  - Provides unified AI provider interface via LiteLLM"
    echo "  - Enables model switching and load balancing"
    echo "  - Builds UI from source for latest features"
    exit 0
fi

# Set environment variables from docker/.env
print_status "Loading environment variables from docker/.env"
set -a  # automatically export all variables
source docker/.env
set +a  # disable automatic export

# Validate critical environment variables
if [[ -z "$ANTHROPIC_API_KEY" ]] && [[ -z "$OPENAI_API_KEY" ]] && [[ -z "$GEMINI_API_KEY" ]]; then
    print_warning "No AI provider API keys found in docker/.env"
    print_warning "At least one API key is required for the agent to function"
fi

# Show configuration
if [[ "$USE_PROXY" == "true" ]]; then
    print_success "Using proxy setup for maximum Hawkeye capabilities"
    print_status "Services: desktop + agent + postgres + llm-proxy + ui"
else
    print_success "Using standard setup"
    print_status "Services: desktop + agent + postgres + ui"
fi

# Run docker-compose with the specified arguments
print_status "Running: docker-compose -f $COMPOSE_FILE ${DOCKER_COMPOSE_ARGS[*]}"
echo ""

exec docker-compose -f "$COMPOSE_FILE" "${DOCKER_COMPOSE_ARGS[@]}"