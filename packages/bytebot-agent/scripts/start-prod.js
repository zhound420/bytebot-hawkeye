#!/usr/bin/env node
const { existsSync } = require('fs');
const fs = require('fs');
const path = require('path');

/**
 * Extract OpenCV version string from various possible formats
 */
function getOpenCvVersionString(cv) {
  if (!cv) return 'unavailable';
  
  // Try cv.version as string
  if (typeof cv.version === 'string') {
    return cv.version;
  }
  
  // Try cv.version as object {major, minor, patch}
  if (typeof cv.version === 'object' && cv.version !== null) {
    const { major, minor, patch, revision } = cv.version;
    if (major !== undefined) {
      return `${major}.${minor || 0}.${patch || 0}${revision ? `.${revision}` : ''}`;
    }
  }
  
  // Try cv.VERSION
  if (typeof cv.VERSION === 'string') {
    return cv.VERSION;
  }
  
  // Try extracting from getBuildInformation
  if (typeof cv.getBuildInformation === 'function') {
    try {
      const buildInfo = cv.getBuildInformation();
      const match = buildInfo.match(/OpenCV\s+(\d+\.\d+\.\d+)/i);
      if (match && match[1]) {
        return match[1];
      }
    } catch {}
  }
  
  return 'unknown';
}

/**
 * Try to load opencv4nodejs from multiple possible locations with platform awareness
 */
function loadOpenCvWithFallback() {
  const possiblePaths = [
    'opencv4nodejs',  // Standard require
    '../bytebot-cv/node_modules/opencv4nodejs',  // From agent to cv package
    '../../bytebot-cv/node_modules/opencv4nodejs',     // Alternative relative path
    './node_modules/opencv4nodejs',                    // Local node_modules
    '../node_modules/opencv4nodejs',                   // Parent node_modules
    path.resolve(__dirname, '..', 'node_modules', 'opencv4nodejs'), // Absolute path from script dir
    path.resolve(__dirname, '..', '..', 'bytebot-cv', 'node_modules', 'opencv4nodejs'), // Absolute path to CV package
  ];

  let lastError = null;
  
  console.log(`[start-prod] Runtime context: ${__dirname}`);
  console.log(`[start-prod] Working directory: ${process.cwd()}`);
  console.log(`[start-prod] Node.js architecture: ${process.arch}`);
  console.log(`[start-prod] Platform: ${process.platform}`);
  
  for (const modulePath of possiblePaths) {
    try {
      console.log(`[start-prod] Attempting to require: ${modulePath}`);
      
      // First try to resolve the path
      let resolvedPath;
      try {
        resolvedPath = require.resolve(modulePath);
        console.log(`[start-prod] Resolved path: ${resolvedPath}`);
      } catch (resolveError) {
        console.log(`[start-prod] ✗ Could not resolve path ${modulePath}: ${resolveError.message}`);
        lastError = resolveError;
        continue;
      }
      
      // Check if the native binding exists
      const bindingPath = path.join(path.dirname(resolvedPath), '..', 'build', 'Release', 'opencv4nodejs.node');
      if (fs.existsSync(bindingPath)) {
        console.log(`[start-prod] ✓ Native binding found at: ${bindingPath}`);
      } else {
        console.log(`[start-prod] ⚠ Native binding not found at expected location: ${bindingPath}`);
      }
      
      // Try to load the module
      const module = require(modulePath);
      if (module && typeof module.Mat === 'function') {
        console.log(`[start-prod] ✓ Successfully loaded opencv4nodejs from: ${modulePath}`);
        console.log(`[start-prod] ✓ OpenCV version: ${getOpenCvVersionString(module)}`);
        
        // Set environment variables for runtime services
        process.env.OPENCV_MODULE_PATH = resolvedPath;
        process.env.OPENCV_RUNTIME_CONTEXT = 'start-prod';
        process.env.OPENCV_NATIVE_BINDING_PATH = bindingPath;
        
        // Test basic functionality
        try {
          const testMat = new module.Mat(1, 1, module.CV_8UC1);
          console.log(`[start-prod] ✓ Basic Mat creation test passed`);
          return module;
        } catch (testError) {
          console.log(`[start-prod] ⚠ Module loaded but basic test failed: ${testError.message}`);
          lastError = testError;
          continue;
        }
      } else {
        console.log(`[start-prod] ✗ Module loaded but invalid: ${typeof module}`);
        lastError = new Error(`Invalid opencv4nodejs module loaded from ${modulePath}`);
        continue;
      }
    } catch (error) {
      console.log(`[start-prod] ✗ Failed to load from ${modulePath}: ${error.message}`);
      if (error.code === 'MODULE_NOT_FOUND') {
        console.log(`[start-prod]   Reason: Module not found`);
      } else if (error.message.includes('build/Release/opencv4nodejs')) {
        console.log(`[start-prod]   Reason: Native binding missing or incompatible`);
      }
      lastError = error;
      continue;
    }
  }

  // If we get here, all attempts failed
  throw lastError || new Error('All opencv4nodejs loading attempts failed');
}

