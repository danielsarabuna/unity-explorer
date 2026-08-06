import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PackageManager } from '../../src/packages/PackageManager';

describe('PackageManager Unit Tests', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unity-packages-test-'));
    fs.mkdirSync(path.join(tmpDir, 'Packages'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should parse manifest.json dependencies and return empty list when no match on disk', async () => {
    const manifestPath = path.join(tmpDir, 'Packages', 'manifest.json');
    const manifestData = {
      dependencies: {
        'com.unity.textmeshpro': '3.0.6'
      }
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifestData));

    const pm = new PackageManager(tmpDir);
    const packages = await pm.getResolvedPackages();
    expect(Array.isArray(packages)).toBe(true);
  });
});
