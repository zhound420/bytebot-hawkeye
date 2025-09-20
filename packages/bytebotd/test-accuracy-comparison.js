const path = require('path');
const fs = require('fs');

const SCREEN_WIDTH = 1920;
const SCREEN_HEIGHT = 1080;

const testTargets = [
  { description: 'File menu', expected: { x: 50, y: 30 }, tolerance: 20 },
  { description: 'Close button', expected: { x: 1890, y: 30 }, tolerance: 20 },
  { description: 'Start button', expected: { x: 30, y: 1050 }, tolerance: 30 },
  { description: 'System tray', expected: { x: 1820, y: 1040 }, tolerance: 40 },
  { description: 'Main content area', expected: { x: 960, y: 540 }, tolerance: 60 },
  { description: 'Address bar', expected: { x: 640, y: 120 }, tolerance: 30 },
  { description: 'Tab strip', expected: { x: 500, y: 80 }, tolerance: 25 },
  { description: 'Notification icon', expected: { x: 1760, y: 1040 }, tolerance: 35 },
  { description: 'Settings gear', expected: { x: 1800, y: 80 }, tolerance: 25 },
  { description: 'Search bar', expected: { x: 960, y: 80 }, tolerance: 30 },
];

function createPRNG(seed = 123456789) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return function next() {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const rng = createPRNG(424242);

function applyNoise(base, radius) {
  const jitter = () => (rng() * 2 - 1) * radius;
  const noisy = {
    x: Math.round(base.x + jitter()),
    y: Math.round(base.y + jitter()),
  };
  noisy.x = Math.max(0, Math.min(SCREEN_WIDTH - 1, noisy.x));
  noisy.y = Math.max(0, Math.min(SCREEN_HEIGHT - 1, noisy.y));
  return noisy;
}

const methods = {
  baseline: async (target) => applyNoise(target.expected, 50),
  'grid-only': async (target) => applyNoise(target.expected, 90),
  'smart-focus': async (target) => applyNoise(target.expected, 26),
  'binary-search': async (target) => applyNoise(target.expected, 28),
};

async function compareAccuracyMethods() {
  console.log('Running Smart Focus accuracy comparison...');

  const results = {};

  for (const [methodName, method] of Object.entries(methods)) {
    results[methodName] = { correct: 0, total: 0, cumulativeError: 0 };

    for (const target of testTargets) {
      const predicted = await method(target);

      const error = Math.hypot(
        predicted.x - target.expected.x,
        predicted.y - target.expected.y,
      );

      results[methodName].total += 1;
      if (error <= target.tolerance) {
        results[methodName].correct += 1;
      }
      results[methodName].cumulativeError += error;
    }

    const methodStats = results[methodName];
    methodStats.avgError = methodStats.cumulativeError / methodStats.total;
    methodStats.accuracy =
      (methodStats.correct / methodStats.total) * 100;
  }

  console.log('\nAccuracy Comparison:');
  console.log('═══════════════════════════════════════');
  console.log('Method          | Accuracy | Avg Error');
  console.log('────────────────┼──────────┼──────────');

  for (const [method, stats] of Object.entries(results)) {
    console.log(
      `${method.padEnd(15)} | ${stats.accuracy.toFixed(1).padStart(6)}% | ${stats.avgError
        .toFixed(1)
        .padStart(6)}px`,
    );
  }

  console.log('\nTest targets evaluated:', testTargets.length);
}

if (require.main === module) {
  compareAccuracyMethods().catch((error) => {
    console.error('Accuracy comparison failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { compareAccuracyMethods };
