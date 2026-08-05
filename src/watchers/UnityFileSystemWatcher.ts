import * as vscode from 'vscode';
import { UnityTreeDataProvider } from '../tree/UnityTreeDataProvider';

export function setupFileSystemWatcher(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  treeDataProvider: UnityTreeDataProvider
): void {
  const pattern = new vscode.RelativePattern(workspaceRoot, '{Assets,Packages,ProjectSettings,Logs,Library,Temp}/**/*');
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  const triggerRefresh = () => treeDataProvider.refresh();

  watcher.onDidCreate(triggerRefresh);
  watcher.onDidChange(triggerRefresh);
  watcher.onDidDelete(triggerRefresh);

  context.subscriptions.push(watcher);
}
