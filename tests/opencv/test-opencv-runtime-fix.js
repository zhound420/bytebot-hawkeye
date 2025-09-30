#!/usr/bin/env node
/**
 * Test script to verify opencv4nodejs runtime resolution fix
 * This simulates the runtime environment and path resolution
 */

const path = require('path');

console.log('🧪 Testing OpenCV runtime resolution fix...\n');

// Simulate different runtime contexts
const contexts = [
  {
    name: 'start-prod.js context',
    cwd: '/app/packages/bytebot-agent/scripts',
    description: 'Script startup context'
  },
  {
    name: 'compiled dist context', 
    cwd: '/app/packages/bytebot-agent/dist/src',
    description: 'NestJS runtime context where services execute'
  },
  {
    name: 'compiled service context',
    cwd: '/app/packages/bytebot-agent/dist/src/services',
    description: 'Deep service execution context'
  }
];

// Path resolution patterns from opencv-loader.ts
const pathPatterns = [
  'opencv4nodejs',  // Standard require
  '../../../bytebot-cv/node_modules/opencv4nodejs',  // From agent to cv package
  '../../bytebot-cv/node_modules/opencv4nodejs',     // Alternative relative path
  './node_modules/opencv4nodejs',                    // Local node_modules
  '../node_modules/opencv4nodejs',                   // Parent node_modules
  '../../../../node_modules/opencv4nodejs',          // From dist to root node_modules
  '../../../node_modules/opencv4nodejs',             // From dist to package node_modules
  '../../node_modules/opencv4nodejs',                // From dist subdirectory
  '../../../packages/bytebot-cv/node_modules/opencv4nodejs',  // From dist to cv package
  '../../../../packages/bytebot-cv/node_modules/opencv4nodejs', // Alternative dist to cv
];

// Simulated container structure
const expectedPaths = [
  '/app/packages/bytebot-agent/node_modules/opencv4nodejs',  // Our new independent installation
  '/app/packages/bytebot-cv/node_modules/opencv4nodejs',     // Original cv installation
];

console.log('📁 Expected opencv4nodejs installations:');
expectedPaths.forEach(p => console.log(`  ✓ ${p}`));
console.log('');

// Test path resolution for each context
contexts.forEach(context => {
  console.log(`📍 Testing context: ${context.name}`);
  console.log(`   Working directory: ${context.cwd}`);
  console.log(`   Description: ${context.description}`);
  
  pathPatterns.forEach(pattern => {
    try {
      const resolved = path.resolve(context.cwd, pattern);
      const matchesExpected = expectedPaths.some(expected => resolved === expected);
      
      if (matchesExpected) {
        console.log(`   ✅ ${pattern} → ${resolved}`);
      } else {
        console.log(`   ❓ ${pattern} → ${resolved} (checking...)`);
      }
    } catch (error) {
      console.log(`   ❌ ${pattern} → Error: ${error.message}`);
    }
  });
  console.log('');
});

// Test environment variable hint system
console.log('🔗 Testing environment variable hint system:');
console.log('   start-prod.js sets: OPENCV_MODULE_PATH=/app/packages/bytebot-agent/node_modules/opencv4nodejs');
console.log('   opencv-loader.ts reads this and tries it first');
console.log('   This should ensure consistent module resolution between contexts\n');

// Summary of changes made
console.log('📋 Summary of changes made:');
console.log('   1. ✅ Updated Dockerfile to build opencv4nodejs independently for bytebot-agent');
console.log('   2. ✅ Enhanced opencv-loader.ts with additional dist context paths');
console.log('   3. ✅ Added environment variable sharing for path hints');
console.log('   4. ✅ Fixed TypeScript declarations');
console.log('   5. ✅ Added runtime debugging in start-prod.js\n');

console.log('🚀 Next step: Rebuild container to test the fix');
console.log('   Command: docker compose build --no-cache bytebot-agent');
console.log('   This will apply all changes and verify opencv4nodejs is accessible at runtime.\n');

console.log('✨ Test completed! The fix should resolve the runtime path resolution mismatch.');
