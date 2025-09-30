#!/bin/bash

# Test script to verify canvas module fix in Docker container
set -e

echo "🔧 Testing Canvas Module Fix for ByteBot Docker Container"
echo "============================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Build the Docker image
print_status "Building Docker image with canvas fixes..."

# Make sure we're in the project root directory
if [ ! -d "packages/bytebotd" ]; then
    print_error "Must run from project root directory (should contain packages/bytebotd)"
    exit 1
fi

# Build the image with verbose output from the correct directory
if docker build -f packages/bytebotd/Dockerfile -t bytebot-canvas-test . --progress=plain; then
    print_success "Docker image built successfully!"
else
    print_error "Docker build failed. Check the output above for details."
    exit 1
fi

# Test container startup (run in detached mode with timeout)
print_status "Testing container startup..."
CONTAINER_ID=$(docker run -d --name bytebot-canvas-test-instance bytebot-canvas-test)

if [ $? -eq 0 ]; then
    print_success "Container started with ID: $CONTAINER_ID"
    
    # Wait a moment for services to initialize
    print_status "Waiting 10 seconds for services to initialize..."
    sleep 10
    
    # Check container logs for canvas errors
    print_status "Checking container logs for canvas-related errors..."
    CANVAS_ERRORS=$(docker logs $CONTAINER_ID 2>&1 | grep -i "canvas.*error\|module.*108.*115" || true)
    
    if [ -z "$CANVAS_ERRORS" ]; then
        print_success "No canvas module errors found in logs!"
    else
        print_warning "Found potential canvas issues:"
        echo "$CANVAS_ERRORS"
    fi
    
    # Check if bytebotd service is running
    print_status "Checking bytebotd service status..."
    BYTEBOTD_STATUS=$(docker logs $CONTAINER_ID 2>&1 | grep -E "bytebotd.*RUNNING|bytebotd.*FATAL" | tail -1 || true)
    
    if [[ "$BYTEBOTD_STATUS" == *"RUNNING"* ]]; then
        print_success "ByteBotD service is running successfully!"
        TEST_RESULT="PASSED"
    elif [[ "$BYTEBOTD_STATUS" == *"FATAL"* ]]; then
        print_error "ByteBotD service failed to start"
        TEST_RESULT="FAILED"
    else
        print_warning "ByteBotD service status unclear"
        TEST_RESULT="UNCLEAR"
    fi
    
    # Show recent logs
    print_status "Recent container logs (last 20 lines):"
    docker logs --tail 20 $CONTAINER_ID
    
    # Cleanup
    print_status "Cleaning up test container..."
    docker stop $CONTAINER_ID > /dev/null 2>&1
    docker rm $CONTAINER_ID > /dev/null 2>&1
    
else
    print_error "Failed to start container"
    TEST_RESULT="FAILED"
fi

# Summary
echo
echo "============================================================"
if [ "$TEST_RESULT" = "PASSED" ]; then
    print_success "✅ Canvas fix test PASSED - ByteBotD started successfully!"
elif [ "$TEST_RESULT" = "FAILED" ]; then
    print_error "❌ Canvas fix test FAILED - ByteBotD could not start"
    exit 1
else
    print_warning "⚠️  Canvas fix test UNCLEAR - Manual verification needed"
fi

echo
print_status "To run the container manually for further testing:"
echo "  docker run -p 9990:9990 bytebot-canvas-test"
echo
print_status "To clean up the test image:"
echo "  docker rmi bytebot-canvas-test"
