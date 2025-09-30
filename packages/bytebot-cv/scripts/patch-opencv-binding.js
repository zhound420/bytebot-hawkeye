const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const moduleRoot = path.join(rootDir, 'node_modules', '@u4', 'opencv4nodejs');
const bindingPath = path.join(moduleRoot, 'binding.gyp');
const siftHeaderPath = path.join(moduleRoot, 'cc', 'xfeatures2d', 'SIFTDetector.h');
const claheSourceDir = path.join(rootDir, '@u4/opencv4nodejs');
const claheHeaderTarget = path.join(moduleRoot, 'cc', 'imgproc', 'CLAHE.h');
const claheSourceTarget = path.join(moduleRoot, 'cc', 'imgproc', 'CLAHE.cc');
const opencvModulePath = path.join(moduleRoot, 'cc', 'opencv4nodejs.cc');
const modulesHeaderPath = path.join(moduleRoot, 'cc', 'opencv_modules.h');
const nativeNodeUtilsBindingPath = path.join(moduleRoot, 'node_modules', 'native-node-utils', 'src', 'Binding.h');

function ensureDefines(content, defines) {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const marker = '"<!@(node ./install/parseEnv.js OPENCV4NODEJS_DEFINES)",';

  if (!content.includes(marker)) {
    return content;
  }

  const existingDefineRegex = /"([A-Z0-9_]+)"/g;
  const existing = new Set();
  let match;
  while ((match = existingDefineRegex.exec(content))) {
    existing.add(match[1]);
  }

  const missing = defines.filter((define) => !existing.has(define));
  if (!missing.length) {
    return content;
  }

  const insert = [marker, ...missing.map((define) => `"${define}",`)]
    .join(`${newline}\t\t\t`);

  return content.replace(marker, insert);
}

function patchSiftHeader(content) {
  let updated = content;
  const hasCrLf = updated.includes('\r\n');
  const newline = hasCrLf ? '\r\n' : '\n';

  if (!updated.includes('#include <opencv2/features2d.hpp>')) {
    updated = updated.replace(
      '#include <opencv2/xfeatures2d.hpp>',
      '#include <opencv2/xfeatures2d.hpp>' + newline + '#include <opencv2/features2d.hpp>'
    );
  }

  if (!updated.includes('SiftDetectorCvType')) {
    const marker = '#include "features2d/FeatureDetector.h"';
    const aliasBlock = [
      marker,
      '',
      '#if CV_VERSION_GREATER_EQUAL(4, 4, 0)',
      'using SiftDetectorCvType = cv::SIFT;',
      '#else',
      'using SiftDetectorCvType = cv::xfeatures2d::SIFT;',
      '#endif'
    ].join(newline);

    updated = updated.replace(marker, aliasBlock);
  }

  updated = updated.replace(/cv::Ptr<cv::xfeatures2d::SIFT>/g, 'cv::Ptr<SiftDetectorCvType>');
  updated = updated.replace(/cv::xfeatures2d::SIFT::create/g, 'SiftDetectorCvType::create');

  return updated;
}

function copyFileIfChanged(source, target) {
  if (!fs.existsSync(source)) {
    return false;
  }

  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target);
    const proposed = fs.readFileSync(source);
    if (existing.equals(proposed)) {
      return false;
    }
  }

  fs.copyFileSync(source, target);
  return true;
}

function ensureClaheSources() {
  const sourceHeader = path.join(claheSourceDir, 'CLAHE.h');
  const sourceImpl = path.join(claheSourceDir, 'CLAHE.cc');

  let changed = false;
  try {
    if (copyFileIfChanged(sourceHeader, claheHeaderTarget)) {
      changed = true;
      console.log('[opencv4nodejs] installed CLAHE.h binding');
    }
    if (copyFileIfChanged(sourceImpl, claheSourceTarget)) {
      changed = true;
      console.log('[opencv4nodejs] installed CLAHE.cc binding');
    }
  } catch (error) {
    console.warn('[opencv4nodejs] unable to copy CLAHE bindings', error);
  }
  return changed;
}

function ensureClaheInBindingGyp(content) {
  if (content.includes('cc/imgproc/CLAHE.cc')) {
    return content;
  }

  const pattern = /"cc\/imgproc\/imgproc\.cc"\s*,/;
  if (!pattern.test(content)) {
    return content;
  }

  return content.replace(pattern, (match) => `${match}\n        "cc/imgproc/CLAHE.cc",`);
}

