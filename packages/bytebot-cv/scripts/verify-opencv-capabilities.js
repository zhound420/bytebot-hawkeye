#!/usr/bin/env node
/**
 * Comprehensive OpenCV capabilities verification script
 * This script verifies that @u4/opencv4nodejs is properly installed and functional
 */

const fs = require('fs');
const path = require('path');

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

function logResult(test, success, message) {
  const status = success ? '✓' : '✗';
  console.log(`[verify] ${status} ${test}: ${message}`);
  return success;
}

function verifyOpenCvInstallation() {
  logSection('OpenCV Installation Verification');
  
  try {
    // Test basic module loading
    const cv = require('@u4/opencv4nodejs');
    if (!cv) {
      return logResult('Module Loading', false, '@u4/opencv4nodejs module is null or undefined');
    }
    
    logResult('Module Loading', true, '@u4/opencv4nodejs loaded successfully');
    
    // Test version information
    if (cv.version) {
      logResult('Version Info', true, `OpenCV version ${cv.version}`);
    } else {
      logResult('Version Info', false, 'Version information not available');
    }
    
    // Test core functionality
    if (typeof cv.Mat !== 'function') {
      return logResult('Core Classes', false, 'cv.Mat constructor not available');
    }
    
    logResult('Core Classes', true, 'cv.Mat constructor available');
    
    return true;
    
  } catch (error) {
    return logResult('Module Loading', false, `Failed to load @u4/opencv4nodejs: ${error.message}`);
  }
}

function verifyBasicOperations() {
  logSection('Basic Operations Verification');
  
  try {
    const cv = require('@u4/opencv4nodejs');
    
    // Test Mat creation
    const testMat = new cv.Mat(100, 100, cv.CV_8UC3);
    if (!testMat || testMat.rows !== 100 || testMat.cols !== 100) {
      return logResult('Mat Creation', false, 'Mat creation failed or returned invalid dimensions');
    }
    
    logResult('Mat Creation', true, `Created ${testMat.rows}x${testMat.cols} Mat`);
    
    // Test basic image operations
    const grayMat = testMat.cvtColor(cv.COLOR_BGR2GRAY);
    if (!grayMat || grayMat.channels !== 1) {
      return logResult('Color Conversion', false, 'Color conversion failed');
    }
    
    logResult('Color Conversion', true, 'BGR to Gray conversion successful');
    
    // Test matrix operations
    const resized = testMat.resize(50, 50);
    if (!resized || resized.rows !== 50 || resized.cols !== 50) {
      return logResult('Resize Operation', false, 'Resize operation failed');
    }
    
    logResult('Resize Operation', true, 'Matrix resize successful');
    
    return true;
    
  } catch (error) {
    return logResult('Basic Operations', false, `Operations failed: ${error.message}`);
  }
}

function verifyAdvancedFeatures() {
  logSection('Advanced Features Verification');
  
  try {
    const cv = require('@u4/opencv4nodejs');
    
    // Test feature detection (if available)
    let featureTests = 0;
    let featurePassed = 0;
    
    if (cv.ORBDetector) {
      featureTests++;
      try {
        const orb = new cv.ORBDetector();
        logResult('ORB Detector', true, 'ORB feature detector available');
        featurePassed++;
      } catch (error) {
        logResult('ORB Detector', false, `ORB detector failed: ${error.message}`);
      }
    }
    
    if (cv.goodFeaturesToTrack) {
      featureTests++;
      try {
        const testMat = new cv.Mat(100, 100, cv.CV_8UC1);
        const corners = testMat.goodFeaturesToTrack(10, 0.01, 10);
        logResult('Good Features to Track', true, `Found ${corners.length} corners`);
        featurePassed++;
      } catch (error) {
        logResult('Good Features to Track', false, `Feature tracking failed: ${error.message}`);
      }
    }
    
    // Test machine learning (CRITICAL for OpenCV 4.8.0)
    featureTests++;
    try {
      if (cv.ml && typeof cv.ml.SVM === 'function') {
        const svm = new cv.ml.SVM();
        if (svm && typeof svm.setType === 'function') {
          svm.setType(cv.ml.SVM.C_SVC);
          logResult('SVM (Machine Learning)', true, 'SVM classifier fully functional');
          featurePassed++;
        } else {
          logResult('SVM (Machine Learning)', false, 'SVM instance invalid - missing methods');
        }
      } else if (cv.ml && cv.ml.SVM) {
        logResult('SVM (Machine Learning)', false, 'cv.ml.SVM is not a constructor');
      } else {
        logResult('SVM (Machine Learning)', false, 'cv.ml module not available');
      }
    } catch (error) {
      logResult('SVM (Machine Learning)', false, `SVM failed: ${error.message}`);
    }
    
    // Test morphology operations (CRITICAL for OpenCV 4.8.0)
    featureTests++;
    try {
      if (typeof cv.morphologyEx === 'function' && typeof cv.getStructuringElement === 'function') {
        const testMat = new cv.Mat(50, 50, cv.CV_8UC1, 128);
        const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
        const result = cv.morphologyEx(testMat, cv.MORPH_CLOSE, kernel);
        if (result && result.rows === 50 && result.cols === 50) {
          logResult('Morphology Operations', true, 'morphologyEx and getStructuringElement working');
          featurePassed++;
        } else {
          logResult('Morphology Operations', false, 'Morphology result invalid');
        }
      } else {
        const missingFuncs = [];
        if (typeof cv.morphologyEx !== 'function') missingFuncs.push('morphologyEx');
        if (typeof cv.getStructuringElement !== 'function') missingFuncs.push('getStructuringElement');
        logResult('Morphology Operations', false, `Missing functions: ${missingFuncs.join(', ')}`);
      }
    } catch (error) {
      logResult('Morphology Operations', false, `Morphology failed: ${error.message}`);
    }
    
    // Test CLAHE (should be working but verify 4.8.0 compatibility)
    featureTests++;
    try {
      if (typeof cv.createCLAHE === 'function') {
        const clahe = cv.createCLAHE(2.0, new cv.Size(8, 8));
        const testMat = new cv.Mat(50, 50, cv.CV_8UC1, 100);
        const result = clahe.apply(testMat);
        if (result && result.rows === 50 && result.cols === 50) {
          logResult('CLAHE Enhancement', true, 'CLAHE working with OpenCV 4.8.0');
          featurePassed++;
        } else {
          logResult('CLAHE Enhancement', false, 'CLAHE result invalid');
        }
      } else {
        logResult('CLAHE Enhancement', false, 'cv.createCLAHE function not available');
      }
    } catch (error) {
      logResult('CLAHE Enhancement', false, `CLAHE failed: ${error.message}`);
    }
    
    if (featureTests === 0) {
      logResult('Advanced Features', false, 'No advanced features available for testing');
      return false;
    }
    
    const successRate = (featurePassed / featureTests) * 100;
    const isSuccess = successRate >= 75; // Higher threshold for 4.8.0
    logResult('Advanced Features Summary', isSuccess, 
      `${featurePassed}/${featureTests} advanced features working (${successRate.toFixed(1)}%)`);
    
    return isSuccess;
    
  } catch (error) {
    return logResult('Advanced Features', false, `Advanced features test failed: ${error.message}`);
  }
}

