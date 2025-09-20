const fs = require('fs');
const path = require('path');

function loadFocusServices() {
  try {
    // Prefer TypeScript sources for iterative development
    require('ts-node/register');
    const { FocusRegionService } = require('./src/nut/focus-region.service');
    const { GridOverlayService } = require('./src/nut/grid-overlay.service');
    return { FocusRegionService, GridOverlayService };
  } catch (error) {
    // Fallback to compiled output if ts-node is unavailable
    const { FocusRegionService } = require('./dist/nut/focus-region.service');
    const { GridOverlayService } = require('./dist/nut/grid-overlay.service');
    return { FocusRegionService, GridOverlayService };
  }
}

const { FocusRegionService, GridOverlayService } = loadFocusServices();

async function testFocusSystem() {
  console.log('Testing Smart Focus System...\n');

  const outputDir = path.join(__dirname, 'test-output');
  fs.mkdirSync(outputDir, { recursive: true });

  const screenshotPath = path.join(__dirname, 'test-mock-ui.png');
  if (!fs.existsSync(screenshotPath)) {
    throw new Error('Sample screenshot test-mock-ui.png not found.');
  }

  let screenshotCalls = 0;
  const mockNutService = {
    async screendump() {
      screenshotCalls += 1;
      return fs.readFileSync(screenshotPath);
    },
  };

  const gridOverlay = new GridOverlayService();
  const focusService = new FocusRegionService(mockNutService, gridOverlay);

  // Test 1: Capture all regions
  console.log('Test 1: Capturing all 9 regions...');
  const regions = [
    'top-left',
    'top-center',
    'top-right',
    'middle-left',
    'middle-center',
    'middle-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ];

  for (const region of regions) {
    try {
      const result = await focusService.captureFocusedRegion(region, {
        gridSize: 50,
        enhance: true,
        includeOffset: true,
      });

      fs.writeFileSync(
        path.join(outputDir, `focus-${region}.png`),
        result.image,
      );

      console.log(
        `\u2713 ${region}: Saved (offset: x=${result.offset.x}, y=${result.offset.y})`,
      );
    } catch (error) {
      console.log(`\u2717 ${region}: Failed - ${error.message}`);
    }
  }

  // Test 2: Progressive zoom
  console.log('\nTest 2: Progressive zoom test...');
  const bounds = { x: 0, y: 0, width: 1920, height: 1080 };

  for (let i = 1; i <= 3; i++) {
    bounds.width = Math.floor(bounds.width / 2);
    bounds.height = Math.floor(bounds.height / 2);

    const zoomed = await focusService.captureCustomRegion(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      25 * i,
    );

    fs.writeFileSync(
      path.join(outputDir, `zoom-level-${i}.png`),
      zoomed.image,
    );
    console.log(
      `\u2713 Zoom level ${i}: ${bounds.width}x${bounds.height} pixels (zoom: ${zoomed.zoomLevel}x)`,
    );
  }

  console.log('\n\u2705 Focus system test complete!');
  console.log('Check test-output/ folder for generated images.');
  console.log(`Screenshots captured: ${screenshotCalls}`);
}

if (require.main === module) {
  testFocusSystem().catch((error) => {
    console.error('Focus system test failed:', error);
    process.exitCode = 1;
  });
}
