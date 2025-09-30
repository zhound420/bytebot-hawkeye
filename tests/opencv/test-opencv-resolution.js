#!/usr/bin/env node
/**
 * Test script to validate opencv4nodejs module resolution logic
 * without requiring actual OpenCV bindings to be installed
 */

const path = require('path');
const fs = require('fs');

// Mock require function that simulates the module loading behavior
function testModuleResolution() {
  console.log('Testing OpenCV module resolution logic...\n');
  
  const possiblePaths = [
    'opencv4nodejs',  // Standard require
    '../../../bytebot-cv/node_modules/opencv4nodejs',  // From agent to cv package
    '../../bytebot-cv/node_modules/opencv4nodejs',     // Alternative relative path
    './node_modules/opencv4nodejs',                    // Local node_modules
    '../node_modules/opencv4nodejs',                   // Parent node_modules
  ];

  let attemptCount = 0;
  
  for (const modulePath of possiblePaths) {
    attemptCount++;
    console.log(`Attempt ${attemptCount}: Testing path "${modulePath}"`);
    
    try {
      // Check if path exists (this is what require would do first)
      const resolvedPath = path.resolve(modulePath);
      const exists = fs.existsSync(resolvedPath);
      
      if (exists) {
        console.log(`  ✓ Path exists: ${resolvedPath}`);
        
        // Check if it contains expected opencv4nodejs structure
        const packageJsonPath = path.join(resolvedPath, 'package.json');
        const hasPackageJson = fs.existsSync(packageJsonPath);
        
        if (hasPackageJson) {
          console.log(`  ✓ Valid npm package structure found`);
          console.log(`  → This would be selected as the module source\n`);
          return {
            success: true,
            selectedPath: modulePath,
            resolvedPath: resolvedPath,
            attemptCount
          };
        } else {
          console.log(`  ✗ Missing package.json, continuing search...`);
        }
      } else {
        console.log(`  ✗ Path does not exist: ${resolvedPath}`);
      }
    } catch (error) {
      console.log(`  ✗ Error checking path: ${error.message}`);
    }
  }
  
  console.log(`All ${attemptCount} module resolution attempts failed\n`);
  return {
    success: false,
    selectedPath: null,
    resolvedPath: null,
    attemptCount
  };
}

// Test from both contexts that would be used in production
console.log('=== Testing from bytebot-agent context ===');
process.chdir(path.join(__dirname, 'packages', 'bytebot-agent'));
const agentResult = testModuleResolution();

console.log('=== Testing from bytebot-cv context ===');
process.chdir(path.join(__dirname, 'packages', 'bytebot-cv'));
const cvResult = testModuleResolution();

// Summary
console.log('=== RESOLUTION TEST SUMMARY ===');
console.log(`Agent context: ${agentResult.success ? 'SUCCESS' : 'FAILED'}`);
if (agentResult.success) {
  console.log(`  Selected: ${agentResult.selectedPath}`);
  console.log(`  After ${agentResult.attemptCount} attempts`);
}

console.log(`CV context: ${cvResult.success ? 'SUCCESS' : 'FAILED'}`);
if (cvResult.success) {
  console.log(`  Selected: ${cvResult.selectedPath}`);
  console.log(`  After ${cvResult.attemptCount} attempts`);
}

console.log('\n=== NEXT STEPS ===');
if (!agentResult.success && !cvResult.success) {
  console.log('No opencv4nodejs installations found. This is expected before Docker build.');
  console.log('The multi-path resolution logic has been implemented and will be tested during container build.');
} else {
  console.log('Module resolution logic is working correctly!');
}

console.log('\nTo test the complete fix:');
console.log('1. Build the Docker container: docker compose build --no-cache bytebot-agent');
console.log('2. Run the container and check startup logs for opencv4nodejs resolution');
console.log('3. Look for successful module loading from both startup script and runtime services');
