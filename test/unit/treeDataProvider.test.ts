import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UnityTreeDataProvider } from '../../src/tree/UnityTreeDataProvider';
import { PackageManager } from '../../src/packages/PackageManager';

describe('UnityTreeDataProvider Unit Tests', () => {
  let tmpDir: string;
  let pm: PackageManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unity-provider-test-'));
    pm = new PackageManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should exclude .meta files by default', () => {
    const provider = new UnityTreeDataProvider(tmpDir, pm);
    expect(provider.isExcluded('Player.cs.meta')).toBe(true);
  });

  it('should exclude Logs, Library, and Temp folders by default', () => {
    const provider = new UnityTreeDataProvider(tmpDir, pm);
    expect(provider.isExcluded('Logs')).toBe(true);
    expect(provider.isExcluded('Library')).toBe(true);
    expect(provider.isExcluded('Temp')).toBe(true);
  });

  it('should exclude obj and bin directories', () => {
    const provider = new UnityTreeDataProvider(tmpDir, pm);
    expect(provider.isExcluded('obj')).toBe(true);
    expect(provider.isExcluded('bin')).toBe(true);
  });
});
