#!/bin/bash

# Get the absolute path to the project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Default values
PRODUCTION=false
TAG=""

# Help message
show_help() {
    echo "Usage: ./run.sh [OPTIONS]"
    echo ""
    echo "Run the Bytebot Docker container"
    echo ""
    echo "Options:"
    echo "  -p, --production  Run the production Docker image (default: development)"
    echo "  -t, --tag TAG     Specify the tag for the image (default: development or production)"
    echo "  -h, --help        Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--production)
            PRODUCTION=true
            shift
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set default tag if not provided
if [ -z "$TAG" ]; then
    if [ "$PRODUCTION" = true ]; then
        TAG="production"
    else
        TAG="development"
    fi
fi

IMAGE_NAME="bytebot:$TAG"

# Check if the Docker image exists
if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
    echo "Error: Docker image $IMAGE_NAME does not exist."
    echo "Please build it first using: ./scripts/build.sh"
    if [ "$PRODUCTION" = true ]; then
        echo "For production: ./scripts/build.sh --production"
    fi
    exit 1
fi

    echo "Running Bytebot with tag: $TAG"

    # Run the container
    docker run --privileged -d \
        -h "computer" \
        -p 9990:9990 -p 5900:5900 -p 6080:6080 -p 6081:6081 \
        --name "bytebot-$TAG" \
        "$IMAGE_NAME"


# Check if container started successfully
if docker ps | grep -q "bytebot:$TAG"; then
    echo "Bytebot container started successfully!"
else
    echo "Failed to start Bytebot container."
    exit 1
fi