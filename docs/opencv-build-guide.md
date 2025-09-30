# OpenCV Build Guide for ByteBot

This guide documents the OpenCV build process, dependency management, and troubleshooting for the ByteBot project.

## Overview

ByteBot uses `opencv4nodejs` to provide computer vision capabilities. This package requires careful configuration to work properly in containerized environments.

## Architecture

### Multi-Stage Build Process

The ByteBot agent uses a 3-stage Docker build:

1. **OpenCV Builder Stage**: Compiles opencv4nodejs with all dependencies
2. **Application Builder Stage**: Builds the Node.js application
3. **Production Runtime Stage**: Minimal runtime environment

### Key Components

- **opencv4nodejs**: Node.js bindings for OpenCV
- **native-node-utils**: Utility library used by opencv4nodejs
- **System OpenCV**: Ubuntu packages providing OpenCV libraries

## Dependency Matrix

### Supported Configurations

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 20.x | Required for opencv4nodejs compatibility |
| OpenCV | 4.6.x | System packages from Ubuntu 22.04 |
| opencv4nodejs | 5.6.0 | Pinned version for stability |
| Ubuntu | 22.04 | Base container OS |
| Architecture | x64, arm64 | Multi-architecture support |

### Required System Packages

#### Build Dependencies
```bash
build-essential
cmake
git
pkg-config
libgtk-3-dev
libjpeg-dev
libpng-dev
libtiff-dev
libgif-dev
libcairo2-dev
libavcodec-dev
libavformat-dev
libswscale-dev
libopenexr-dev
libgstreamer1.0-dev
libgstreamer-plugins-base1.0-dev
```

#### OpenCV Development Packages
```bash
libopencv-dev
libopencv-contrib-dev
libopencv-imgproc-dev
libopencv-imgcodecs-dev
libopencv-objdetect-dev
libopencv-ml-dev
libopencv-photo-dev
libopencv-video-dev
libopencv-calib3d-dev
libopencv-features2d-dev
libopencv-highgui-dev
```

#### Runtime Dependencies
```bash
libopencv-core4.6
libopencv-imgproc4.6
libopencv-imgcodecs4.6
libopencv-highgui4.6
libopencv-features2d4.6
libopencv-calib3d4.6
libopencv-objdetect4.6
libopencv-video4.6
libopencv-ml4.6
libopencv-photo4.6
libopencv-face4.6
libopencv-text4.6
libopencv-dnn4.6
tesseract-ocr
tesseract-ocr-eng
```

## Environment Variables

### Required Variables
```bash
OPENCV4NODEJS_DISABLE_AUTOBUILD=1
OPENCV4NODEJS_SKIP_TRACKING=1
CXXFLAGS="-DOPENCV_ENABLE_NONFREE"
```

### Architecture-Specific Variables
```bash
# Set automatically based on system architecture
OPENCV_LIB_DIR=/usr/lib/${multiarch}
OPENCV_INCLUDE_DIR=/usr/include/opencv4
OPENCV_BIN_DIR=/usr/bin
```

## Build Process

### 1. Patching System

The build process includes comprehensive patching:

- **Warning Suppression**: Eliminates unused function warnings from native-node-utils
- **SIFT Compatibility**: Handles OpenCV version differences for SIFT detector
- **CLAHE Support**: Adds custom CLAHE (Contrast Limited Adaptive Histogram Equalization) bindings
- **xfeatures2d Handling**: Gracefully handles missing xfeatures2d dependencies

### 2. Verification Steps

Each build stage includes verification:

- **Build-time verification**: Confirms opencv4nodejs compiles correctly
- **Runtime verification**: Tests basic OpenCV functionality
- **Health checks**: Continuous monitoring of OpenCV availability

### 3. Error Handling

Comprehensive error handling for:

- Missing system dependencies
- Compilation failures
- Runtime binding issues
- Architecture-specific problems

## Troubleshooting

### Common Issues

#### 1. Compilation Warnings
**Symptoms**: Unused function warnings from native-node-utils
**Solution**: Automatic pragma directive insertion via patching system

#### 2. Runtime Compilation Failures
**Symptoms**: Container crashes during startup with compilation errors
**Solution**: Eliminated runtime compilation; everything built at container build time

#### 3. Missing xfeatures2d
**Symptoms**: `opencv2/xfeatures2d.hpp: No such file or directory`
**Solution**: Automatic detection and graceful fallback

#### 4. Memory Issues During Build
**Symptoms**: `g++: fatal error: Killed signal terminated program cc1plus`
**Solution**: Multi-stage builds reduce memory pressure

### Debugging Commands

#### Check Container Status
```bash
cd docker && docker compose ps
```

#### View Build Logs
```bash
cd docker && docker compose logs bytebot-agent
```

#### Manual Verification
```bash
# Inside container
node packages/bytebot-cv/scripts/verify-opencv-capabilities.js
```

#### Test OpenCV Functionality
```bash
# Inside container
node -e "const cv = require('opencv4nodejs'); console.log('OpenCV version:', cv.version);"
```

## Development Workflow

### Local Development
1. OpenCV is not required for local development
2. Use Docker containers for OpenCV-dependent features
3. Mock OpenCV functionality for unit tests

### Container Development
1. Build containers with `docker compose build`
2. Verify with `docker compose logs`
3. Test functionality with verification scripts

### Production Deployment
1. Use pre-built images when possible
2. Ensure health checks are enabled
3. Monitor OpenCV functionality

## Performance Considerations

### Build Time Optimization
- Multi-stage builds reduce final image size
- Cached layers speed up rebuilds
- Parallel compilation where possible

### Runtime Optimization
- Pre-compiled bindings eliminate startup delays
- Health checks ensure reliability
- Minimal runtime dependencies

## Security Considerations

### Dependency Management
- Pinned versions prevent supply chain attacks
- Regular security updates for system packages
- Minimal attack surface in production images

### Container Security
- Non-root user execution
- Minimal runtime privileges
- Secure base images

## Maintenance

### Regular Tasks
1. Update pinned dependency versions quarterly
2. Test compatibility with new OpenCV releases
3. Monitor for security vulnerabilities
4. Update documentation as needed

### Version Upgrades
1. Test in development environment first
2. Update compatibility matrix
3. Verify all verification scripts pass
4. Update documentation

## Support

### Getting Help
- Check this documentation first
- Review container logs for specific errors
- Use verification scripts to diagnose issues
- Check GitHub issues for known problems

### Reporting Issues
Include the following information:
- Container build logs
- Runtime error messages
- System architecture (x64/arm64)
- OpenCV version information
- Verification script output
