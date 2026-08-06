import * as vscode from 'vscode';
import { UnityTreeDataProvider } from '../tree/UnityTreeDataProvider';

export function setupFileSystemWatcher(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  treeDataProvider: UnityTreeDataProvider
): void {
  const pattern = new vscode.RelativePattern(workspaceRoot, '{Assets,Packages,ProjectSettings}/**/*');
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  const triggerRefresh = () => treeDataProvider.refresh();

  watcher.onDidCreate(triggerRefresh);
  watcher.onDidChange(triggerRefresh);
  watcher.onDidDelete(triggerRefresh);

  context.subscriptions.push(watcher);
}

export function setupSearchIndexWatcher(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  symbolIndexer: any,
  fileIndexer: any
): void {
  const pattern = new vscode.RelativePattern(workspaceRoot, '{Assets,Packages}/**/*');
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  let debounceTimer: NodeJS.Timeout | undefined;
  const debouncedReindex = (uri: vscode.Uri) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (uri.fsPath.endsWith('.cs')) {
        symbolIndexer.reindexFile(uri);
      }
      fileIndexer.addFile(uri);
    }, 300);
  };

  watcher.onDidCreate((uri) => {
    debouncedReindex(uri);
  });

  watcher.onDidChange((uri) => {
    debouncedReindex(uri);
  });

  watcher.onDidDelete((uri) => {
    if (uri.fsPath.endsWith('.cs')) {
      symbolIndexer.removeFile(uri);
    }
    fileIndexer.removeFile(uri);
  });

  context.subscriptions.push(watcher);
}

