import * as vscode from 'vscode';
import * as path from 'path';
import { UnityTreeItem, UnityItemType } from './UnityTreeItem';
import { PackageManager } from '../packages/PackageManager';

export class UnityTreeDataProvider implements vscode.TreeDataProvider<UnityTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<UnityTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<UnityTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<UnityTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private refreshDebounceTimer?: NodeJS.Timeout;
  private excludedPatterns: string[] = [];

  constructor(
    private readonly workspaceRoot: string,
    private readonly packageManager: PackageManager
  ) {
    this.loadConfiguration();
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('unityExplorer')) {
        this.loadConfiguration();
        this.refresh();
      }
    });
  }

  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('unityExplorer');
    this.excludedPatterns = config.get<string[]>('excludedPatterns', [
      '**/*.meta', 
      '**/.git/**', 
      '**/Library/**', 
      '**/Temp/**',
      '**/Logs/**',
      '**/obj/**',
      '**/bin/**'
    ]);
  }

  public refresh(item?: UnityTreeItem): void {
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
    }
    this.refreshDebounceTimer = setTimeout(() => {
      this._onDidChangeTreeData.fire(item);
    }, 150);
  }

  getTreeItem(element: UnityTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: UnityTreeItem): Promise<UnityTreeItem[]> {
    if (!this.workspaceRoot) {
      return [];
    }

    // Root nodes: Assets directory + Packages + ProjectSettings
    if (!element) {
      const items: UnityTreeItem[] = [];
      
      // 1. Assets Folder
      const assetsUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Assets'));
      try {
        await vscode.workspace.fs.stat(assetsUri);
        items.push(new UnityTreeItem(
          'Assets',
          assetsUri,
          'assetsRoot',
          vscode.TreeItemCollapsibleState.Expanded
        ));
      } catch {
        // Assets folder missing
      }

      // 2. Packages Folder
      const config = vscode.workspace.getConfiguration('unityExplorer');
      if (config.get<boolean>('showPackages', true)) {
        const packagesUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Packages'));
        items.push(new UnityTreeItem(
          'Packages',
          packagesUri,
          'packageRoot',
          vscode.TreeItemCollapsibleState.Collapsed
        ));
      }

      // 3. ProjectSettings Folder
      if (config.get<boolean>('showProjectSettings', true)) {
        const settingsUri = vscode.Uri.file(path.join(this.workspaceRoot, 'ProjectSettings'));
        try {
          await vscode.workspace.fs.stat(settingsUri);
          items.push(new UnityTreeItem(
            'ProjectSettings',
            settingsUri,
            'projectSettingsRoot',
            vscode.TreeItemCollapsibleState.Collapsed
          ));
        } catch {
          // ProjectSettings missing
        }
      }

      return items;
    }

    // Virtual Packages Root
    if (element.itemType === 'packageRoot') {
      const packages = await this.packageManager.getResolvedPackages();
      return packages.map(pkg => new UnityTreeItem(
        `${pkg.name} @ ${pkg.version}`,
        pkg.rootUri,
        'package',
        vscode.TreeItemCollapsibleState.Collapsed,
        true,
        { name: pkg.name, version: pkg.version, sourceType: pkg.sourceType }
      ));
    }

    // Directory Children Traversal
    return this.getDirectoryChildren(element.uri, element.isReadOnly);
  }

  private async getDirectoryChildren(parentUri: vscode.Uri, isReadOnly: boolean): Promise<UnityTreeItem[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(parentUri);
      const items: UnityTreeItem[] = [];

      for (const [name, fileType] of entries) {
        // Skip .meta files and matches against excluded names
        if (name.endsWith('.meta') || this.isExcluded(name)) {
          continue;
        }

        const childUri = vscode.Uri.file(path.join(parentUri.fsPath, name));
        const isDirectory = fileType === vscode.FileType.Directory;
        const itemType: UnityItemType = isReadOnly 
          ? (isDirectory ? 'packageFolder' : 'packageAsset') 
          : (isDirectory ? 'folder' : 'asset');

        items.push(new UnityTreeItem(
          name,
          childUri,
          itemType,
          isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
          isReadOnly
        ));
      }

      // Sort: Folders first, then assets alphabetically
      return items.sort((a, b) => {
        const aIsDir = a.collapsibleState !== vscode.TreeItemCollapsibleState.None;
        const bIsDir = b.collapsibleState !== vscode.TreeItemCollapsibleState.None;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
      });
    } catch (err) {
      return [];
    }
  }

  private isExcluded(name: string): boolean {
    if (name.startsWith('.') && name !== '.gitignore') {
      return true;
    }
    const ignoredNames = ['Library', 'Temp', 'Logs', 'obj', 'bin'];
    return ignoredNames.includes(name);
  }
}
