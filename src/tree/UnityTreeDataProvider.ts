import * as vscode from 'vscode';
import * as path from 'path';
import { UnityTreeItem, UnityItemType } from './UnityTreeItem';
import { PackageManager } from '../packages/PackageManager';
import { ScopeResolver } from '../search/ScopeResolver';

export type ViewMode = 'unity' | 'solution' | 'allFiles';

export class UnityTreeDataProvider implements vscode.TreeDataProvider<UnityTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<UnityTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<UnityTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<UnityTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private refreshDebounceTimer?: NodeJS.Timeout;
  
  private viewMode: ViewMode = 'unity';

  private showMetaFiles: boolean = false;
  private showLogs: boolean = false;
  private showLibrary: boolean = false;
  private showTemp: boolean = false;
  private showPackages: boolean = true;
  private showProjectSettings: boolean = true;

  constructor(
    private readonly workspaceRoot: string,
    private readonly packageManager: PackageManager,
    private readonly scopeResolver?: ScopeResolver
  ) {
    this.loadConfiguration();
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('unityExplorer')) {
        this.loadConfiguration();
        this.refresh();
      }
    });
  }

  public setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.refresh();
  }

  public getViewMode(): ViewMode {
    return this.viewMode;
  }

  public getExcludedPatterns(): string[] {
    const excluded: string[] = ['**/.git/**', '**/obj/**', '**/bin/**'];
    if (!this.showMetaFiles) excluded.push('**/*.meta');
    if (!this.showLibrary) excluded.push('**/Library/**');
    if (!this.showTemp) excluded.push('**/Temp/**');
    if (!this.showLogs) excluded.push('**/Logs/**');
    return excluded;
  }

  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('unityExplorer');
    this.showMetaFiles = config.get<boolean>('showMetaFiles', false);
    this.showLogs = config.get<boolean>('showLogs', false);
    this.showLibrary = config.get<boolean>('showLibrary', false);
    this.showTemp = config.get<boolean>('showTemp', false);
    this.showPackages = config.get<boolean>('showPackages', true);
    this.showProjectSettings = config.get<boolean>('showProjectSettings', true);
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

    // ═══ MODE: SOLUTION VIEW ═══
    if (this.viewMode === 'solution') {
      return this.getSolutionChildren(element);
    }

    // ═══ MODE: ALL FILES VIEW ═══
    if (this.viewMode === 'allFiles') {
      return this.getAllFilesChildren(element);
    }

    // ═══ MODE: UNITY VIEW (Default) ═══
    return this.getUnityViewChildren(element);
  }

  // ─── Unity View Mode ───
  private async getUnityViewChildren(element?: UnityTreeItem): Promise<UnityTreeItem[]> {
    if (!element) {
      const items: UnityTreeItem[] = [];
      
      const assetsUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Assets'));
      try {
        await vscode.workspace.fs.stat(assetsUri);
        items.push(new UnityTreeItem('Assets', assetsUri, 'assetsRoot', vscode.TreeItemCollapsibleState.Expanded));
      } catch {}

      if (this.showPackages) {
        const packagesUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Packages'));
        items.push(new UnityTreeItem('Packages', packagesUri, 'packageRoot', vscode.TreeItemCollapsibleState.Collapsed));
      }

      if (this.showProjectSettings) {
        const settingsUri = vscode.Uri.file(path.join(this.workspaceRoot, 'ProjectSettings'));
        try {
          await vscode.workspace.fs.stat(settingsUri);
          items.push(new UnityTreeItem('ProjectSettings', settingsUri, 'projectSettingsRoot', vscode.TreeItemCollapsibleState.Collapsed));
        } catch {}
      }

      if (this.showLibrary) {
        const libraryUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Library'));
        try {
          await vscode.workspace.fs.stat(libraryUri);
          items.push(new UnityTreeItem('Library', libraryUri, 'folder', vscode.TreeItemCollapsibleState.Collapsed));
        } catch {}
      }

      if (this.showLogs) {
        const logsUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Logs'));
        try {
          await vscode.workspace.fs.stat(logsUri);
          items.push(new UnityTreeItem('Logs', logsUri, 'folder', vscode.TreeItemCollapsibleState.Collapsed));
        } catch {}
      }

      if (this.showTemp) {
        const tempUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Temp'));
        try {
          await vscode.workspace.fs.stat(tempUri);
          items.push(new UnityTreeItem('Temp', tempUri, 'folder', vscode.TreeItemCollapsibleState.Collapsed));
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

  // ─── Solution View Mode ───
  private async getSolutionChildren(element?: UnityTreeItem): Promise<UnityTreeItem[]> {
    if (!element) {
      if (!this.scopeResolver) {
        return [new UnityTreeItem('Assembly-CSharp', vscode.Uri.file(path.join(this.workspaceRoot, 'Assets')), 'folder', vscode.TreeItemCollapsibleState.Expanded)];
      }

      const projects = this.scopeResolver.getProjects();
      return projects.map(proj => {
        const item = new UnityTreeItem(
          `${proj.name}${proj.isEditorOnly ? ' (Editor)' : ''}`,
          vscode.Uri.file(proj.rootDirectory),
          'folder',
          vscode.TreeItemCollapsibleState.Collapsed
        );
        item.tooltip = `C# Assembly (${proj.type}): ${proj.name}`;
        item.contextValue = 'solutionAssembly';
        return item;
      });
    }

    // List files belonging to the clicked project/assembly
    if (element.contextValue === 'solutionAssembly' && this.scopeResolver) {
      const projects = this.scopeResolver.getProjects();
      const projName = element.label.replace(' (Editor)', '');
      const proj = projects.find(p => p.name === projName);

      if (!proj) return [];

      const items: UnityTreeItem[] = [];
      for (const filePath of proj.filePaths) {
        const rel = path.relative(this.workspaceRoot, filePath);
        const item = new UnityTreeItem(
          path.basename(filePath),
          vscode.Uri.file(filePath),
          'asset',
          vscode.TreeItemCollapsibleState.None
        );
        item.description = rel;
        items.push(item);
      }

      return items.sort((a, b) => a.label.localeCompare(b.label));
    }

    return this.getDirectoryChildren(element.uri, element.isReadOnly);
  }

  // ─── All Files View Mode ───
  private async getAllFilesChildren(element?: UnityTreeItem): Promise<UnityTreeItem[]> {
    const parentUri = element ? element.uri : vscode.Uri.file(this.workspaceRoot);
    try {
      const entries = await vscode.workspace.fs.readDirectory(parentUri);
      const items: UnityTreeItem[] = [];

      for (const [name, fileType] of entries) {
        const childUri = vscode.Uri.file(path.join(parentUri.fsPath, name));
        const isDirectory = fileType === vscode.FileType.Directory;

        items.push(new UnityTreeItem(
          name,
          childUri,
          isDirectory ? 'folder' : 'asset',
          isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
        ));
      }

      return items.sort((a, b) => {
        const aIsDir = a.collapsibleState !== vscode.TreeItemCollapsibleState.None;
        const bIsDir = b.collapsibleState !== vscode.TreeItemCollapsibleState.None;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
      });
    } catch {
      return [];
    }
  }

  // ─── Directory Children Traversal ───
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
    if (name.endsWith('.meta')) {
      return !this.showMetaFiles;
    }
    if (name === 'Library') {
      return !this.showLibrary;
    }
    if (name === 'Logs') {
      return !this.showLogs;
    }
    if (name === 'Temp') {
      return !this.showTemp;
    }
    if (name.startsWith('.') && name !== '.gitignore') {
      return true;
    }
    return ['obj', 'bin'].includes(name);
  }
}
