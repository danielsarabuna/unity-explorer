import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { generateUnityGuid, generateMetaContent } from '../../src/sync/GuidGenerator';

describe('MetaSyncEngine Unit Tests', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unity-explorer-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate valid 32-character hex GUIDs', () => {
    const guid = generateUnityGuid();
    expect(guid).toHaveLength(32);
    expect(guid).toMatch(/^[a-f0-9]{32}$/);
  });

  it('should generate valid folder .meta file content', () => {
    const metaContent = generateMetaContent(true, false);
    expect(metaContent).toContain('fileFormatVersion: 2');
    expect(metaContent).toContain('folderAsset: yes');
    expect(metaContent).toMatch(/guid: [a-f0-9]{32}/);
  });

  it('should generate valid C# script .meta file content', () => {
    const metaContent = generateMetaContent(false, true);
    expect(metaContent).toContain('fileFormatVersion: 2');
    expect(metaContent).toContain('MonoImporter:');
    expect(metaContent).toMatch(/guid: [a-f0-9]{32}/);
  });
});
