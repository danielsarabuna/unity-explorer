import { describe, it, expect } from 'vitest';
import { normalizePath, isPathReadOnly } from '../../src/utils/pathUtils';

describe('Path Utilities Unit Tests', () => {
  it('should normalize slashes and casing appropriately', () => {
    const rawPath = 'C:\\Project\\Assets\\Scripts\\Player.cs';
    const normalized = normalizePath(rawPath);
    expect(normalized).not.toContain('\\');
  });

  it('should detect PackageCache paths as read-only', () => {
    const pkgPath = '/Project/Library/PackageCache/com.unity.render-pipelines.universal@14.0.8/README.md';
    expect(isPathReadOnly(pkgPath)).toBe(true);
  });
});
