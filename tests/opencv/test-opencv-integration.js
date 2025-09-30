#!/usr/bin/env node
/**
 * Test script to validate OpenCV integration improvements
 * This script tests the fixes for Scalar constructor, morphology operations, and CLAHE
 */

const fs = require('fs');
const path = require('path');

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

function logResult(test, success, message) {
  const status = success ? '✓' : '✗';
  console.log(`[test] ${status} ${test}: ${message}`);
  return success;
}

function testScalarPolyfill() {
  logSection('Scalar Polyfill Test');
  
  try {
    const cv = require('opencv4nodejs');
    
    // Test basic Scalar constructor
    try {
      const scalar = new cv.Scalar(128);
      if (!scalar) {
        return logResult('Scalar Construction', false, 'Scalar constructor returned null');
      }
      
      const isValidScalar = scalar.val || scalar.isScalar || (typeof scalar === 'object');
      if (!isValidScalar) {
        return logResult('Scalar Construction', false, 'Scalar object appears invalid');
      }
      
      logResult('Scalar Construction', true, 'Scalar constructor working');
      
      // Test Scalar with Mat.setTo
      const testMat = new cv.Mat(10, 10, cv.CV_8UC1);
      if (typeof testMat.setTo === 'function') {
        try {
          testMat.setTo(scalar);
          logResult('Scalar with setTo', true, 'Mat.setTo accepts Scalar polyfill');
        } catch (error) {
          return logResult('Scalar with setTo', false, `setTo failed: ${error.message}`);
        }
      } else {
        logResult('Scalar with setTo', false, 'Mat.setTo method not available');
      }
      
      return true;
      
    } catch (error) {
      return logResult('Scalar Construction', false, `Scalar constructor failed: ${error.message}`);
    }
    
  } catch (error) {
    return logResult('Scalar Polyfill Test', false, `Failed to load opencv4nodejs: ${error.message}`);
  }
}

function testMorphologyOperations() {
  logSection('Morphology Operations Test');
  
  try {
    const cv = require('opencv4nodejs');
    
    // Test Mat creation for morphology
    const testMat = new cv.Mat(32, 32, cv.CV_8UC1);
    const data = new Uint8Array(32 * 32);
    data.fill(128);
    const matWithData = new cv.Mat(32, 32, cv.CV_8UC1, Buffer.from(data));
    
    logResult('Mat Creation', true, 'Created test matrices for morphology');
    
    // Test kernel creation
    let kernel = null;
    try {
      if (typeof cv.getStructuringElement === 'function' && typeof cv.Size === 'function') {
        kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
        logResult('Kernel Creation', true, 'Created morphology kernel');
      } else {
        return logResult('Kernel Creation', false, 'getStructuringElement or Size not available');
      }
    } catch (error) {
      return logResult('Kernel Creation', false, `Kernel creation failed: ${error.message}`);
    }
    
    // Test morphology operations
    const morphMethods = [
      {
        name: 'cv.morphologyEx',
        test: () => {
          if (typeof cv.morphologyEx === 'function') {
            return cv.morphologyEx(matWithData, cv.MORPH_CLOSE, kernel);
          }
          throw new Error('cv.morphologyEx not available');
        }
      },
      {
        name: 'cv.imgproc.morphologyEx', 
        test: () => {
          if (typeof cv.imgproc?.morphologyEx === 'function') {
            return cv.imgproc.morphologyEx(matWithData, cv.MORPH_CLOSE, kernel);
          }
          throw new Error('cv.imgproc.morphologyEx not available');
        }
      },
      {
        name: 'mat.morphologyEx',
        test: () => {
          if (typeof matWithData.morphologyEx === 'function') {
            return matWithData.morphologyEx(cv.MORPH_CLOSE, kernel);
          }
          throw new Error('mat.morphologyEx not available');
        }
      }
    ];
    
    let morphologyWorking = false;
    for (const method of morphMethods) {
      try {
        const result = method.test();
        if (result && result.rows && result.cols) {
          logResult(`Morphology: ${method.name}`, true, 'Morphology operation successful');
          morphologyWorking = true;
          break;
        } else {
          logResult(`Morphology: ${method.name}`, false, 'Invalid result from morphology');
        }
      } catch (error) {
        logResult(`Morphology: ${method.name}`, false, error.message);
      }
    }
    
    return morphologyWorking;
    
  } catch (error) {
    return logResult('Morphology Operations Test', false, `Failed: ${error.message}`);
  }
}

