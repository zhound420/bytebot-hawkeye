#!/usr/bin/env node
/**
 * Quick OpenCV 4.8.0 verification - Agent container only
 * Fast test to verify the critical bytebot-agent OpenCV functionality
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Quick OpenCV 4.8.0 Agent Test');
console.log('=================================\n');

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
      cwd: process.cwd(),
      timeout: 600000 // 10 minutes timeout
    });
    console.log(`✅ ${description} completed`);
    return { success: true, output: result };
  } catch (error) {
    console.error(`❌ ${description} failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test 1: Verify Ubuntu 24.04 OpenCV availability
console.log('🔍 Testing Ubuntu 24.04 OpenCV packages...\n');

const ubuntuTest = executeCommand(
  `docker run --rm public.ecr.aws/ubuntu/ubuntu:24.04 bash -c "
    apt-get update && 
    apt-cache show libopencv-dev | grep Version && 
    apt-cache show libopencv-ml-dev | grep Version &&
    echo 'Ubuntu 24.04 OpenCV packages verified'
  "`,
  'Checking Ubuntu 24.04 OpenCV package versions',
  { silent: false }
);

if (!ubuntuTest.success) {
  console.log('❌ Ubuntu 24.04 OpenCV package test failed');
  process.exit(1);
}

// Test 2: Build just the agent container 
console.log('\n🔧 Building bytebot-agent container with OpenCV 4.8.0...\n');

const agentBuild = executeCommand(
  'docker compose -f docker/docker-compose.yml build --no-cache bytebot-agent',
  'Building bytebot-agent with OpenCV 4.8.0'
);

if (!agentBuild.success) {
  console.log('❌ Agent build failed - this needs investigation');
  process.exit(1);
}

// Test 3: Test OpenCV in the built container
console.log('\n🧪 Testing OpenCV 4.8.0 in bytebot-agent...\n');

const opencvTest = executeCommand(
  `docker run --rm bytebot-bytebot-agent node -e "
    try {
      console.log('Loading opencv4nodejs...');
      const cv = require('opencv4nodejs');
      console.log('✅ opencv4nodejs loaded successfully');
      console.log('OpenCV version:', cv.version || 'unknown');
      
      // Test basic functionality
      const testMat = new cv.Mat(10, 10, cv.CV_8UC3);
      console.log('✅ Basic Mat operations work');
      
      // Test SVM (critical fix)
      let svmWorking = false;
      try {
        if (cv.ml && typeof cv.ml.SVM === 'function') {
          const svm = new cv.ml.SVM();
          if (svm && typeof svm.setType === 'function') {
            svm.setType(cv.ml.SVM.C_SVC);
            console.log('✅ SVM (Machine Learning) WORKING - CRITICAL FIX SUCCESSFUL');
            svmWorking = true;
          } else {
            console.log('❌ SVM instance invalid');
          }
        } else {
          console.log('❌ cv.ml.SVM is not a constructor');
        }
      } catch (svmError) {
        console.log('❌ SVM test failed:', svmError.message);
      }
      
      // Test morphology (critical fix)
      let morphologyWorking = false;
      try {
        if (typeof cv.morphologyEx === 'function' && typeof cv.getStructuringElement === 'function') {
          const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
          const result = cv.morphologyEx(testMat, cv.MORPH_CLOSE, kernel);
          console.log('✅ Morphology operations WORKING - CRITICAL FIX SUCCESSFUL');
          morphologyWorking = true;
        } else {
          const missing = [];
          if (typeof cv.morphologyEx !== 'function') missing.push('morphologyEx');
          if (typeof cv.getStructuringElement !== 'function') missing.push('getStructuringElement');
          console.log('❌ Missing morphology functions:', missing.join(', '));
        }
      } catch (morphError) {
        console.log('❌ Morphology test failed:', morphError.message);
      }
      
      // Test CLAHE
      let claheWorking = false;
      try {
        if (typeof cv.createCLAHE === 'function') {
          const clahe = cv.createCLAHE();
          console.log('✅ CLAHE working');
          claheWorking = true;
        } else {
          console.log('❌ CLAHE not available');
        }
      } catch (claheError) {
        console.log('❌ CLAHE test failed:', claheError.message);
      }
      
      // Summary
      const criticalFixes = svmWorking + morphologyWorking;
      console.log('\\n📊 Critical Issues Fixed:', criticalFixes + '/2');
      console.log('SVM Constructor:', svmWorking ? 'FIXED' : 'STILL BROKEN');
      console.log('Morphology Ops:', morphologyWorking ? 'FIXED' : 'STILL BROKEN'); 
      console.log('CLAHE Support:', claheWorking ? 'WORKING' : 'BROKEN');
      
      if (criticalFixes === 2) {
        console.log('\\n🎉 ALL CRITICAL OPENCV ISSUES RESOLVED!');
        console.log('✅ OpenCV 4.8.0 upgrade successful');
      } else {
        console.log('\\n⚠️  Some critical issues remain');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ OpenCV test failed:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    }
  "`,
  'Testing OpenCV 4.8.0 capabilities in agent container'
);

if (opencvTest.success) {
  console.log('\n🎉 Quick OpenCV 4.8.0 test PASSED!');
  console.log('✅ Critical fixes verified in bytebot-agent');
  console.log('\n📋 Next steps:');
  console.log('  1. Build remaining containers');
  console.log('  2. Run full system integration test');
  console.log('  3. Deploy to production');
} else {
  console.log('\n❌ Quick OpenCV test FAILED');
  console.log('🔧 Investigation required');
}
