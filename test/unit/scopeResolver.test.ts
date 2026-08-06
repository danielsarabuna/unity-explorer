import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { ScopeResolver } from '../../src/search/ScopeResolver';

describe('ScopeResolver', () => {
  const dummyRoot = path.join(__dirname, 'dummy_workspace');

  beforeEach(() => {
    if (!fs.existsSync(dummyRoot)) {
      fs.mkdirSync(dummyRoot, { recursive: true });
    }
  });

  it('provides predefined scopes', () => {
    const resolver = new ScopeResolver(dummyRoot);
    const scopes = resolver.getAvailableScopes();
    expect(scopes.length).toBeGreaterThan(0);
    expect(scopes.map(s => s.name)).toContain('Assets only');
    expect(scopes.map(s => s.name)).toContain('Editor scripts');
    expect(scopes.map(s => s.name)).toContain('Runtime scripts');
    expect(scopes.map(s => s.name)).toContain('Tests');
  });

  it('matches scope patterns correctly', () => {
    const resolver = new ScopeResolver(dummyRoot);
    const editorFile = path.join(dummyRoot, 'Assets/Scripts/Editor/CustomEditor.cs');
    const runtimeFile = path.join(dummyRoot, 'Assets/Scripts/Player/PlayerController.cs');

    expect(resolver.matchesScope(editorFile, 'Editor scripts')).toBe(true);
    expect(resolver.matchesScope(runtimeFile, 'Editor scripts')).toBe(false);
    expect(resolver.matchesScope(runtimeFile, 'Runtime scripts')).toBe(true);
  });

  it('resolves default Assembly-CSharp vs Assembly-CSharp-Editor', () => {
    const resolver = new ScopeResolver(dummyRoot);
    const runtimeFile = path.join(dummyRoot, 'Assets/Scripts/Player.cs');
    const editorFile = path.join(dummyRoot, 'Assets/Scripts/Editor/PlayerEditor.cs');

    const runtimeProj = resolver.resolveFileProject(runtimeFile);
    const editorProj = resolver.resolveFileProject(editorFile);

    expect(runtimeProj.name).toBe('Assembly-CSharp');
    expect(editorProj.name).toBe('Assembly-CSharp-Editor');
  });
});