/**
 * Comprehensive opencv4nodejs verification with detailed diagnostics
 */
function verifyOpenCvBindings() {
  console.log('[start-prod] Starting comprehensive opencv4nodejs verification...');
  
  try {
    // Try multiple locations for opencv4nodejs module
    const possibleModulePaths = [
      path.resolve(__dirname, '..', 'node_modules', 'opencv4nodejs'),
      path.resolve(__dirname, '..', '..', 'bytebot-cv', 'node_modules', 'opencv4nodejs'),
      path.resolve(__dirname, '..', '..', '..', 'node_modules', 'opencv4nodejs')
    ];
    
    let moduleDir = null;
    for (const dir of possibleModulePaths) {
      if (existsSync(dir)) {
        moduleDir = dir;
        break;
      }
    }
    
    if (!moduleDir) {
      throw new Error('opencv4nodejs module directory not found in any expected location');
    }
    console.log(`[start-prod] ✓ opencv4nodejs module directory found at: ${moduleDir}`);
    
    // Check for compiled bindings
    const bindingPath = path.join(moduleDir, 'build', 'Release', 'opencv4nodejs.node');
    if (!existsSync(bindingPath)) {
      console.log('[start-prod] ⚠ Compiled binding not found, checking alternative locations...');
      
      // Check for prebuilt bindings
      const prebuiltPath = path.join(moduleDir, 'lib', 'cv.js');
      if (!existsSync(prebuiltPath)) {
        console.log('[start-prod] ⚠ Standard binding locations not found, attempting require...');
      } else {
        console.log('[start-prod] ✓ Prebuilt bindings detected');
      }
    } else {
      console.log('[start-prod] ✓ Compiled bindings found');
    }
    
    // Attempt to load opencv4nodejs using multi-path approach
    console.log('[start-prod] Loading opencv4nodejs module...');
    const cv = loadOpenCvWithFallback();
    
    if (!cv) {
      throw new Error('opencv4nodejs module loaded but returned null/undefined');
    }
    console.log('[start-prod] ✓ opencv4nodejs module loaded successfully');
    
    // Verify core functionality
    if (typeof cv.Mat !== 'function') {
      throw new Error('cv.Mat constructor not available - core functionality missing');
    }
    console.log('[start-prod] ✓ cv.Mat constructor available');
    
    // Test basic Mat creation and operations
    console.log('[start-prod] Testing basic Mat operations...');
    const testMat = new cv.Mat(10, 10, cv.CV_8UC3);
    if (!testMat || testMat.rows !== 10 || testMat.cols !== 10) {
      throw new Error('Mat creation test failed - invalid dimensions');
    }
    
    // Test basic image processing
    const grayMat = testMat.cvtColor(cv.COLOR_BGR2GRAY);
    if (!grayMat || grayMat.channels !== 1) {
      throw new Error('Color conversion test failed');
    }
    
    console.log('[start-prod] ✓ Basic Mat operations successful');
    console.log(`[start-prod] ✓ OpenCV version: ${getOpenCvVersionString(cv)}`);
    console.log('[start-prod] ✓ opencv4nodejs verification completed successfully');
    
    return true;
    
  } catch (error) {
    console.error('[start-prod] ✗ opencv4nodejs verification failed:');
    console.error(`[start-prod] Error: ${error.message}`);
    console.error('[start-prod]');
    
    // Provide detailed diagnostics
    console.error('[start-prod] Diagnostic Information:');
    console.error(`[start-prod] - Node.js version: ${process.version}`);
    console.error(`[start-prod] - Architecture: ${process.arch}`);
    console.error(`[start-prod] - Platform: ${process.platform}`);
    console.error('[start-prod]');
    
    // Check environment variables
    const envVars = ['OPENCV4NODEJS_DISABLE_AUTOBUILD', 'OPENCV_LIB_DIR', 'OPENCV_INCLUDE_DIR'];
    console.error('[start-prod] Environment Variables:');
    envVars.forEach(envVar => {
      const value = process.env[envVar];
      console.error(`[start-prod] - ${envVar}: ${value || 'Not set'}`);
    });
    console.error('[start-prod]');
    
    console.error('[start-prod] This indicates that opencv4nodejs was not properly built during container creation.');
    console.error('[start-prod] To resolve this issue:');
    console.error('[start-prod] 1. Rebuild the container completely: docker compose build --no-cache bytebot-agent');
    console.error('[start-prod] 2. Check Docker build logs for opencv4nodejs compilation errors');
    console.error('[start-prod] 3. Verify system OpenCV packages are properly installed');
    console.error('[start-prod] 4. Ensure native module compilation completed successfully');
    console.error('[start-prod]');
    console.error('[start-prod] Build command that should have been executed:');
    console.error('[start-prod] npm rebuild opencv4nodejs --build-from-source');
    
    // Attempt a one-time runtime rebuild of opencv4nodejs if bindings are missing
    try {
      const { execSync } = require('child_process');
      console.error('[start-prod] Attempting one-time runtime rebuild of opencv4nodejs...');

      // Determine where opencv4nodejs is installed (module base dir)
      const candidateDirs = [
        path.resolve(__dirname, '..', '..', 'bytebot-cv'),
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, '..', '..')
      ];
      let moduleBaseDir = null;
      for (const base of candidateDirs) {
        const modPath = path.join(base, 'node_modules', 'opencv4nodejs');
        if (fs.existsSync(modPath)) {
          moduleBaseDir = base;
          console.error(`[start-prod] Using module base dir for rebuild: ${moduleBaseDir}`);
          break;
        }
      }
      // Fallback to /app if not found
      if (!moduleBaseDir) {
        moduleBaseDir = '/app';
        console.error('[start-prod] Falling back to /app for rebuild');
      }

      const sentinelPath = path.join(moduleBaseDir, '.bytebot-opencv-rebuild-attempted');
      if (fs.existsSync(sentinelPath)) {
        console.error(`[start-prod] Runtime rebuild previously attempted (sentinel: ${sentinelPath}). Skipping to avoid restart loop.`);
        throw new Error('opencv4nodejs rebuild already attempted and failed');
      }

      // Detect multi-arch lib dir
      let multiarch = 'x86_64-linux-gnu';
      try {
        multiarch = execSync('dpkg-architecture -qDEB_HOST_MULTIARCH').toString().trim() || multiarch;
      } catch {}
      const env = {
        ...process.env,
        OPENCV4NODEJS_DISABLE_AUTOBUILD: '0',
        OPENCV4NODEJS_SKIP_TRACKING: '1',
        OPENCV_LIB_DIR: `/usr/lib/${multiarch}`,
        OPENCV_INCLUDE_DIR: '/usr/include/opencv4',
        OPENCV_BIN_DIR: '/usr/bin',
        PKG_CONFIG_PATH: `/usr/lib/${multiarch}/pkgconfig:/usr/lib/pkgconfig`,
      };
      console.error(`[start-prod] Rebuild env: OPENCV_LIB_DIR=${env.OPENCV_LIB_DIR}, PKG_CONFIG_PATH=${env.PKG_CONFIG_PATH}`);

      fs.writeFileSync(sentinelPath, new Date().toISOString(), 'utf8');

      const moduleRoot = path.join(moduleBaseDir, 'node_modules', 'opencv4nodejs');
      const buildDir = path.join(moduleRoot, 'build');
      if (fs.existsSync(buildDir)) {
        try {
          fs.rmSync(buildDir, { recursive: true, force: true });
          console.error(`[start-prod] Removed stale build directory: ${buildDir}`);
        } catch (rmErr) {
          console.error('[start-prod] Failed to clear previous build artifacts:', (rmErr && rmErr.message) || String(rmErr));
        }
      }

      const patchScripts = [
        {
          label: 'patch-opencv-binding',
          command: `node ${path.resolve(__dirname, '..', '..', 'bytebot-cv', 'scripts', 'patch-opencv-binding.js')}`,
        },
        {
          label: 'strip-opencv-tracking',
          command: `node ${path.resolve(__dirname, '..', '..', 'bytebot-cv', 'scripts', 'strip-opencv-tracking.js')} ${moduleBaseDir}`,
        },
      ];

      patchScripts.forEach(({ label, command }) => {
        try {
          console.error(`[start-prod] Running ${label} before rebuild...`);
          execSync(command, {
            cwd: moduleBaseDir,
            env,
            stdio: 'inherit',
          });
        } catch (patchErr) {
          console.error(`[start-prod] ${label} failed:`, (patchErr && patchErr.message) || String(patchErr));
        }
      });

      const installScript = path.join(moduleBaseDir, 'node_modules', 'opencv4nodejs', 'install', 'install.js');
      const rebuildCommand = fs.existsSync(installScript)
        ? `${process.execPath} ${installScript}`
        : 'npm rebuild opencv4nodejs --build-from-source';
      console.error(`[start-prod] Executing rebuild command: ${rebuildCommand}`);

      execSync(rebuildCommand, {
        cwd: moduleRoot,
        env,
        stdio: 'inherit',
      });

     const bindingCandidate = path.join(moduleBaseDir, 'node_modules', 'opencv4nodejs', 'build', 'Release', 'opencv4nodejs.node');
     if (fs.existsSync(bindingCandidate)) {
        console.error(`[start-prod] ✓ Native binding rebuilt at ${bindingCandidate}`);

        try {
          const rootModulePath = path.resolve(moduleBaseDir, '..', '..', 'node_modules', 'opencv4nodejs');
          const rootParent = path.dirname(rootModulePath);
          if (!fs.existsSync(rootParent)) {
            fs.mkdirSync(rootParent, { recursive: true });
          }
          try {
            fs.rmSync(rootModulePath, { recursive: true, force: true });
          } catch {}
          fs.symlinkSync(path.join(moduleBaseDir, 'node_modules', 'opencv4nodejs'), rootModulePath, 'dir');
          console.error(`[start-prod] ✓ Linked root opencv4nodejs module to ${rootModulePath}`);
        } catch (linkErr) {
          console.error('[start-prod] ⚠ Failed to link root opencv4nodejs module:', (linkErr && linkErr.message) || String(linkErr));
        }
      } else {
        console.error(`[start-prod] ⚠ Rebuild completed but binding missing at ${bindingCandidate}`);
      }

      try {
        console.error('[start-prod] Running post-rebuild capability check...');
        execSync(`node ${path.resolve(__dirname, '..', '..', 'bytebot-cv', 'scripts', 'verify-opencv-capabilities.js')}`, {
          cwd: moduleRoot,
          env,
          stdio: 'inherit',
        });
      } catch (verifyErr) {
        console.error('[start-prod] Capability verification reported issues:', (verifyErr && verifyErr.message) || String(verifyErr));
      }

      const verificationMarker = path.join(moduleBaseDir, '.bytebot-opencv-rebuild-success');
      fs.writeFileSync(verificationMarker, new Date().toISOString(), 'utf8');
      fs.rmSync(sentinelPath, { force: true });

      const cvRetry = loadOpenCvWithFallback();
      if (cvRetry && typeof cvRetry.Mat === 'function') {
        console.log('[start-prod] ✓ opencv4nodejs loaded successfully after runtime rebuild');
      } else {
        throw new Error('opencv4nodejs still unavailable after runtime rebuild');
      }
    } catch (rebuildErr) {
      console.error('[start-prod] Runtime rebuild failed:', (rebuildErr && rebuildErr.message) || String(rebuildErr));
      console.error('[start-prod] Proceeding with fallback CV implementation (no native bindings)');
      return false;
    }
  }
}

// Verify opencv4nodejs is working before starting the application
verifyOpenCvBindings();

const baseDist = path.resolve(__dirname, '..', 'dist');
const candidates = [
  'src/main.js',
  'bytebot-agent/src/main.js',
  'main.js',
];

for (const rel of candidates) {
  const candidatePath = path.join(baseDist, rel);
  if (existsSync(candidatePath)) {
    require(candidatePath);
    return;
  }
}

console.error('Unable to locate a compiled Nest entrypoint under dist/. Searched:', candidates);
process.exit(1);
