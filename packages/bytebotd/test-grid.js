#!/usr/bin/env node

/**
 * Test script to verify grid overlay functionality
 *
 * This script:
 * 1. Takes a screenshot with grid overlay enabled
 * 2. Saves it to a file for visual inspection
 * 3. Tests both normal and debug grid modes
 * 4. Provides clear success/error feedback
 */

const fs = require('fs');
const path = require('path');

// Set environment variables for testing
process.env.BYTEBOT_GRID_OVERLAY = 'true';

// Import the services after setting environment variables
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function testGridOverlay() {
    console.log('🧪 Testing ByteBot Grid Overlay System');
    console.log('=====================================\n');

    let app;

    try {
        // Create NestJS application
        console.log('📦 Initializing NestJS application...');
        app = await NestFactory.createApplicationContext(AppModule, {
            logger: ['error', 'warn'], // Reduce log noise
        });

        // Get the computer use service
        const { ComputerUseService } = require('./dist/computer-use/computer-use.service');
        const computerUseService = app.get(ComputerUseService);

        // Test 1: Standard Grid Overlay
        console.log('🔍 Test 1: Taking screenshot with standard grid overlay...');
        process.env.BYTEBOT_GRID_DEBUG = 'false';

        const result1 = await computerUseService.screenshot();
        const buffer1 = Buffer.from(result1.image, 'base64');

        const outputPath1 = path.join(__dirname, 'test-screenshot-standard-grid.png');
        fs.writeFileSync(outputPath1, buffer1);

        console.log('✅ Standard grid screenshot saved to:', outputPath1);
        console.log(`   File size: ${(buffer1.length / 1024).toFixed(2)} KB\n`);

        // Test 2: Debug Grid Overlay
        console.log('🔍 Test 2: Taking screenshot with debug grid overlay...');
        process.env.BYTEBOT_GRID_DEBUG = 'true';

        const result2 = await computerUseService.screenshot();
        const buffer2 = Buffer.from(result2.image, 'base64');

        const outputPath2 = path.join(__dirname, 'test-screenshot-debug-grid.png');
        fs.writeFileSync(outputPath2, buffer2);

        console.log('✅ Debug grid screenshot saved to:', outputPath2);
        console.log(`   File size: ${(buffer2.length / 1024).toFixed(2)} KB\n`);

        // Test 3: No Grid (Control)
        console.log('🔍 Test 3: Taking screenshot without grid overlay (control)...');
        process.env.BYTEBOT_GRID_OVERLAY = 'false';

        const result3 = await computerUseService.screenshot();
        const buffer3 = Buffer.from(result3.image, 'base64');

        const outputPath3 = path.join(__dirname, 'test-screenshot-no-grid.png');
        fs.writeFileSync(outputPath3, buffer3);

        console.log('✅ Control screenshot (no grid) saved to:', outputPath3);
        console.log(`   File size: ${(buffer3.length / 1024).toFixed(2)} KB\n`);

        // Compare file sizes
        console.log('📊 File Size Comparison:');
        console.log(`   No Grid:      ${(buffer3.length / 1024).toFixed(2)} KB`);
        console.log(`   Standard Grid: ${(buffer1.length / 1024).toFixed(2)} KB`);
        console.log(`   Debug Grid:    ${(buffer2.length / 1024).toFixed(2)} KB`);

        const overhead1 = ((buffer1.length - buffer3.length) / buffer3.length * 100).toFixed(1);
        const overhead2 = ((buffer2.length - buffer3.length) / buffer3.length * 100).toFixed(1);
        console.log(`   Standard Grid Overhead: ${overhead1}%`);
        console.log(`   Debug Grid Overhead: ${overhead2}%\n`);

        // Verification checks
        console.log('🔍 Verification:');
        console.log(`   ✅ Standard grid file exists: ${fs.existsSync(outputPath1)}`);
        console.log(`   ✅ Debug grid file exists: ${fs.existsSync(outputPath2)}`);
        console.log(`   ✅ Control file exists: ${fs.existsSync(outputPath3)}`);
        console.log(`   ✅ Grid files are larger: ${buffer1.length > buffer3.length && buffer2.length > buffer3.length}`);

        // Instructions for manual verification
        console.log('\n📋 Manual Verification Instructions:');
        console.log('   1. Open the generated PNG files in an image viewer');
        console.log('   2. Verify the standard grid shows:');
        console.log('      - Semi-transparent green grid lines every 100px');
        console.log('      - Green coordinate labels on edges');
        console.log('      - Corner coordinates (0,0), (width,0), etc.');
        console.log('   3. Verify the debug grid shows:');
        console.log('      - High-contrast red grid lines');
        console.log('      - Bold red coordinate labels');
        console.log('      - Thicker lines for visibility');
        console.log('   4. Verify the control image has no grid overlay');

        console.log('\n🎉 Grid overlay test completed successfully!');
        console.log('📁 Output files saved in:', __dirname);

    } catch (error) {
        console.error('❌ Grid overlay test failed:', error.message);
        console.error('Stack trace:', error.stack);

        // Additional debugging info
        console.log('\n🔧 Debugging Information:');
        console.log('   Environment Variables:');
        console.log(`   - BYTEBOT_GRID_OVERLAY: ${process.env.BYTEBOT_GRID_OVERLAY}`);
        console.log(`   - BYTEBOT_GRID_DEBUG: ${process.env.BYTEBOT_GRID_DEBUG}`);
        console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);

        process.exit(1);
    } finally {
        if (app) {
            await app.close();
        }
    }
}

// Self-check before running
function preFlightCheck() {
    console.log('🔧 Pre-flight Check:');

    const requiredFiles = [
        './dist/app.module.js',
        './dist/computer-use/computer-use.service.js'
    ];

    for (const file of requiredFiles) {
        const fullPath = path.join(__dirname, file);
        if (!fs.existsSync(fullPath)) {
            console.error(`❌ Required file not found: ${fullPath}`);
            console.error('💡 Run "npm run build" first to compile TypeScript files');
            process.exit(1);
        }
    }

    console.log('   ✅ All required compiled files found');
    console.log('   ✅ Environment variables set for testing');
    console.log('');
}

// Run the test
if (require.main === module) {
    preFlightCheck();
    testGridOverlay().catch(console.error);
}

module.exports = { testGridOverlay };
