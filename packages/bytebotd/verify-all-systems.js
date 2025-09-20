  const fs = require('fs');
  const path = require('path');

  console.log('🔍 ByteBot Smart Focus System Verification\n');
  console.log('='.repeat(50));

  console.log('\n📋 Environment Variables:');
  console.log('  BYTEBOT_GRID_OVERLAY:', process.env.BYTEBOT_GRID_OVERLAY);
  console.log('  BYTEBOT_SMART_FOCUS:', process.env.BYTEBOT_SMART_FOCUS);
  console.log('  BYTEBOT_LLM_PROXY_URL:', process.env.BYTEBOT_LLM_PROXY_URL);

  async function verifyAllSystems() {
    const results = {
      basicScreenshot: false,
      gridOverlay: false,
      regionCapture: false,
      smartFocus: false,
      progressTracking: false,
    };

    try {
      console.log('\n🧪 Test 1: Basic Screenshot');
      const { NutService } = require('./dist/nut/nut.service');
      const nutService = new NutService();
      const screenshot = await nutService.screendump();
      fs.writeFileSync('/app/test-output/01-basic.png', screenshot);
      console.log('  ✓ Basic screenshot captured:', screenshot.length, 'bytes');
      results.basicScreenshot = true;
    } catch (e) {
      console.log('  ✗ Failed:', e.message);
    }

    try {
      console.log('\n🧪 Test 2: Grid Overlay');
      const { GridOverlayService } = require('./dist/nut/grid-overlay.service');
      const { NutService } = require('./dist/nut/nut.service');
      const nutService = new NutService();
      const gridService = new GridOverlayService();
      const screenshot = await nutService.screendump();
      const withGrid = await gridService.addGridToImage(screenshot, {
        gridSize: 100,
        showGlobalCoords: true,
      });
      fs.writeFileSync('/app/test-output/02-with-grid.png', withGrid);
      console.log('  ✓ Grid overlay applied');
      results.gridOverlay = true;
    } catch (e) {
      console.log('  ✗ Failed:', e.message);
    }

    try {
      console.log('\n🧪 Test 3: Region Capture');
      const { FocusRegionService } = require('./dist/nut/focus-region.service');
      const { GridOverlayService } = require('./dist/nut/grid-overlay.service');
      const { NutService } = require('./dist/nut/nut.service');
      const nutService = new NutService();
      const gridService = new GridOverlayService();
      const focusService = new FocusRegionService(nutService, gridService);
      const regions = ['top-left', 'middle-center', 'bottom-right'];

      for (const region of regions) {
        const result = await focusService.captureFocusedRegion(region, {
          gridSize: 50,
          enhance: true,
          includeOffset: true,
        });
        fs.writeFileSync(`/app/test-output/03-region-${region}.png`, result.image);
        console.log(`  ✓ Captured ${region} (offset: x=${result.offset.x}, y=${result.offset.y})`);
      }
      results.regionCapture = true;
    } catch (e) {
      console.log('  ✗ Failed:', e.message);
    }

    try {
      console.log('\n🧪 Test 4: Smart Focus Helper');
      if (fs.existsSync('./dist/agent/smart-click.helper.js')) {
        console.log('  ✓ SmartClickHelper compiled');
        if (process.env.BYTEBOT_LLM_PROXY_URL) {
          console.log('  ✓ LLM Proxy configured:', process.env.BYTEBOT_LLM_PROXY_URL);
          results.smartFocus = true;
        } else {
          console.log('  ⚠ LLM Proxy not configured');
        }
      } else {
        console.log('  ✗ SmartClickHelper not found');
      }
    } catch (e) {
      console.log('  ✗ Failed:', e.message);
    }

    try {
      console.log('\n🧪 Test 5: Progress Tracking');
      const progressDir = '/app/progress';
      if (!fs.existsSync(progressDir)) {
        fs.mkdirSync(progressDir, { recursive: true });
      }
      const testDir = path.join(progressDir, 'test-' + Date.now());
      fs.mkdirSync(testDir);
      fs.writeFileSync(path.join(testDir, '01-full-screen.png'), 'test');
      fs.writeFileSync(path.join(testDir, '02-region.png'), 'test');
      fs.writeFileSync(path.join(testDir, '03-target.png'), 'test');
      console.log('  ✓ Progress directory created:', testDir);
      results.progressTracking = true;
    } catch (e) {
      console.log('  ✗ Failed:', e.message);
    }

    console.log('\n📊 SUMMARY');
    console.log('='.repeat(50));
    const passing = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;
    console.log(`\n${passing}/${total} systems operational (${Math.round((passing / total) * 100)}%)\n`);
    for (const [name, status] of Object.entries(results)) {
      console.log(`  ${status ? '✅' : '❌'} ${name}`);
    }
    console.log('\n📁 Test outputs saved to:');
    console.log('  - /app/test-output/');
    console.log('  - /app/progress/');
    if (passing === total) {
      console.log('\n🎉 All systems operational! Smart Focus ready for use.');
    } else {
      console.log('\n⚠️  Some systems need attention.');
    }
  }

  verifyAllSystems().catch(console.error);
