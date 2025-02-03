#!/bin/bash

# Default values
TAG="latest"
NO_CACHE=false

# Help message
show_help() {
    echo "Usage: ./build.sh [OPTIONS]"
    echo ""
    echo "Build the ByteBot Docker image"
    echo ""
    echo "Options:"
    echo "  -t, --tag TAG     Specify the tag for the image (default: latest)"
    echo "  -n, --no-cache    Build without using Docker cache"
    echo "  -h, --help        Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
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

# Execute the build
echo "Building ByteBot Docker image with tag: $IMAGE_NAME"
$BUILD_CMD -t "$IMAGE_NAME" -f docker/Dockerfile .

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build completed successfully!"
    echo "You can run the container using:"
    echo "docker run -d --privileged -p 3000:3000 -p 5900:5900 -p 6080:6080 -p 6081:6081 $IMAGE_NAME"
else
    echo "Build failed!"
    exit 1
fi 