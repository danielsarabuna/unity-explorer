import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export async function detectAndSetUnityContext(workspaceRoot: string): Promise<boolean> {
  const hasAssets = fs.existsSync(path.join(workspaceRoot, 'Assets'));
  const hasSettings = fs.existsSync(path.join(workspaceRoot, 'ProjectSettings'));
  const isUnity = hasAssets || hasSettings;

  await vscode.commands.executeCommand('setContext', 'unityExplorer:isUnityProject', isUnity);
  return isUnity;
}
