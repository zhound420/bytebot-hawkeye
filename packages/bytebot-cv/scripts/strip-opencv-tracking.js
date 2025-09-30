const fs = require('fs');
const path = require('path');

const baseDir = process.argv[2] || process.cwd();

function resolveModuleRoot() {
  try {
    const packagePath = require.resolve('@u4/opencv4nodejs/package.json', { paths: [baseDir] });
    return path.dirname(packagePath);
  } catch (error) {
    const fallback = path.join(baseDir, 'node_modules/@u4/opencv4nodejs');
    if (fs.existsSync(fallback)) {
      return fallback;
    }
    console.warn(`@u4/opencv4nodejs not found from base directory: ${baseDir}; skipping tracking strip.`);
    return null;
  }
}

const moduleRoot = resolveModuleRoot();
if (!moduleRoot) {
  process.exit(0);
}
const bindingPath = path.join(moduleRoot, 'binding.gyp');
const modulesPath = path.join(moduleRoot, 'cc/opencv_modules.h');
const mainPath = path.join(moduleRoot, 'cc/opencv4nodejs.cc');

function patchModulesHeader() {
  if (!fs.existsSync(modulesPath)) {
    return;
  }
  const trackingBlock = /#ifdef OPENCV4NODEJS_FOUND_LIBRARY_TRACKING[\s\S]*?#endif\r?\n/;
  let content = fs.readFileSync(modulesPath, 'utf8');
  content = content.replace(trackingBlock, '');
  fs.writeFileSync(modulesPath, content);
}

function patchMainBinding() {
  if (!fs.existsSync(mainPath)) {
    return;
  }
  let content = fs.readFileSync(mainPath, 'utf8');
  const includeBlock = /#ifdef HAVE_OPENCV_TRACKING[\s\S]*?#endif\r?\n/;
  content = content.replace(includeBlock, '');
  const initBlock = /#ifdef HAVE_OPENCV_TRACKING[\s\S]*?#endif\r?\n/g;
  content = content.replace(initBlock, '');
  fs.writeFileSync(mainPath, content);
}

function patchBindingGyp() {
  if (!fs.existsSync(bindingPath)) {
    console.warn(`binding.gyp not found at ${bindingPath}; skipping tracking strip.`);
    return;
  }
  const filtered = fs
    .readFileSync(bindingPath, 'utf8')
    .split('\n')
    .filter(line => !line.includes('cc/tracking/'))
    .join('\n');
  fs.writeFileSync(bindingPath, filtered);
}

patchModulesHeader();
patchMainBinding();
patchBindingGyp();
