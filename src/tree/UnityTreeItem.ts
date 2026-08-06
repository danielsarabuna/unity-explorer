import * as vscode from 'vscode';
import * as path from 'path';

export type UnityItemType = 
  | 'assetsRoot'
  | 'folder' 
  | 'asset' 
  | 'packageRoot' 
  | 'package' 
  | 'packageAsset' 
  | 'packageFolder'
  | 'projectSettingsRoot';

export interface PackageMetaInfo {
  name: string;
  version: string;
  sourceType: 'registry' | 'local' | 'git' | 'tarball' | 'embedded';
}

export class UnityTreeItem extends vscode.TreeItem {
  public readonly metaUri?: vscode.Uri;

  constructor(
    public readonly label: string,
    public readonly uri: vscode.Uri,
    public readonly itemType: UnityItemType,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly isReadOnly: boolean = false,
    public readonly packageInfo?: PackageMetaInfo
  ) {
    super(label, collapsibleState);
    
    this.resourceUri = uri;
    this.tooltip = `${uri.fsPath}${isReadOnly ? ' (Read-Only Package Asset)' : ''}`;
    
    if (itemType === 'asset' || itemType === 'folder') {
      this.metaUri = vscode.Uri.file(`${uri.fsPath}.meta`);
    }

    this.contextValue = this.deriveContextValue();
    this.iconPath = this.deriveIcon();
    
    if (!isReadOnly && (itemType === 'asset' || itemType === 'packageAsset')) {
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [uri]
      };
    }
  }

  private deriveContextValue(): string {
    if (this.isReadOnly) {
      return this.itemType === 'package' ? 'unityPackageReadOnly' : 'unityAssetReadOnly';
    }
    switch (this.itemType) {
      case 'assetsRoot': return 'unityAssetsRoot';
      case 'folder': return 'unityFolder';
      case 'asset': return 'unityAsset';
      case 'packageRoot': return 'unityPackageRoot';
      case 'package': return 'unityPackage';
      case 'projectSettingsRoot': return 'unityProjectSettingsRoot';
      default: return 'unityAsset';
    }
  }

  private deriveIcon(): vscode.ThemeIcon {
    if (this.itemType === 'assetsRoot') {
      return new vscode.ThemeIcon('root-folder');
    }
    if (this.itemType === 'packageRoot') {
      return new vscode.ThemeIcon('archive');
    }
    if (this.itemType === 'projectSettingsRoot') {
      return new vscode.ThemeIcon('settings-gear');
    }
    if (this.itemType === 'package') {
      return new vscode.ThemeIcon('package');
    }
    if (this.itemType === 'folder' || this.itemType === 'packageFolder') {
      const folderName = path.basename(this.uri.fsPath).toLowerCase();
      if (folderName === 'editor') return new vscode.ThemeIcon('tools');
      if (folderName === 'resources') return new vscode.ThemeIcon('database');
      if (folderName === 'plugins') return new vscode.ThemeIcon('plug');
      return vscode.ThemeIcon.Folder;
    }

    const ext = path.extname(this.uri.fsPath).toLowerCase();
    switch (ext) {
      case '.cs': return new vscode.ThemeIcon('symbol-class');
      case '.prefab': return new vscode.ThemeIcon('symbol-structure');
      case '.mat': return new vscode.ThemeIcon('symbol-color');
      case '.unity': return new vscode.ThemeIcon('symbol-event');
      case '.shader': 
      case '.shadergraph': return new vscode.ThemeIcon('symbol-misc');
      case '.anim': return new vscode.ThemeIcon('symbol-key');
      case '.controller': return new vscode.ThemeIcon('circuit-board');
      case '.asmdef': return new vscode.ThemeIcon('extensions');
      case '.png': 
      case '.jpg': 
      case '.psd': 
      case '.tga': return new vscode.ThemeIcon('file-media');
      case '.mp3': 
      case '.wav': 
      case '.ogg': return new vscode.ThemeIcon('device-camera-video');
      case '.json': 
      case '.asset': return new vscode.ThemeIcon('json');
      default: return vscode.ThemeIcon.File;
    }
  }
}