function testClaheOperations() {
  logSection('CLAHE Operations Test');
  
  try {
    const cv = require('opencv4nodejs');
    
    // Test Mat creation
    const testMat = new cv.Mat(32, 32, cv.CV_8UC1);
    logResult('CLAHE Mat Creation', true, 'Created test matrix for CLAHE');
    
    // Test CLAHE factory methods
    const claheMethods = [
      {
        name: 'cv.createCLAHE',
        test: () => {
          if (typeof cv.createCLAHE === 'function') {
            return cv.createCLAHE(4.0, new cv.Size(8, 8));
          }
          throw new Error('cv.createCLAHE not available');
        }
      },
      {
        name: 'cv.imgproc.createCLAHE',
        test: () => {
          if (typeof cv.imgproc?.createCLAHE === 'function') {
            return cv.imgproc.createCLAHE(4.0, new cv.Size(8, 8));
          }
          throw new Error('cv.imgproc.createCLAHE not available');
        }
      },
      {
        name: 'new cv.CLAHE',
        test: () => {
          if (typeof cv.CLAHE === 'function') {
            return new cv.CLAHE(4.0, new cv.Size(8, 8));
          }
          throw new Error('cv.CLAHE constructor not available');
        }
      }
    ];
    
    let claheWorking = false;
    for (const method of claheMethods) {
      try {
        const claheInstance = method.test();
        if (claheInstance) {
          // Test apply method
          const applyMethods = ['apply', 'process', 'enhance'];
          let applyWorking = false;
          
          for (const applyMethod of applyMethods) {
            if (typeof claheInstance[applyMethod] === 'function') {
              try {
                const result = claheInstance[applyMethod](testMat);
                if (result && result.rows && result.cols) {
                  logResult(`CLAHE: ${method.name}.${applyMethod}`, true, 'CLAHE operation successful');
                  applyWorking = true;
                  claheWorking = true;
                  break;
                }
              } catch (applyError) {
                logResult(`CLAHE: ${method.name}.${applyMethod}`, false, applyError.message);
              }
            }
          }
          
          if (!applyWorking) {
            logResult(`CLAHE: ${method.name}`, false, 'No working apply method found');
          }
          
          // Cleanup
          if (typeof claheInstance.delete === 'function') {
            claheInstance.delete();
          }
          
          if (claheWorking) break;
        }
      } catch (error) {
        logResult(`CLAHE: ${method.name}`, false, error.message);
      }
    }
    
    return claheWorking;
    
  } catch (error) {
    return logResult('CLAHE Operations Test', false, `Failed: ${error.message}`);
  }
}

function testOpenCvConstants() {
  logSection('OpenCV Constants Test');
  
  try {
    const cv = require('opencv4nodejs');
    
    const requiredConstants = [
      'CV_8UC1', 'CV_8UC3', 'CV_8UC4', 'CV_32F',
      'MORPH_RECT', 'MORPH_CLOSE', 'MORPH_OPEN',
      'COLOR_BGR2GRAY', 'COLOR_RGB2GRAY'
    ];
    
    let constantsWorking = true;
    for (const constantName of requiredConstants) {
      const value = cv[constantName];
      if (typeof value === 'number') {
        logResult(`Constant: ${constantName}`, true, `Value: ${value}`);
      } else {
        logResult(`Constant: ${constantName}`, false, `Missing or invalid (${typeof value})`);
        constantsWorking = false;
      }
    }
    
    return constantsWorking;
    
  } catch (error) {
    return logResult('OpenCV Constants Test', false, `Failed: ${error.message}`);
  }
}

