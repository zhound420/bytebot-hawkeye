#!/bin/bash

# Get the absolute path to the project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Default values
PRODUCTION=false
TAG=""
NO_CACHE=false
DOCKERFILE="${PROJECT_ROOT}/docker/Dockerfile"

# Help message
show_help() {
    echo "Usage: ./build.sh [OPTIONS]"
    echo ""
    echo "Build the Bytebot Docker image"
    echo ""
    echo "Options:"
    echo "  -p, --production  Build the production Docker image (default: development)"
    echo "  -t, --tag TAG     Specify the tag for the image (default: development or production)"
    echo "  -n, --no-cache    Build without using Docker cache"
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
        -n|--no-cache)
            NO_CACHE=true
            shift
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


# Check for existing image and remove it
IMAGE_NAME="bytebot:$TAG"
if docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
    echo "Found existing image $IMAGE_NAME. Removing..."
    if ! docker rmi "$IMAGE_NAME" >/dev/null 2>&1; then
        echo "Warning: Failed to remove existing image. It might be in use."
        echo "Please stop and remove any containers using this image first."
        exit 1
    fi
    echo "Successfully removed existing image."
fi

# Build command construction
BUILD_CMD="docker build"
if [ "$NO_CACHE" = true ]; then
    BUILD_CMD="$BUILD_CMD --no-cache"
fi

# Execute the build with absolute paths
echo "Building Bytebot Docker image with tag: $IMAGE_NAME"
$BUILD_CMD -t "$IMAGE_NAME" -f "$DOCKERFILE" "$PROJECT_ROOT"

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build completed successfully!"
else
    echo "Build failed!"
    exit 1
fi