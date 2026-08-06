import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Unity Explorer Integration Test Suite', () => {
  vscode.window.showInformationMessage('Starting Unity Explorer integration tests...');

  test('Extension activation test', async () => {
    const ext = vscode.extensions.getExtension('antigravity.unity-explorer');
    if (ext) {
      await ext.activate();
      assert.strictEqual(ext.isActive, true);
    }
  });

  test('Registered commands test', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('unityExplorer.refresh'));
    assert.ok(commands.includes('unityExplorer.createScript'));
    assert.ok(commands.includes('unityExplorer.rename'));
    assert.ok(commands.includes('unityExplorer.delete'));
    assert.ok(commands.includes('unityExplorer.switchViewMode'));
  });
});