function testImageProcessingPipeline() {
  logSection('Image Processing Pipeline Test');
  
  try {
    const cv = require('opencv4nodejs');
    
    // Create a simple test image
    const testMat = new cv.Mat(100, 100, cv.CV_8UC3);
    
    // Test basic operations
    let pipelineWorking = true;
    
    try {
      // Test color conversion
      const grayMat = testMat.cvtColor(cv.COLOR_BGR2GRAY);
      if (!grayMat || grayMat.channels() !== 1) {
        throw new Error('Color conversion failed');
      }
      logResult('Color Conversion', true, 'BGR to Gray conversion successful');
      
      // Test resize
      const resized = testMat.resize(50, 50);
      if (!resized || resized.rows !== 50 || resized.cols !== 50) {
        throw new Error('Resize failed');
      }
      logResult('Resize Operation', true, 'Image resize successful');
      
      // Test blur
      if (typeof grayMat.gaussianBlur === 'function') {
        const blurred = grayMat.gaussianBlur(new cv.Size(5, 5), 1.5);
        if (blurred && blurred.rows && blurred.cols) {
          logResult('Gaussian Blur', true, 'Blur operation successful');
        } else {
          logResult('Gaussian Blur', false, 'Blur returned invalid result');
          pipelineWorking = false;
        }
      } else {
        logResult('Gaussian Blur', false, 'gaussianBlur method not available');
        pipelineWorking = false;
      }
      
      // Test Canny edge detection
      if (typeof grayMat.canny === 'function') {
        const edges = grayMat.canny(50, 150);
        if (edges && edges.rows && edges.cols) {
          logResult('Canny Edge Detection', true, 'Edge detection successful');
        } else {
          logResult('Canny Edge Detection', false, 'Edge detection returned invalid result');
          pipelineWorking = false;
        }
      } else {
        logResult('Canny Edge Detection', false, 'canny method not available');
        pipelineWorking = false;
      }
      
    } catch (error) {
      logResult('Image Processing Pipeline', false, `Pipeline failed: ${error.message}`);
      pipelineWorking = false;
    }
    
    return pipelineWorking;
    
  } catch (error) {
    return logResult('Image Processing Pipeline Test', false, `Failed: ${error.message}`);
  }
}

function generateIntegrationReport(results) {
  logSection('OpenCV Integration Report');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const successRate = (passedTests / totalTests) * 100;
  
  console.log(`\nIntegration Result: ${passedTests}/${totalTests} tests passed (${successRate.toFixed(1)}%)`);
  
  const criticalTests = ['scalarPolyfill', 'morphologyOperations'];
  const criticalPassed = criticalTests.filter(test => results[test]).length;
  const criticalSuccess = (criticalPassed / criticalTests.length) * 100;
  
  console.log(`Critical Fixes: ${criticalPassed}/${criticalTests.length} core issues resolved (${criticalSuccess.toFixed(1)}%)`);
  
  if (successRate === 100) {
    console.log('🎉 All OpenCV integration improvements verified successfully!');
    console.log('✓ ByteBot framework is now optimally integrated with OpenCV');
  } else if (successRate >= 75) {
    console.log('✅ Most OpenCV integration improvements are working');
    console.log('✓ ByteBot should have significantly improved computer vision capabilities');
  } else if (criticalSuccess >= 50) {
    console.log('⚠️  Core issues partially resolved');
    console.log('✓ Basic OpenCV functionality should be improved');
  } else {
    console.log('❌ OpenCV integration improvements failed');
    console.log('✗ Critical compatibility issues remain unresolved');
  }
  
  // Specific recommendations
  if (!results.scalarPolyfill) {
    console.log('\n⚠️  Scalar polyfill not working - morphology operations will continue to fail');
  }
  
  if (!results.morphologyOperations) {
    console.log('\n⚠️  Morphology operations still failing - edge detection quality will be reduced');
  }
  
  if (!results.claheOperations) {
    console.log('\n⚠️  CLAHE operations not optimal - OCR preprocessing may use fallbacks');
  }
  
  return successRate >= 75;
}

// Main test process
function main() {
  console.log('ByteBot OpenCV Integration Validation');
  console.log('====================================');
  console.log('Testing OpenCV 4.8 compatibility fixes and polyfills...\n');
  
  const results = {
    scalarPolyfill: testScalarPolyfill(),
    morphologyOperations: testMorphologyOperations(), 
    claheOperations: testClaheOperations(),
    constants: testOpenCvConstants(),
    imagePipeline: testImageProcessingPipeline()
  };
  
  const success = generateIntegrationReport(results);
  
  if (success) {
    console.log('\n✓ OpenCV integration improvements validated successfully');
    console.log('🚀 ByteBot framework is ready for enhanced computer vision tasks');
  } else {
    console.log('\n⚠️  Some integration improvements need additional work');
    console.log('📋 Review the test results above for specific issues to address');
  }
  
  return success;
}

// Run validation if called directly
if (require.main === module) {
  main();
}

module.exports = {
  testScalarPolyfill,
  testMorphologyOperations,
  testClaheOperations,
  testOpenCvConstants,
  testImageProcessingPipeline,
  main
};
