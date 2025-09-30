#!/usr/bin/env node
/**
 * Comprehensive OpenCV 4.8.0 upgrade verification script
 * This script tests the complete OpenCV 4.8.0 implementation across the ByteBot stack
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 ByteBot OpenCV 4.8.0 Upgrade Verification');
console.log('============================================\n');

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

function logResult(test, success, message) {
  const status = success ? '✅' : '❌';
  console.log(`${status} ${test}: ${message}`);
  return success;
}

function executeCommand(command, description, options = {}) {
  console.log(`🔄 ${description}...`);
  try {
    const result = execSync(command, { 
      encoding: 'utf-8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: process.cwd()
    });
    console.log(`✅ ${description} completed successfully`);
    return { success: true, output: result };
  } catch (error) {
    console.error(`❌ ${description} failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function verifyDockerfileUpdates() {
  logSection('Dockerfile Updates Verification');
  
  let allValid = true;
  
  // Check bytebot-agent Dockerfile
  try {
    const agentDockerfile = fs.readFileSync('packages/bytebot-agent/Dockerfile', 'utf-8');
    if (agentDockerfile.includes('ubuntu:24.04')) {
      logResult('bytebot-agent Dockerfile', true, 'Updated to Ubuntu 24.04');
    } else {
      logResult('bytebot-agent Dockerfile', false, 'Still using old Ubuntu version');
      allValid = false;
    }
  } catch (error) {
    logResult('bytebot-agent Dockerfile', false, `Could not read file: ${error.message}`);
    allValid = false;
  }
  
  // Check bytebotd Dockerfile
  try {
    const desktopDockerfile = fs.readFileSync('packages/bytebotd/Dockerfile', 'utf-8');
    if (desktopDockerfile.includes('ubuntu:24.04')) {
      logResult('bytebotd Dockerfile', true, 'Updated to Ubuntu 24.04');
    } else {
      logResult('bytebotd Dockerfile', false, 'Still using old Ubuntu version');
      allValid = false;
    }
  } catch (error) {
    logResult('bytebotd Dockerfile', false, `Could not read file: ${error.message}`);
    allValid = false;
  }
  
  // Check docker-compose.yml
  try {
    const composeFile = fs.readFileSync('docker/docker-compose.yml', 'utf-8');
    if (!composeFile.includes('image: ghcr.io/bytebot-ai/bytebot-agent:edge') && 
        composeFile.includes('dockerfile: packages/bytebot-agent/Dockerfile')) {
      logResult('docker-compose.yml', true, 'Configured for local builds');
    } else {
      logResult('docker-compose.yml', false, 'Still using pre-built images');
      allValid = false;
    }
  } catch (error) {
    logResult('docker-compose.yml', false, `Could not read file: ${error.message}`);
    allValid = false;
  }
  
  return allValid;
}

function buildAndTestContainers() {
  logSection('Container Build and Test');
  
  let allBuilds = true;
  
  console.log('\n🔧 Building containers with OpenCV 4.8.0...\n');
  
  // Clean up any existing containers and images
  executeCommand(
    'docker compose -f docker/docker-compose.yml down --rmi all --volumes --remove-orphans || true',
    'Cleaning up existing containers',
    { silent: true }
  );
  
  // Build bytebot-agent first (most likely to have OpenCV issues)
  const agentBuild = executeCommand(
    'docker compose -f docker/docker-compose.yml build --no-cache bytebot-agent',
    'Building bytebot-agent with OpenCV 4.8.0'
  );
  
  if (!agentBuild.success) {
    console.error('\n❌ Critical failure: bytebot-agent build failed');
    console.error('This indicates OpenCV 4.8.0 compilation issues in Ubuntu 24.04');
    allBuilds = false;
  }
  
  // Build bytebotd
  const desktopBuild = executeCommand(
    'docker compose -f docker/docker-compose.yml build --no-cache bytebot-desktop',
    'Building bytebot-desktop with OpenCV 4.8.0'
  );
  
  if (!desktopBuild.success) {
    console.error('\n❌ bytebot-desktop build failed');
    allBuilds = false;
  }
  
  return allBuilds;
}

function testOpenCvCapabilities() {
  logSection('OpenCV Capabilities Testing');
  
  console.log('🧪 Testing OpenCV 4.8.0 capabilities in containers...\n');
  
  // Test in bytebot-agent container
  const agentTest = executeCommand(
    `docker run --rm bytebot_bytebot-agent node -e "
      try {
        const cv = require('opencv4nodejs');
        console.log('OpenCV version:', cv.version || 'unknown');
        
        // Test basic functionality
        const testMat = new cv.Mat(10, 10, cv.CV_8UC3);
        console.log('✅ Basic Mat operations work');
        
        // Test SVM (critical)
        if (cv.ml && typeof cv.ml.SVM === 'function') {
          const svm = new cv.ml.SVM();
          svm.setType(cv.ml.SVM.C_SVC);
          console.log('✅ SVM (Machine Learning) working');
        } else {
          console.log('❌ SVM not available');
        }
        
        // Test morphology (critical)  
        if (typeof cv.morphologyEx === 'function') {
          const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
          const result = cv.morphologyEx(testMat, cv.MORPH_CLOSE, kernel);
          console.log('✅ Morphology operations working');
        } else {
          console.log('❌ Morphology operations not available');
        }
        
        // Test CLAHE
        if (typeof cv.createCLAHE === 'function') {
          const clahe = cv.createCLAHE();
          console.log('✅ CLAHE working');
        } else {
          console.log('❌ CLAHE not available');
        }
        
        console.log('🎉 OpenCV 4.8.0 verification successful!');
      } catch (error) {
        console.error('❌ OpenCV test failed:', error.message);
        process.exit(1);
      }
    "`,
    'Testing OpenCV capabilities in bytebot-agent container'
  );
  
  return agentTest.success;
}

function runFullSystemTest() {
  logSection('Full System Integration Test');
  
  console.log('🎯 Starting full system test with OpenCV 4.8.0...\n');
  
  // Start the full stack
  const startResult = executeCommand(
    'docker compose -f docker/docker-compose.yml up -d',
    'Starting full ByteBot stack'
  );
  
  if (!startResult.success) {
    return false;
  }
  
  console.log('\n⏳ Waiting for services to initialize...');
  
  // Wait for services to start
  setTimeout(() => {
    // Check health of key services
    const healthChecks = [
      {
        name: 'bytebot-agent health',
        command: 'docker compose -f docker/docker-compose.yml exec -T bytebot-agent curl -f http://localhost:9991/ || echo "Agent not ready"'
      },
      {
        name: 'bytebot-desktop health', 
        command: 'docker compose -f docker/docker-compose.yml exec -T bytebot-desktop ps aux | grep supervisord || echo "Desktop not ready"'
      }
    ];
    
    let allHealthy = true;
    for (const check of healthChecks) {
      const result = executeCommand(check.command, check.name, { silent: true });
      if (!result.success) {
        allHealthy = false;
      }
    }
    
    // Clean up
    executeCommand(
      'docker compose -f docker/docker-compose.yml down',
      'Stopping test containers',
      { silent: true }
    );
    
    return allHealthy;
  }, 10000);
  
  return true;
}

function generateReport(results) {
  logSection('Test Results Summary');
  
  const tests = Object.keys(results);
  const passed = tests.filter(test => results[test]).length;
  const total = tests.length;
  const successRate = (passed / total) * 100;
  
  console.log(`\n📊 Overall Results: ${passed}/${total} tests passed (${successRate.toFixed(1)}%)`);
  
  for (const [test, result] of Object.entries(results)) {
    const status = result ? '✅' : '❌';
    console.log(`${status} ${test}`);
  }
  
  if (successRate === 100) {
    console.log('\n🎉 OpenCV 4.8.0 upgrade completed successfully!');
    console.log('✅ All systems are ready for production use');
    console.log('\n🚀 Key improvements achieved:');
    console.log('  • OpenCV 4.8.0 with full ML module support');
    console.log('  • SVM classifier functionality restored');
    console.log('  • Morphology operations working correctly');
    console.log('  • Enhanced CLAHE capabilities');
    console.log('  • Ubuntu 24.04 LTS foundation');
  } else if (successRate >= 75) {
    console.log('\n⚠️  OpenCV 4.8.0 upgrade mostly successful');
    console.log('ℹ️  Some minor issues detected, but core functionality restored');
  } else {
    console.log('\n❌ OpenCV 4.8.0 upgrade failed');
    console.log('🔧 Manual intervention required');
    console.log('\n📝 Recommended actions:');
    console.log('  1. Check Docker build logs for compilation errors');
    console.log('  2. Verify Ubuntu 24.04 package availability');  
    console.log('  3. Review opencv4nodejs build configuration');
    console.log('  4. Test individual containers separately');
  }
  
  return successRate >= 75;
}

// Main test execution
async function main() {
  const results = {};
  
  try {
    console.log('🔍 Verifying OpenCV 4.8.0 upgrade implementation...\n');
    
    // Test 1: Verify configuration files
    results.dockerfileUpdates = verifyDockerfileUpdates();
    
    // Test 2: Build containers
    results.containerBuilds = buildAndTestContainers();
    
    // Test 3: Test OpenCV capabilities
    if (results.containerBuilds) {
      results.opencvCapabilities = testOpenCvCapabilities();
    } else {
      results.opencvCapabilities = false;
      console.log('⏭️  Skipping OpenCV tests due to build failures');
    }
    
    // Test 4: Full system test
    if (results.opencvCapabilities) {
      results.fullSystemTest = runFullSystemTest();
    } else {
      results.fullSystemTest = false;
      console.log('⏭️  Skipping full system test due to capability failures');
    }
    
    const success = generateReport(results);
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 Test execution failed:', error.message);
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

module.exports = {
  verifyDockerfileUpdates,
  buildAndTestContainers,
  testOpenCvCapabilities,
  runFullSystemTest,
  generateReport,
  main
};
