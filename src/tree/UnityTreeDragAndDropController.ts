import * as vscode from 'vscode';
import * as path from 'path';
import { UnityTreeItem } from './UnityTreeItem';
import { MetaSyncEngine } from '../sync/MetaSyncEngine';

export class UnityTreeDragAndDropController implements vscode.TreeDragAndDropController<UnityTreeItem> {
  readonly dropMimeTypes = ['application/vnd.code.tree.unityExplorer', 'text/uri-list'];
  readonly dragMimeTypes = ['application/vnd.code.tree.unityExplorer'];

  constructor(private readonly metaSyncEngine: MetaSyncEngine) {}

  public async handleDrag(
    source: readonly UnityTreeItem[],
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    const validSources = source.filter(s => !s.isReadOnly && s.itemType !== 'packageRoot');
    if (validSources.length === 0) return;

    const uris = validSources.map(s => s.uri.toString());
    dataTransfer.set(
      'application/vnd.code.tree.unityExplorer',
      new vscode.DataTransferItem(uris)
    );
  }

  public async handleDrop(
    target: UnityTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    const item = dataTransfer.get('application/vnd.code.tree.unityExplorer');
    if (!item) return;

    const sourceUriStrings: string[] = item.value;
    const sourceUris = sourceUriStrings.map(u => vscode.Uri.parse(u));

    if (!target) {
      return;
    }

    if (target.isReadOnly) {
      vscode.window.showWarningMessage('Cannot drop assets into read-only Package directories.');
      return;
    }

    let targetDirUri: vscode.Uri;
    if (target.itemType === 'folder' || target.itemType === 'assetsRoot' || target.itemType === 'packageRoot') {
      targetDirUri = target.uri;
    } else {
      targetDirUri = vscode.Uri.file(path.dirname(target.uri.fsPath));
    }

    try {
      await this.metaSyncEngine.moveAssets(sourceUris, targetDirUri);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Drag & Drop failed: ${err.message}`);
    }
  }
}
