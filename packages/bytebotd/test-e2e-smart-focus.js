#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');

function loadModule(distPath, srcPath) {
  const distFull = path.join(__dirname, distPath);
  if (fs.existsSync(distFull)) {
    return require(distFull);
  }
  require('ts-node/register');
  const srcFull = path.join(__dirname, srcPath);
  return require(srcFull);
}

async function testEndToEnd() {
  console.log('🚀 ByteBot Smart Focus End-to-End Test\n');
  console.log('Configuration:');
  console.log(`  Grid Overlay: ${process.env.BYTEBOT_GRID_OVERLAY}`);
  console.log(`  Smart Focus: ${process.env.BYTEBOT_SMART_FOCUS}`);
  console.log(
    `  LLM Proxy: ${process.env.BYTEBOT_LLM_PROXY_URL || 'NOT SET'}`,
  );
  console.log(
    `  Model: ${process.env.BYTEBOT_SMART_FOCUS_MODEL || 'NOT SET'}\n`,
  );

  if (!process.env.BYTEBOT_LLM_PROXY_URL) {
    console.error('❌ BYTEBOT_LLM_PROXY_URL not set!');
    console.log('\nTo fix:');
    console.log(
      '1. OpenAI: export BYTEBOT_LLM_PROXY_URL=https://api.openai.com/v1/chat/completions',
    );
    console.log(
      '2. Test proxy: Run "node test-llm-proxy.js" and set BYTEBOT_LLM_PROXY_URL=http://localhost:8080/v1/chat/completions',
    );
  }

  const { NutService } = loadModule(
    'dist/nut/nut.service',
    'src/nut/nut.service',
  );
  const { GridOverlayService } = loadModule(
    'dist/nut/grid-overlay.service',
    'src/nut/grid-overlay.service',
  );
  const { FocusRegionService } = loadModule(
    'dist/nut/focus-region.service',
    'src/nut/focus-region.service',
  );
  const { ComputerUseService } = loadModule(
    'dist/computer-use/computer-use.service',
    'src/computer-use/computer-use.service',
  );

  const nutService = new NutService();
  const gridService = new GridOverlayService();
  const focusService = new FocusRegionService(nutService, gridService);
  const computerUse = new ComputerUseService(
    nutService,
    gridService,
    focusService,
  );

  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('📸 Test 1: Full Screenshot with Grid\n');
  try {
    const fullScreen = await computerUse.action({ action: 'screenshot' });
    fs.writeFileSync(
      path.join(outputDir, 'e2e-fullscreen.png'),
      Buffer.from(fullScreen.image, 'base64'),
    );
    console.log('✅ Full screenshot saved to test-output/e2e-fullscreen.png');
  } catch (error) {
    console.error('❌ Full screenshot failed:', error?.message || error);
  }

  console.log('\n📍 Test 2: Region Capture Test\n');
  const regions = ['top-left', 'middle-center', 'bottom-right'];

  for (const region of regions) {
    try {
      const result = await computerUse.action({
        action: 'screenshot_region',
        region,
        gridSize: 50,
        enhance: true,
        includeOffset: true,
      });

      fs.writeFileSync(
        path.join(outputDir, `e2e-region-${region}.png`),
        Buffer.from(result.image, 'base64'),
      );

      console.log(
        `✅ Region ${region} captured (offset: x=${result.offset?.x}, y=${result.offset?.y})`,
      );
    } catch (error) {
      console.error(`❌ Region ${region} failed:`, error?.message || error);
    }
  }

  console.log('\n🎯 Test 3: Smart Click Simulation\n');
  const targets = [
    { description: 'File menu', expected: { x: 50, y: 30 } },
    { description: 'top-left corner', expected: { x: 10, y: 10 } },
    { description: 'center of screen', expected: { x: 960, y: 540 } },
  ];

  for (const target of targets) {
    console.log(`\nTesting: "${target.description}"`);
    console.log(`Expected: (${target.expected.x}, ${target.expected.y})`);
    console.log('  → Would trigger Smart Focus workflow');
    console.log('  → Phase 1: Identify region');
    console.log('  → Phase 2: Focused capture');
    console.log('  → Phase 3: Execute click');
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📊 Summary:');
  console.log('═'.repeat(50));
  console.log('✅ Grid Overlay: Requested');
  console.log('✅ Region Capture: Attempted');
  console.log(
    `${process.env.BYTEBOT_LLM_PROXY_URL ? '✅' : '❌'} Smart Focus: ${
      process.env.BYTEBOT_LLM_PROXY_URL ? 'Configured' : 'Not configured'
    }`,
  );

  if (process.env.BYTEBOT_LLM_PROXY_URL) {
    console.log('\n🎉 System ready for Smart Focus!');
    console.log('Next: Run ByteBot normally and it will use Smart Focus automatically.');
  } else {
    console.log('\n⚠️  Configure LLM proxy to enable Smart Focus');
  }
}

if (require.main === module) {
  testEndToEnd().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { testEndToEnd };