function ensureClaheRegistration(content) {
  const includeMarker = '#include "imgproc/imgproc.h"';
  if (!content.includes('#include "imgproc/CLAHE.h"') && content.includes(includeMarker)) {
    content = content.replace(
      includeMarker,
      `${includeMarker}\n#include "imgproc/CLAHE.h"`,
    );
  }

  const initMarker = '\tImgproc::Init(target);';
  if (content.includes(initMarker) && !content.includes('CLAHE::Init(target);')) {
    content = content.replace(
      initMarker,
      `${initMarker}\n\tCLAHE::Init(target);`,
    );
  }

  return content;
}

function patchNativeNodeUtilsBinding(content) {
  const hasCrLf = content.includes('\r\n');
  const newline = hasCrLf ? '\r\n' : '\n';
  
  // Check if already patched
  if (content.includes('#pragma GCC diagnostic push') && content.includes('BYTEBOT_PATCHED')) {
    console.log('[opencv4nodejs] native-node-utils already patched');
    return content;
  }

  // Add comprehensive pragma directives to suppress all problematic warnings
  const pragmaStart = [
    '#pragma GCC diagnostic push',
    '#pragma GCC diagnostic ignored "-Wunused-function"',
    '#pragma GCC diagnostic ignored "-Wunused-parameter"',
    '#pragma GCC diagnostic ignored "-Wunused-variable"',
    '// BYTEBOT_PATCHED: Warning suppression applied'
  ].join(newline);
  
  const pragmaEnd = '#pragma GCC diagnostic pop';

  // Find the namespace FF opening brace
  const namespacePattern = /namespace\s+FF\s*\{/;
  const namespaceMatch = content.match(namespacePattern);
  
  if (!namespaceMatch) {
    console.warn('[opencv4nodejs] Could not find FF namespace in native-node-utils Binding.h');
    return content;
  }

  // Insert pragma after namespace opening
  let updated = content.replace(
    namespacePattern,
    `${namespaceMatch[0]}${newline}${newline}${pragmaStart}`
  );

  // Find the namespace closing brace and add pragma end before it
  const closingBracePattern = /(\s*)\}\s*$/m;
  updated = updated.replace(
    closingBracePattern,
    `${newline}${pragmaEnd}${newline}$1}`
  );

  return updated;
}

