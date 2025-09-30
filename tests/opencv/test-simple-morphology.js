#!/usr/bin/env node
/**
 * Test morphology with available @u4/opencv4nodejs bindings
 */

console.log('=== Simple Morphology Test ===\n');

let cv;
try {
  cv = require('@u4/opencv4nodejs');
  console.log('✓ @u4/opencv4nodejs loaded\n');
} catch (error) {
  console.error('✗ Failed to load @u4/opencv4nodejs:', error.message);
  process.exit(1);
}

try {
  // Create sample data
  const data = new Uint8Array(32 * 32);
  data.fill(128);
  const sampleMat = new cv.Mat(32, 32, cv.CV_8UC1, Buffer.from(data));
  
  console.log('✓ Created sample Mat:', sampleMat.rows, 'x', sampleMat.cols);
  console.log('  instanceof cv.Mat:', sampleMat instanceof cv.Mat);
  console.log('  has morphologyEx method:', typeof sampleMat.morphologyEx === 'function');
  
  // Create kernel
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  console.log('✓ Created kernel:', kernel.rows, 'x', kernel.cols);
  console.log('  kernel instanceof cv.Mat:', kernel instanceof cv.Mat);
  
  // Test morphology operation (the one that's available)
  console.log('\n--- Testing sampleMat.morphologyEx(MORPH_CLOSE, kernel) ---');
  
  const result = sampleMat.morphologyEx(cv.MORPH_CLOSE, kernel);
  console.log('✓ SUCCESS! Morphology result:', result.rows, 'x', result.cols);
  console.log('  result instanceof cv.Mat:', result instanceof cv.Mat);
  
  console.log('\n🎉 MORPHOLOGY WORKS! The issue is in our validation code, not the bindings.');
  
} catch (error) {
  console.error('✗ Morphology test failed:', error.message);
  console.error('Full error:', error);
}

console.log('\n=== Test Complete ===');
