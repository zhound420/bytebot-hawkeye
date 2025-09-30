#!/usr/bin/env node
/**
 * Debug script to verify OpenCV version and morphology bindings
 */

console.log('=== OpenCV Morphology Debug ===\n');

// Try to load opencv4nodejs
let cv;
try {
  cv = require('opencv4nodejs');
  console.log('✓ opencv4nodejs loaded successfully\n');
} catch (error) {
  console.error('✗ Failed to load opencv4nodejs:', error.message);
  process.exit(1);
}

// 1. Check OpenCV version
console.log('--- Version Information ---');
console.log('cv.version type:', typeof cv.version);
console.log('cv.version value:', cv.version);
console.log('cv.VERSION:', cv.VERSION);

if (typeof cv.getBuildInformation === 'function') {
  const buildInfo = cv.getBuildInformation();
  const lines = buildInfo.split('\n').slice(0, 10);
  console.log('\nBuild information (first 10 lines):');
  lines.forEach(line => console.log('  ', line));
}

// Extract actual version
let actualVersion = 'unknown';
if (typeof cv.version === 'string') {
  actualVersion = cv.version;
} else if (typeof cv.version === 'object' && cv.version !== null) {
  const { major, minor, patch } = cv.version;
  if (major !== undefined) {
    actualVersion = `${major}.${minor || 0}.${patch || 0}`;
  }
}
console.log('\n✓ Detected OpenCV version:', actualVersion);

// 2. Check morphology function availability
console.log('\n--- Morphology Function Availability ---');
console.log('cv.morphologyEx:', typeof cv.morphologyEx === 'function' ? '✓ Available' : '✗ Not available');
console.log('cv.imgproc:', typeof cv.imgproc);
if (cv.imgproc) {
  console.log('cv.imgproc.morphologyEx:', typeof cv.imgproc.morphologyEx === 'function' ? '✓ Available' : '✗ Not available');
}
console.log('cv.Mat.morphologyEx:', typeof cv.Mat?.morphologyEx === 'function' ? '✓ Available' : '✗ Not available');

// Test Mat instance method
const testMat = new cv.Mat(10, 10, cv.CV_8UC1, 128);
console.log('testMat.morphologyEx:', typeof testMat.morphologyEx === 'function' ? '✓ Available' : '✗ Not available');

// 3. Check morphology constants
console.log('\n--- Morphology Constants ---');
const constants = ['MORPH_RECT', 'MORPH_CLOSE', 'MORPH_OPEN', 'MORPH_ERODE', 'MORPH_DILATE'];
constants.forEach(name => {
  const value = cv[name];
  console.log(`cv.${name}:`, typeof value === 'number' ? `${value} ✓` : '✗ Not available');
});

// 4. Check getStructuringElement
console.log('\n--- Structuring Element ---');
console.log('cv.getStructuringElement:', typeof cv.getStructuringElement === 'function' ? '✓ Available' : '✗ Not available');
console.log('cv.Size:', typeof cv.Size === 'function' ? '✓ Available' : '✗ Not available');

// 5. Test actual morphology operation
console.log('\n--- Morphology Operation Test ---');

try {
  // Create test Mat with buffer initialization
  const data = new Uint8Array(32 * 32);
  data.fill(128);
  const sampleMat = new cv.Mat(32, 32, cv.CV_8UC1, Buffer.from(data));
  console.log('✓ Created sample Mat:', sampleMat.rows, 'x', sampleMat.cols);
  console.log('  Mat type:', sampleMat.type());
  console.log('  Mat instanceof cv.Mat:', sampleMat instanceof cv.Mat);
  console.log('  Mat empty:', typeof sampleMat.empty === 'function' ? sampleMat.empty() : 'N/A');
  
  // Create kernel
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  console.log('✓ Created kernel:', kernel.rows, 'x', kernel.cols);
  console.log('  Kernel type:', kernel.type());
  console.log('  Kernel instanceof cv.Mat:', kernel instanceof cv.Mat);
  
  // Test morphology operation
  if (typeof sampleMat.morphologyEx === 'function') {
    console.log('\nTesting sampleMat.morphologyEx(morphType, kernel)...');
    try {
      const result = sampleMat.morphologyEx(cv.MORPH_CLOSE, kernel);
      console.log('✓ Mat.morphologyEx SUCCESS:', result.rows, 'x', result.cols);
    } catch (error) {
      console.error('✗ Mat.morphologyEx FAILED:', error.message);
      console.error('   Error name:', error.name);
      console.error('   Error constructor:', error.constructor?.name);
    }
  }
  
  if (typeof cv.morphologyEx === 'function') {
    console.log('\nTesting cv.morphologyEx(src, morphType, kernel)...');
    try {
      const result = cv.morphologyEx(sampleMat, cv.MORPH_CLOSE, kernel);
      console.log('✓ cv.morphologyEx SUCCESS:', result.rows, 'x', result.cols);
    } catch (error) {
      console.error('✗ cv.morphologyEx FAILED:', error.message);
    }
  } else {
    console.log('✗ cv.morphologyEx function not available');
  }
  
} catch (error) {
  console.error('✗ Morphology test failed:', error.message);
  console.error('Stack:', error.stack);
}

console.log('\n=== Debug Complete ===');