function handleXfeatures2dDependency() {
  // Check if xfeatures2d is available and handle gracefully if not
  const bindingPath = path.join(moduleRoot, 'binding.gyp');
  
  if (!fs.existsSync(bindingPath)) {
    return false;
  }

  try {
    const bindingContent = fs.readFileSync(bindingPath, 'utf8');
    
    // Check if xfeatures2d is referenced
    if (bindingContent.includes('xfeatures2d') || bindingContent.includes('SIFT')) {
      console.log('[opencv4nodejs] Checking xfeatures2d availability...');
      
      // Try to detect if xfeatures2d headers are available
      const xfeatures2dHeader = '/usr/include/opencv4/opencv2/xfeatures2d.hpp';
      if (!fs.existsSync(xfeatures2dHeader)) {
        console.warn('[opencv4nodejs] xfeatures2d headers not found, disabling SIFT support');
        
        const newline = bindingContent.includes('\r\n') ? '\r\n' : '\n';
        const bindingLines = bindingContent.split(/\r?\n/);
        const filteredBindingLines = bindingLines.filter(line => !line.includes('cc/xfeatures2d/'))
          .map(line => line.replace('HAVE_OPENCV_XFEATURES2D', 'OPENCV_XFEATURES2D_DISABLED'));
        const updatedBinding = filteredBindingLines.join(newline);

        if (updatedBinding !== bindingContent) {
          fs.writeFileSync(bindingPath, updatedBinding, 'utf8');
          console.log('[opencv4nodejs] Updated binding.gyp to disable xfeatures2d');
        }

        if (fs.existsSync(modulesHeaderPath)) {
          const modulesContent = fs.readFileSync(modulesHeaderPath, 'utf8');
          const modulesNewline = modulesContent.includes('\r\n') ? '\r\n' : '\n';
          const strippedModules = modulesContent
            .replace(/#ifdef OPENCV4NODEJS_FOUND_LIBRARY_XFEATURES2D[\s\S]*?#endif\r?\n?/g, '')
            .replace(/#define HAVE_OPENCV_XFEATURES2D\r?\n?/g, '');
          if (strippedModules !== modulesContent) {
            fs.writeFileSync(modulesHeaderPath, strippedModules, 'utf8');
            console.log('[opencv4nodejs] Removed xfeatures2d flags from opencv_modules.h');
          }
        }

        if (fs.existsSync(opencvModulePath)) {
          const mainContent = fs.readFileSync(opencvModulePath, 'utf8');
          const cleanedMain = mainContent.replace(/#ifdef HAVE_OPENCV_XFEATURES2D[\s\S]*?#endif\r?\n?/g, '');
          if (cleanedMain !== mainContent) {
            fs.writeFileSync(opencvModulePath, cleanedMain, 'utf8');
            console.log('[opencv4nodejs] Removed xfeatures2d initialization from opencv4nodejs.cc');
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.warn('[opencv4nodejs] Error handling xfeatures2d dependency:', error.message);
    return false;
  }
}

function verifyPatchSuccess() {
  // Verify that our patches were applied successfully
  const verificationSteps = [
    {
      name: 'native-node-utils patch',
      check: () => {
        if (!fs.existsSync(nativeNodeUtilsBindingPath)) {
          return { success: false, message: 'native-node-utils Binding.h not found' };
        }
        
        const content = fs.readFileSync(nativeNodeUtilsBindingPath, 'utf8');
        if (content.includes('BYTEBOT_PATCHED')) {
          return { success: true, message: 'Warning suppression applied' };
        }
        
        return { success: false, message: 'Patch not applied' };
      }
    },
    {
      name: 'OpenCV binding configuration',
      check: () => {
        if (!fs.existsSync(bindingPath)) {
          return { success: false, message: 'binding.gyp not found' };
        }
        
        const content = fs.readFileSync(bindingPath, 'utf8');
        const hasDefines = content.includes('OPENCV_ENABLE_NONFREE');
        
        return { 
          success: hasDefines, 
          message: hasDefines ? 'OpenCV defines configured' : 'OpenCV defines missing' 
        };
      }
    }
  ];

  console.log('[opencv4nodejs] Verifying patch application...');
  let allSuccess = true;
  
  for (const step of verificationSteps) {
    const result = step.check();
    const status = result.success ? '✓' : '✗';
    console.log(`[opencv4nodejs] ${status} ${step.name}: ${result.message}`);
    
    if (!result.success) {
      allSuccess = false;
    }
  }
  
  return allSuccess;
}

try {
  console.log('[opencv4nodejs] Starting comprehensive patching process...');
  
  // Handle xfeatures2d dependency issues first
  handleXfeatures2dDependency();
  
  if (fs.existsSync(bindingPath)) {
    const original = fs.readFileSync(bindingPath, 'utf8');
    let updated = ensureDefines(original, ['OPENCV_ENABLE_NONFREE', 'HAVE_OPENCV_XFEATURES2D']);
    updated = ensureClaheInBindingGyp(updated);
    if (updated !== original) {
      fs.writeFileSync(bindingPath, updated, 'utf8');
      console.log('[opencv4nodejs] updated binding.gyp for CLAHE support');
    }
  } else {
    console.warn('[opencv4nodejs] binding.gyp not found; skipping define patch');
  }

  if (fs.existsSync(siftHeaderPath)) {
    const originalHeader = fs.readFileSync(siftHeaderPath, 'utf8');
    const patchedHeader = patchSiftHeader(originalHeader);
    if (patchedHeader !== originalHeader) {
      fs.writeFileSync(siftHeaderPath, patchedHeader, 'utf8');
      console.log('[opencv4nodejs] patched SIFT detector for OpenCV >= 4.4');
    }
  }

  const claheInstalled = ensureClaheSources();

  if (fs.existsSync(opencvModulePath)) {
    const originalModule = fs.readFileSync(opencvModulePath, 'utf8');
    const patchedModule = ensureClaheRegistration(originalModule);
    if (patchedModule !== originalModule) {
      fs.writeFileSync(opencvModulePath, patchedModule, 'utf8');
      console.log('[opencv4nodejs] registered CLAHE module');
    } else if (claheInstalled) {
      console.log('[opencv4nodejs] CLAHE module already registered');
    }
  }

  // Patch native-node-utils to suppress unused function warnings
  if (fs.existsSync(nativeNodeUtilsBindingPath)) {
    const originalBinding = fs.readFileSync(nativeNodeUtilsBindingPath, 'utf8');
    const patchedBinding = patchNativeNodeUtilsBinding(originalBinding);
    if (patchedBinding !== originalBinding) {
      fs.writeFileSync(nativeNodeUtilsBindingPath, patchedBinding, 'utf8');
      console.log('[opencv4nodejs] patched native-node-utils to suppress unused function warnings');
    }
  } else {
    console.warn('[opencv4nodejs] native-node-utils Binding.h not found; skipping warning suppression patch');
  }
  
  // Verify all patches were applied successfully
  const patchSuccess = verifyPatchSuccess();
  if (patchSuccess) {
    console.log('[opencv4nodejs] ✓ All patches applied successfully');
  } else {
    console.warn('[opencv4nodejs] ⚠ Some patches may not have been applied correctly');
  }
  
} catch (error) {
  console.error('[opencv4nodejs] ✗ Error during patching process:', error.message);
  console.warn('[opencv4nodejs] This may cause compilation warnings or errors');
  process.exit(1);
}
