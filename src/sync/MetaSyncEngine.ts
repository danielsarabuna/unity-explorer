import * as vscode from 'vscode';
import * as path from 'path';
import { generateMetaContent } from './GuidGenerator';

export class MetaSyncEngine {
  /**
   * Renames an asset/folder and its corresponding .meta file atomically.
   */
  public async renameAsset(oldUri: vscode.Uri, newName: string): Promise<void> {
    const parentDir = path.dirname(oldUri.fsPath);
    const newUri = vscode.Uri.file(path.join(parentDir, newName));
    
    const oldMetaUri = vscode.Uri.file(`${oldUri.fsPath}.meta`);
    const newMetaUri = vscode.Uri.file(`${newUri.fsPath}.meta`);

    const hasMeta = await this.fileExists(oldMetaUri);

    // 1. Rename primary asset/folder
    await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: false });

    // 2. Rename associated .meta file atomically
    if (hasMeta) {
      try {
        await vscode.workspace.fs.rename(oldMetaUri, newMetaUri, { overwrite: false });
      } catch (err: any) {
        // Rollback primary file rename on meta failure
        await vscode.workspace.fs.rename(newUri, oldUri, { overwrite: true });
        throw new Error(`Failed to rename associated .meta file (${err.message}). Operation rolled back.`);
      }
    } else {
      // Create missing .meta file for renamed asset
      const stat = await vscode.workspace.fs.stat(newUri);
      const isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
      await this.createMetaFile(newUri, isDirectory, newUri.fsPath.endsWith('.cs'));
    }
  }

  /**
   * Moves assets/folders and their corresponding .meta files atomically.
   */
  public async moveAssets(sourceUris: vscode.Uri[], targetDirUri: vscode.Uri): Promise<void> {
    for (const sourceUri of sourceUris) {
      const fileName = path.basename(sourceUri.fsPath);
      const destUri = vscode.Uri.file(path.join(targetDirUri.fsPath, fileName));

      if (sourceUri.fsPath === destUri.fsPath) continue;

      const sourceMetaUri = vscode.Uri.file(`${sourceUri.fsPath}.meta`);
      const destMetaUri = vscode.Uri.file(`${destUri.fsPath}.meta`);

      const hasMeta = await this.fileExists(sourceMetaUri);

      // Move primary asset/folder
      await vscode.workspace.fs.rename(sourceUri, destUri, { overwrite: false });

      // Move associated .meta file
      if (hasMeta) {
        try {
          await vscode.workspace.fs.rename(sourceMetaUri, destMetaUri, { overwrite: false });
        } catch (err: any) {
          // Rollback primary move
          await vscode.workspace.fs.rename(destUri, sourceUri, { overwrite: true });
          throw new Error(`Failed to move .meta file for ${fileName}: ${err.message}. Operation rolled back.`);
        }
      }
    }
  }

  /**
   * Deletes assets/folders and their corresponding .meta files atomically.
   */
  public async deleteAssets(sourceUris: vscode.Uri[], useTrash: boolean = true): Promise<void> {
    for (const uri of sourceUris) {
      const metaUri = vscode.Uri.file(`${uri.fsPath}.meta`);
      const hasMeta = await this.fileExists(metaUri);

      // Delete primary asset/folder
      await vscode.workspace.fs.delete(uri, { recursive: true, useTrash });

      // Delete associated .meta file
      if (hasMeta) {
        try {
          await vscode.workspace.fs.delete(metaUri, { recursive: false, useTrash });
        } catch (err: any) {
          vscode.window.showWarningMessage(`Asset deleted, but failed to delete .meta file: ${err.message}`);
        }
      }
    }
  }

  /**
   * Creates a new asset/folder with guaranteed .meta file creation.
   */
  public async createAsset(
    fileUri: vscode.Uri,
    content: string,
    isFolder: boolean = false,
    isCSharp: boolean = false
  ): Promise<void> {
    if (isFolder) {
      await vscode.workspace.fs.createDirectory(fileUri);
    } else {
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));
    }

    // Always generate valid .meta file immediately
    await this.createMetaFile(fileUri, isFolder, isCSharp);
  }

  public async createMetaFile(assetUri: vscode.Uri, isFolder: boolean, isCSharp: boolean): Promise<void> {
    const metaUri = vscode.Uri.file(`${assetUri.fsPath}.meta`);
    if (await this.fileExists(metaUri)) return;

    const metaContent = generateMetaContent(isFolder, isCSharp);
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(metaUri, encoder.encode(metaContent));
  }

  public async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }
}
