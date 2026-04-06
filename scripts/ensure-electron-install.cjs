const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function resolveElectronPaths() {
  const electronPackageJson = require.resolve('electron/package.json');
  const electronDir = path.dirname(electronPackageJson);
  const pathFile = path.join(electronDir, 'path.txt');

  return {
    electronDir,
    installScript: path.join(electronDir, 'install.js'),
    pathFile
  };
}

function getInstalledBinary(electronDir, pathFile) {
  if (!fs.existsSync(pathFile)) {
    return null;
  }

  const relativeBinaryPath = fs.readFileSync(pathFile, 'utf8').trim();
  if (!relativeBinaryPath) {
    return null;
  }

  const binaryPath = path.join(electronDir, 'dist', relativeBinaryPath);
  return fs.existsSync(binaryPath) ? binaryPath : null;
}

function ensureElectronInstall() {
  const { electronDir, installScript, pathFile } = resolveElectronPaths();
  const binaryPath = getInstalledBinary(electronDir, pathFile);

  if (binaryPath) {
    return;
  }

  console.log('[ensure:electron] Electron binary is missing. Repairing local install...');

  const result = spawnSync(process.execPath, [installScript], {
    cwd: electronDir,
    stdio: 'inherit',
    env: process.env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (!getInstalledBinary(electronDir, pathFile)) {
    console.error('[ensure:electron] Electron install completed, but no executable was found.');
    process.exit(1);
  }
}

ensureElectronInstall();
