import * as path from 'path';
import * as fs from 'fs';

export function normalizePath(p: string): string {
  const normalized = path.normalize(p).replace(/\\/g, '/');
  return process.platform === 'win32' || process.platform === 'darwin'
    ? normalized.toLowerCase()
    : normalized;
}

export function getCanonicalPath(filePath: string): string {
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

export function isPathReadOnly(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/Library/PackageCache/')) {
    return true;
  }
  try {
    fs.accessSync(filePath, fs.constants.W_OK);
    return false;
  } catch {
    return true;
  }
}
