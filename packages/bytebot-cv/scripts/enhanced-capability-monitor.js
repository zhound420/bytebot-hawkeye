#!/usr/bin/env node

/**
 * Enhanced OpenCV Capability Monitoring and Detection System
 * Monitors native operation availability and performance metrics
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

let cv = null;
let hasOpenCV = false;

// Try to load OpenCV with multiple fallback paths
function loadOpenCV() {
  const possiblePaths = [
    '@u4/opencv4nodejs',
    '../node_modules/@u4/opencv4nodejs',
    './node_modules/@u4/opencv4nodejs',
    '../../node_modules/@u4/opencv4nodejs'
  ];

  for (const modulePath of possiblePaths) {
    try {
      cv = require(modulePath);
      hasOpenCV = true;
      return true;
    } catch (error) {
      continue;
    }
  }
  return false;
}

// Enhanced CLAHE capability detection
function detectClaheCapabilities() {
  if (!hasOpenCV) {
    return { available: false, methods: [], error: 'OpenCV unavailable' };
  }

  const methods = [];
  const errors = [];

  const claheTests = [
    {
      name: 'cv.createCLAHE()',
      test: () => {
        if (typeof cv.createCLAHE === 'function') {
          const clahe = cv.createCLAHE();
          return { success: true, instance: clahe };
        }
        return { success: false, error: 'createCLAHE function not available' };
      }
    },
    {
      name: 'cv.imgproc.createCLAHE()',
      test: () => {
        if (typeof cv.imgproc?.createCLAHE === 'function') {
          const clahe = cv.imgproc.createCLAHE();
          return { success: true, instance: clahe };
        }
        return { success: false, error: 'imgproc.createCLAHE function not available' };
      }
    },
    {
      name: 'cv.xphoto.createCLAHE()',
      test: () => {
        if (typeof cv.xphoto?.createCLAHE === 'function') {
          const clahe = cv.xphoto.createCLAHE();
          return { success: true, instance: clahe };
        }
        return { success: false, error: 'xphoto.createCLAHE function not available' };
      }
    }
  ];

  for (const test of claheTests) {
    try {
      const result = test.test();
      if (result.success) {
        methods.push({
          name: test.name,
          available: true,
          applyMethod: result.instance && typeof result.instance.apply === 'function' ? 'apply' : 'unknown'
        });
        
        // Test actual CLAHE operation
        try {
          const testMat = new cv.Mat(32, 32, cv.CV_8UC1, 128);
          const processed = result.instance.apply(testMat);
          methods[methods.length - 1].functional = true;
          methods[methods.length - 1].performance = 'tested';
        } catch (opError) {
          methods[methods.length - 1].functional = false;
          methods[methods.length - 1].error = opError.message;
        }
      }
    } catch (error) {
      errors.push({ method: test.name, error: error.message });
    }
  }

  return {
    available: methods.length > 0,
    methods,
    errors,
    nativeSupport: methods.some(m => m.functional)
  };
}

// Enhanced morphology capability detection
function detectMorphologyCapabilities() {
  if (!hasOpenCV) {
    return { available: false, methods: [], error: 'OpenCV unavailable' };
  }

  const methods = [];
  const errors = [];

  const morphTests = [
    {
      name: 'cv.morphologyEx()',
      test: () => {
        if (typeof cv.morphologyEx === 'function') {
          return { success: true, method: cv.morphologyEx };
        }
        return { success: false, error: 'morphologyEx function not available' };
      }
    },
    {
      name: 'cv.imgproc.morphologyEx()',
      test: () => {
        if (typeof cv.imgproc?.morphologyEx === 'function') {
          return { success: true, method: cv.imgproc.morphologyEx };
        }
        return { success: false, error: 'imgproc.morphologyEx function not available' };
      }
    },
    {
      name: 'Mat.morphologyEx()',
      test: () => {
        const testMat = new cv.Mat(32, 32, cv.CV_8UC1, 128);
        if (typeof testMat.morphologyEx === 'function') {
          return { success: true, method: testMat.morphologyEx.bind(testMat) };
        }
        return { success: false, error: 'Mat.morphologyEx method not available' };
      }
    }
  ];

  for (const test of morphTests) {
    try {
      const result = test.test();
      if (result.success) {
        methods.push({
          name: test.name,
          available: true
        });
        
        // Test actual morphology operation
        try {
          const testMat = new cv.Mat(32, 32, cv.CV_8UC1, 128);
          const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
          const processed = test.name === 'Mat.morphologyEx()' 
            ? testMat.morphologyEx(cv.MORPH_CLOSE, kernel)
            : result.method(testMat, cv.MORPH_CLOSE, kernel);
          
          methods[methods.length - 1].functional = true;
          methods[methods.length - 1].performance = 'tested';
        } catch (opError) {
          methods[methods.length - 1].functional = false;
          methods[methods.length - 1].error = opError.message;
        }
      }
    } catch (error) {
      errors.push({ method: test.name, error: error.message });
    }
  }

  return {
    available: methods.length > 0,
    methods,
    errors,
    nativeSupport: methods.some(m => m.functional)
  };
}

// Performance benchmarking
function benchmarkCvOperations() {
  if (!hasOpenCV) {
    return { error: 'OpenCV unavailable for benchmarking' };
  }

  const results = {};

  try {
    // Benchmark basic Mat operations
    const start = performance.now();
    const testMat = new cv.Mat(100, 100, cv.CV_8UC3);
    const gray = testMat.cvtColor(cv.COLOR_BGR2GRAY);
    const basicTime = performance.now() - start;
    results.basicOperations = { time: Math.round(basicTime * 100) / 100, status: 'success' };
  } catch (error) {
    results.basicOperations = { error: error.message, status: 'failed' };
  }

  // Benchmark CLAHE if available
  try {
    const claheStart = performance.now();
    if (typeof cv.createCLAHE === 'function') {
      const clahe = cv.createCLAHE();
      const testMat = new cv.Mat(100, 100, cv.CV_8UC1, 128);
      const enhanced = clahe.apply(testMat);
      const claheTime = performance.now() - claheStart;
      results.claheNative = { time: Math.round(claheTime * 100) / 100, status: 'native' };
    } else {
      throw new Error('Native CLAHE unavailable');
    }
  } catch (error) {
    // Test fallback CLAHE performance
    try {
      const fallbackStart = performance.now();
      const testMat = new cv.Mat(100, 100, cv.CV_8UC1, 128);
      const enhanced = testMat.equalizeHist();
      const fallbackTime = performance.now() - fallbackStart;
      results.claheFallback = { time: Math.round(fallbackTime * 100) / 100, status: 'fallback' };
    } catch (fallbackError) {
      results.clahe = { error: fallbackError.message, status: 'failed' };
    }
  }

  // Benchmark morphology if available
  try {
    const morphStart = performance.now();
    if (typeof cv.morphologyEx === 'function') {
      const testMat = new cv.Mat(100, 100, cv.CV_8UC1, 128);
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
      const processed = cv.morphologyEx(testMat, cv.MORPH_CLOSE, kernel);
      const morphTime = performance.now() - morphStart;
      results.morphologyNative = { time: Math.round(morphTime * 100) / 100, status: 'native' };
    } else {
      throw new Error('Native morphology unavailable');
    }
  } catch (error) {
    results.morphology = { error: error.message, status: 'failed' };
  }

  return results;
}

// Enhanced module information gathering
function getOpenCvModuleInfo() {
  if (!hasOpenCV) {
    return { error: 'OpenCV unavailable' };
  }

  const info = {
    version: cv.version || cv.VERSION || 'unknown',
    buildInfo: 'unavailable',
    modules: [],
    constants: {},
    capabilities: {}
  };

  try {
    if (typeof cv.getBuildInformation === 'function') {
      const buildInfo = cv.getBuildInformation();
      info.buildInfo = typeof buildInfo === 'string' 
        ? buildInfo.split('\n').slice(0, 10).join('\n')
        : 'unable to retrieve';
    }
  } catch (error) {
    info.buildInfo = `Error: ${error.message}`;
  }

  try {
    // Get available modules
    const moduleKeys = Object.keys(cv).filter(key => {
      try {
        const value = cv[key];
        return typeof value === 'object' && value !== null;
      } catch {
        return false;
      }
    });
    info.modules = moduleKeys.slice(0, 20); // Limit output
  } catch (error) {
    info.modules = [`Error: ${error.message}`];
  }

  // Check important constants
  const importantConstants = [
    'CV_8UC1', 'CV_8UC3', 'CV_32F',
    'MORPH_RECT', 'MORPH_CLOSE', 'MORPH_OPEN',
    'COLOR_BGR2GRAY', 'COLOR_RGB2GRAY'
  ];

  for (const constant of importantConstants) {
    try {
      info.constants[constant] = typeof cv[constant] === 'number' ? cv[constant] : 'unavailable';
    } catch (error) {
      info.constants[constant] = 'error';
    }
  }

  // Check key capabilities
  const capabilities = [
    'createCLAHE', 'morphologyEx', 'getStructuringElement',
    'equalizeHist', 'fastNlMeansDenoising', 'gaussianBlur',
    'canny', 'resize', 'cvtColor'
  ];

  for (const capability of capabilities) {
    try {
      info.capabilities[capability] = typeof cv[capability] === 'function';
    } catch (error) {
      info.capabilities[capability] = false;
    }
  }

  return info;
}

// Generate comprehensive report
function generateCapabilityReport() {
  console.log('=== Enhanced OpenCV Capability Monitor ===\n');

  const report = {
    timestamp: new Date().toISOString(),
    opencv: {
      available: hasOpenCV,
      moduleInfo: hasOpenCV ? getOpenCvModuleInfo() : null
    },
    clahe: detectClaheCapabilities(),
    morphology: detectMorphologyCapabilities(),
    performance: hasOpenCV ? benchmarkCvOperations() : null
  };

  // Display results
  console.log('🔍 OpenCV Module Status:');
  if (hasOpenCV) {
    console.log(`   ✓ OpenCV Available - Version: ${report.opencv.moduleInfo.version}`);
    console.log(`   ✓ Available modules (${report.opencv.moduleInfo.modules.length}): ${report.opencv.moduleInfo.modules.slice(0, 5).join(', ')}...`);
  } else {
    console.log('   ✗ OpenCV Not Available');
  }

  console.log('\n🎯 CLAHE Capabilities:');
  if (report.clahe.available) {
    const nativeMethods = report.clahe.methods.filter(m => m.functional);
    if (nativeMethods.length > 0) {
      console.log(`   ✓ Native CLAHE Available - ${nativeMethods.length} working methods:`);
      nativeMethods.forEach(method => {
        console.log(`     • ${method.name} (${method.applyMethod})`);
      });
    } else {
      console.log('   ⚠ CLAHE methods detected but non-functional');
      report.clahe.methods.forEach(method => {
        console.log(`     • ${method.name}: ${method.error || 'unknown error'}`);
      });
    }
  } else {
    console.log('   ⚠ No native CLAHE methods available - using enhanced fallbacks');
  }

  console.log('\n🔧 Morphology Capabilities:');
  if (report.morphology.available) {
    const nativeMethods = report.morphology.methods.filter(m => m.functional);
    if (nativeMethods.length > 0) {
      console.log(`   ✓ Native Morphology Available - ${nativeMethods.length} working methods:`);
      nativeMethods.forEach(method => {
        console.log(`     • ${method.name}`);
      });
    } else {
      console.log('   ⚠ Morphology methods detected but non-functional');
      report.morphology.methods.forEach(method => {
        console.log(`     • ${method.name}: ${method.error || 'unknown error'}`);
      });
    }
  } else {
    console.log('   ⚠ No native morphology methods available - using fallbacks');
  }

  console.log('\n⚡ Performance Metrics:');
  if (report.performance && !report.performance.error) {
    Object.entries(report.performance).forEach(([operation, result]) => {
      if (result.time) {
        const statusIcon = result.status === 'native' ? '🚀' : result.status === 'fallback' ? '🔄' : '⚠️';
        console.log(`   ${statusIcon} ${operation}: ${result.time}ms (${result.status})`);
      } else if (result.error) {
        console.log(`   ✗ ${operation}: ${result.error}`);
      }
    });
  } else {
    console.log('   ⚠ Performance benchmarking unavailable');
  }

  // Save detailed report
  const reportPath = path.join(__dirname, '..', 'capability-report.json');
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  } catch (error) {
    console.log(`\n⚠ Failed to save report: ${error.message}`);
  }

  return report;
}

// Performance comparison with previous baseline
function compareWithBaseline(currentReport) {
  const baselinePath = path.join(__dirname, '..', 'capability-baseline.json');
  
  try {
    if (!fs.existsSync(baselinePath)) {
      // Save current as baseline
      fs.writeFileSync(baselinePath, JSON.stringify(currentReport, null, 2));
      console.log('\n📊 Baseline capability report created');
      return null;
    }

    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    
    console.log('\n📈 Performance Comparison:');
    
    // Compare CLAHE
    const currentClahe = currentReport.clahe.nativeSupport;
    const baselineClahe = baseline.clahe?.nativeSupport || false;
    
    if (currentClahe && !baselineClahe) {
      console.log('   🎉 CLAHE: Improved from fallback to native support!');
    } else if (!currentClahe && baselineClahe) {
      console.log('   ⚠️ CLAHE: Regressed from native to fallback support');
    } else {
      console.log(`   📊 CLAHE: Status unchanged (${currentClahe ? 'native' : 'fallback'})`);
    }

    // Compare Morphology
    const currentMorph = currentReport.morphology.nativeSupport;
    const baselineMorph = baseline.morphology?.nativeSupport || false;
    
    if (currentMorph && !baselineMorph) {
      console.log('   🎉 Morphology: Improved from fallback to native support!');
    } else if (!currentMorph && baselineMorph) {
      console.log('   ⚠️ Morphology: Regressed from native to fallback support');
    } else {
      console.log(`   📊 Morphology: Status unchanged (${currentMorph ? 'native' : 'fallback'})`);
    }

    // Compare performance if available
    if (currentReport.performance && baseline.performance) {
      console.log('   ⚡ Performance changes:');
      
      const operations = new Set([
        ...Object.keys(currentReport.performance),
        ...Object.keys(baseline.performance)
      ]);

      for (const op of operations) {
        const current = currentReport.performance[op];
        const base = baseline.performance[op];
        
        if (current?.time && base?.time) {
          const improvement = ((base.time - current.time) / base.time * 100);
          if (Math.abs(improvement) > 5) {
            const direction = improvement > 0 ? '🟢 faster' : '🔴 slower';
            console.log(`     • ${op}: ${Math.abs(improvement).toFixed(1)}% ${direction}`);
          }
        }
      }
    }

  } catch (error) {
    console.log(`\n⚠ Baseline comparison failed: ${error.message}`);
  }
}

// Main execution
async function main() {
  const loaded = loadOpenCV();
  
  if (!loaded) {
    console.log('⚠️ OpenCV not available - enhanced fallback systems should be used');
    console.log('✅ Fallback compatibility improvements still apply');
    return;
  }

  const report = generateCapabilityReport();
  compareWithBaseline(report);

  console.log('\n🏁 Capability monitoring completed');
  
  // Return summary for programmatic use
  return {
    claheNative: report.clahe.nativeSupport,
    morphologyNative: report.morphology.nativeSupport,
    overallStatus: report.clahe.nativeSupport && report.morphology.nativeSupport ? 'optimal' : 'improved-fallbacks'
  };
}

// Export for programmatic use
module.exports = {
  detectClaheCapabilities,
  detectMorphologyCapabilities,
  benchmarkCvOperations,
  generateCapabilityReport
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Capability monitoring failed:', error.message);
    process.exit(1);
  });
}
