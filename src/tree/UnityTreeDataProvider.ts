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
  private showMetaFiles: boolean = false;
  private showLogs: boolean = false;
  private showLibrary: boolean = false;
  private showTemp: boolean = false;
  private showPackages: boolean = true;
  private showProjectSettings: boolean = true;
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

  public loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('unityExplorer');
    this.showMetaFiles = config.get<boolean>('showMetaFiles', false);
    this.showLogs = config.get<boolean>('showLogs', false);
    this.showLibrary = config.get<boolean>('showLibrary', false);
    this.showTemp = config.get<boolean>('showTemp', false);
    this.showPackages = config.get<boolean>('showPackages', true);
    this.showProjectSettings = config.get<boolean>('showProjectSettings', true);
    this.excludedPatterns = config.get<string[]>('excludedPatterns', [
      '**/.git/**', 
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

    if (!element) {
      const items: UnityTreeItem[] = [];
      
      const assetsUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Assets'));
      try {
        await vscode.workspace.fs.stat(assetsUri);
        items.push(new UnityTreeItem(
          'Assets',
          assetsUri,
          'assetsRoot',
          vscode.TreeItemCollapsibleState.Expanded
        ));
      } catch {}

      if (this.showPackages) {
        const packagesUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Packages'));
        items.push(new UnityTreeItem(
          'Packages',
          packagesUri,
          'packageRoot',
          vscode.TreeItemCollapsibleState.Collapsed
        ));
      }

      if (this.showProjectSettings) {
        const settingsUri = vscode.Uri.file(path.join(this.workspaceRoot, 'ProjectSettings'));
        try {
          await vscode.workspace.fs.stat(settingsUri);
          items.push(new UnityTreeItem(
            'ProjectSettings',
            settingsUri,
            'projectSettingsRoot',
            vscode.TreeItemCollapsibleState.Collapsed
          ));
        } catch {}
      }

      if (this.showLogs) {
        const logsUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Logs'));
        try {
          await vscode.workspace.fs.stat(logsUri);
          items.push(new UnityTreeItem(
            'Logs',
            logsUri,
            'logsRoot',
            vscode.TreeItemCollapsibleState.Collapsed
          ));
        } catch {}
      }

      if (this.showLibrary) {
        const libraryUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Library'));
        try {
          await vscode.workspace.fs.stat(libraryUri);
          items.push(new UnityTreeItem(
            'Library',
            libraryUri,
            'libraryRoot',
            vscode.TreeItemCollapsibleState.Collapsed
          ));
        } catch {}
      }

      if (this.showTemp) {
        const tempUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Temp'));
        try {
          await vscode.workspace.fs.stat(tempUri);
          items.push(new UnityTreeItem(
            'Temp',
            tempUri,
            'tempRoot',
            vscode.TreeItemCollapsibleState.Collapsed
          ));
        } catch {}
      }

      return items;
    }

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

    return this.getDirectoryChildren(element.uri, element.isReadOnly);
  }

  private async getDirectoryChildren(parentUri: vscode.Uri, isReadOnly: boolean): Promise<UnityTreeItem[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(parentUri);
      const items: UnityTreeItem[] = [];

      for (const [name, fileType] of entries) {
        if (this.isExcluded(name)) {
          continue;
        }

        const childUri = vscode.Uri.file(path.join(parentUri.fsPath, name));
        const isDirectory = fileType === vscode.FileType.Directory;
        const isMeta = name.endsWith('.meta');

        let itemType: UnityItemType;
        if (isReadOnly) {
          itemType = isDirectory ? 'packageFolder' : 'packageAsset';
        } else if (isDirectory) {
          itemType = 'folder';
        } else if (isMeta) {
          itemType = 'metaFile';
        } else {
          itemType = 'asset';
        }

        items.push(new UnityTreeItem(
          name,
          childUri,
          itemType,
          isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
          isReadOnly
        ));
      }

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

  public isExcluded(name: string): boolean {
    if (name.endsWith('.meta') && !this.showMetaFiles) {
      return true;
    }
    if (name.startsWith('.') && name !== '.gitignore') {
      return true;
    }
    if (name === 'Logs' && !this.showLogs) {
      return true;
    }
    if (name === 'Library' && !this.showLibrary) {
      return true;
    }
    if (name === 'Temp' && !this.showTemp) {
      return true;
    }
    const alwaysIgnored = ['obj', 'bin'];
    return alwaysIgnored.includes(name);
  }
}
