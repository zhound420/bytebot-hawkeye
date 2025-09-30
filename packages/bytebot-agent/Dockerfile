# =============================================================================
# ByteBot Agent Dockerfile - Using urielch/opencv-nodejs with Node.js 20 upgrade
# =============================================================================

FROM urielch/opencv-nodejs:latest AS base

# Install additional system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    dpkg-dev \
    tesseract-ocr \
    tesseract-ocr-eng \
    # Canvas/Cairo dependencies
    libcairo2-dev \
    libpango1.0-dev \
    libpangocairo-1.0-0 \
    libglib2.0-dev \
    libfontconfig1-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    pkg-config \
    # Additional build tools
    build-essential \
    cmake \
    git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Upgrade to Node.js 20.x using NVM
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash

# Use NVM to install and use Node.js 20.x
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install 20.19.5 && nvm use 20.19.5 && nvm alias default 20.19.5

# Set PATH to prioritize NVM Node.js installation
ENV PATH="$NVM_DIR/versions/node/v20.19.5/bin:$PATH"

WORKDIR /app

# Copy package files for dependency resolution
COPY package.json ./
COPY ./packages ./packages
COPY ./config/universal-coordinates.yaml ./config/universal-coordinates.yaml

# Set environment variables for @u4/opencv4nodejs
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    NODE_PATH=/app/packages/bytebot-cv/node_modules:/usr/lib/node_modules \
    OPENCV4NODEJS_DISABLE_AUTOBUILD=1 \
    OPENCV4NODEJS_SKIP_TRACKING=1 \
    NPM_CONFIG_IGNORE_ENGINES=true

# Install shared dependencies first
WORKDIR /app/packages/shared
RUN echo "=== Installing shared dependencies ===" && \
    npm install --omit=dev --no-audit --no-fund

# Build shared package
RUN echo "=== Building shared package ===" && \
    npm run build

# Install bytebot-cv dependencies using the compatible @u4/opencv4nodejs
WORKDIR /app/packages/bytebot-cv
RUN echo "=== Installing bytebot-cv dependencies ===" && \
    echo "OpenCV 4.6.0 found, installing @u4/opencv4nodejs@7.1.2 with existing OpenCV..." && \
    # Set up OpenCV paths for the existing 4.6.0 installation
    export OPENCV4NODEJS_DISABLE_AUTOBUILD=0 && \
    export OPENCV4NODEJS_SKIP_TRACKING=1 && \
    export OPENCV_INCLUDE_DIR="/usr/src/opencv/opencv-4.6.0-ecae4/build" && \
    export OPENCV_LIB_DIR="/usr/src/opencv/opencv-4.6.0-ecae4/build/lib" && \
    export PKG_CONFIG_PATH="/usr/src/opencv/opencv-4.6.0-ecae4/build/lib/pkgconfig:$PKG_CONFIG_PATH" && \
    echo "Installing all dependencies..." && \
    npm install --include=dev --no-audit --no-fund && \
    echo "=== Building bytebot-cv ===" && \
    npm run build && \
    echo "✓ bytebot-cv built successfully with @u4/opencv4nodejs@7.1.2"

# Install and build bytebot-agent
WORKDIR /app/packages/bytebot-agent
RUN echo "=== Installing bytebot-agent dependencies ===" && \
    npm install --include=dev --no-audit --no-fund --ignore-engines --ignore-scripts && \
    echo "✓ bytebot-agent dependencies installed successfully"

# Generate Prisma client
RUN echo "=== Generating Prisma client ===" && \
    npx prisma generate

# Build the application
RUN echo "=== Building bytebot-agent application ===" && \
    npm run build:dist

# Note: Skipping npm prune to avoid OpenCV rebuild issues
# The container size is acceptable without pruning, and this prevents
# opencv4nodejs from trying to rebuild during prune operations

# Note: OpenCV verification skipped in build - will be validated at runtime
RUN echo "=== Build completed successfully ===" && \
    echo "Node version: $(node --version)" && \
    echo "OpenCV libraries installed via system packages" && \
    echo "Prisma client generated successfully"

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "try { \
        const cv = require('opencv4nodejs'); \
        console.log('Health check: opencv4nodejs loaded'); \
        const testMat = new cv.Mat(5, 5, cv.CV_8UC3); \
        console.log('Health check: basic Mat operations work'); \
        process.exit(0); \
      } catch (error) { \
        console.error('Health check failed:', error.message); \
        process.exit(1); \
      }"

WORKDIR /app/packages/bytebot-agent

# Start the application with enhanced startup script
CMD ["node", "scripts/enhanced-startup.js"]

ENV BYTEBOT_OCR_DEBUG=false