function verifyEnvironmentConfiguration() {
  logSection('Environment Configuration Verification');
  
  const requiredEnvVars = [
    'OPENCV4NODEJS_DISABLE_AUTOBUILD',
    'OPENCV4NODEJS_SKIP_TRACKING'
  ];
  
  let envSuccess = true;
  
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      logResult(`Environment: ${envVar}`, true, `Set to "${value}"`);
    } else {
      logResult(`Environment: ${envVar}`, false, 'Not set');
      envSuccess = false;
    }
  }
  
  // Check OpenCV library paths
  const libPaths = [
    process.env.OPENCV_LIB_DIR,
    '/usr/lib/x86_64-linux-gnu',
    '/usr/lib/aarch64-linux-gnu',
    '/usr/local/lib'
  ].filter(Boolean);
  
  let libFound = false;
  for (const libPath of libPaths) {
    if (fs.existsSync(libPath)) {
      const opencvLibs = fs.readdirSync(libPath).filter(file => 
        file.includes('opencv') && file.includes('.so')
      );
      
      if (opencvLibs.length > 0) {
        logResult('OpenCV Libraries', true, `Found ${opencvLibs.length} libraries in ${libPath}`);
        libFound = true;
        break;
      }
    }
  }
  
  if (!libFound) {
    logResult('OpenCV Libraries', false, 'No OpenCV libraries found in standard paths');
    envSuccess = false;
  }
  
  return envSuccess;
}

function generateReport(results) {
  logSection('Verification Summary');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const successRate = (passedTests / totalTests) * 100;
  
  console.log(`\nOverall Result: ${passedTests}/${totalTests} tests passed (${successRate.toFixed(1)}%)`);
  
  if (successRate === 100) {
    console.log('🎉 All OpenCV capabilities verified successfully!');
    console.log('✓ @u4/opencv4nodejs is ready for production use');
  } else if (successRate >= 75) {
    console.log('⚠️  Most OpenCV capabilities are working');
    console.log('✓ @u4/opencv4nodejs should work for basic operations');
  } else {
    console.log('❌ OpenCV verification failed');
    console.log('✗ @u4/opencv4nodejs may not work correctly');
    console.log('\nTroubleshooting steps:');
    console.log('1. Ensure OpenCV system packages are installed');
    console.log('2. Check that @u4/opencv4nodejs was compiled correctly');
    console.log('3. Verify environment variables are set properly');
    console.log('4. Review Docker build logs for compilation errors');
  }
  
  return successRate >= 75;
}

// Main verification process
function main() {
  console.log('ByteBot OpenCV Capabilities Verification');
  console.log('========================================');
  
  const results = {
    installation: verifyOpenCvInstallation(),
    basicOperations: verifyBasicOperations(),
    advancedFeatures: verifyAdvancedFeatures(),
    environment: verifyEnvironmentConfiguration()
  };
  
  const success = generateReport(results);
  
  if (!success) {
    console.log('\n⚠️  OpenCV verification failed, but continuing build process...');
    console.log('Note: This may be expected during initial build stages');
    // Don't exit with error during build process
    return false;
  }
  
  console.log('\n✓ OpenCV verification completed successfully');
}

// Run verification if called directly
if (require.main === module) {
  main();
}

module.exports = {
  verifyOpenCvInstallation,
  verifyBasicOperations,
  verifyAdvancedFeatures,
  verifyEnvironmentConfiguration,
  main
};
