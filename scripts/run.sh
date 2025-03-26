#!/bin/bash

# Get the absolute path to the project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Default values
PRODUCTION=false
TAG=""
QCOW_IMAGE="${PROJECT_ROOT}/docker/development/bytebot-os-image.qcow2"

# Help message
show_help() {
    echo "Usage: ./run.sh [OPTIONS]"
    echo ""
    echo "Run the ByteBot Docker container"
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

if [ "$PRODUCTION" = true ]; then
    echo "Running ByteBot in production mode with tag: $TAG"

    # Run the production container
    docker run -d --privileged \
        -p 3000:3000 -p 5900:5900 -p 6080:6080 -p 6081:6081 \
        --name "bytebot-$TAG" \
        "$IMAGE_NAME"
else
    echo "Running ByteBot in development mode with tag: $TAG"

    # Check if QCOW image exists
    if [ ! -f "$QCOW_IMAGE" ]; then
        echo "Error: QCOW image not found at $QCOW_IMAGE"
        echo "Please build the development image first: ./scripts/build.sh"
        exit 1
    fi

    # Determine appropriate acceleration
    # Check if hvf is available in QEMU's supported accelerators
    if qemu-system-x86_64 -accel help 2>&1 | grep -q "hvf"; then
        # hvf accelerator is supported
        ACCEL="-accel hvf"
    elif [ -e /dev/kvm ]; then
        # Linux with KVM available
        ACCEL="-accel kvm"
    else
        # Fallback to software emulation
        ACCEL="-accel tcg"
    fi

    # Start QEMU in the background
    echo "Starting QEMU with VNC on port 5900 and QMP TCP on port 4444"
    qemu-system-x86_64 \
        -m 8G \
        -smp 4 \
        $ACCEL \
        -drive file="$QCOW_IMAGE",format=qcow2 \
        -vnc 0.0.0.0:0 \
        -qmp tcp:0.0.0.0:4444,server,nowait \
        -device qemu-xhci,id=xhci \
        -device usb-tablet,bus=xhci.0 \
        -boot c \
        &

    QEMU_PID=$!
    echo "QEMU started with PID: $QEMU_PID"

    # Give QEMU a moment to initialize
    sleep 2

    # Run the development container with a shared volume for QMP socket
    echo "Starting ByteBot development container"
    docker run -d --privileged \
    -e QEMU_HOST=host.docker.internal \
        -p 3000:3000 -p 5900:5900 -p 6080:6080 -p 6081:6081  \
        "$IMAGE_NAME"

    echo "ByteBot development environment is running!"
    echo "Access the REST API at: http://localhost:3000/computer-use"
    echo "Access the noVNC interface at: http://localhost:3000/vnc"
    echo ""
    echo "To stop the environment:"
    echo "  1. Stop the Docker container: docker stop bytebot:$TAG"
    echo "  2. Kill the QEMU process: kill $QEMU_PID"
fi

# Check if container started successfully
if docker ps | grep -q "bytebot:$TAG"; then
    echo "ByteBot container started successfully!"
else
    echo "Failed to start ByteBot container."
    if [ "$PRODUCTION" = false ]; then
        echo "Cleaning up QEMU process..."
        kill $QEMU_PID 2>/dev/null
    fi
    exit 1
fi