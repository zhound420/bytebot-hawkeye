const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const repoConfigPath = path.join(
  repoRoot,
  'config',
  'universal-coordinates.yaml',
);
const distConfigDir = path.resolve(__dirname, '..', 'dist', 'config');
const distConfigPath = path.join(distConfigDir, 'universal-coordinates.yaml');

if (!fs.existsSync(repoConfigPath)) {
  throw new Error(
    `Expected universal coordinate config at ${repoConfigPath} but the file is missing.`,
  );
}

fs.mkdirSync(distConfigDir, { recursive: true });
fs.copyFileSync(repoConfigPath, distConfigPath);
