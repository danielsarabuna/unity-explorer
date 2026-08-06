import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileEntry } from './SymbolTypes';
import { normalizePath } from '../utils/pathUtils';

export class FileIndexer implements vscode.Disposable {
  private fileIndex: Map<string, FileEntry> = new Map();

  constructor(
    private readonly workspaceRoot: string,
    private readonly excludedPatterns: string[]
  ) {}

  public async buildIndex(includePackages: boolean): Promise<void> {
    this.fileIndex.clear();
    if (!this.workspaceRoot) return;

    let files: vscode.Uri[] = [];
    try {
      const globPattern = includePackages ? '{Assets,Packages}/**/*' : 'Assets/**/*';
      const excludePattern = '{**/Library/**,**/Temp/**,**/Logs/**,**/obj/**,**/bin/**}';
      files = await vscode.workspace.findFiles(globPattern, excludePattern);
    } catch {
      // Fallback for tests
      files = this.findFilesRecursive(path.join(this.workspaceRoot, 'Assets'));
      if (includePackages) {
        files.push(...this.findFilesRecursive(path.join(this.workspaceRoot, 'Packages')));
      }
    }

    for (const uri of files) {
      this.addFile(uri);
    }
  }

  public addFile(uri: vscode.Uri): void {
    const normalized = normalizePath(uri.fsPath);
    if (normalized.endsWith('.meta')) return;

    const relPath = normalizePath(path.relative(this.workspaceRoot, uri.fsPath));
    const fileName = path.basename(uri.fsPath);
    const ext = path.extname(uri.fsPath).toLowerCase();
    const isReadOnly = normalized.includes('/library/packagecache/');

    this.fileIndex.set(normalized, {
      absolutePath: uri.fsPath,
      relativePath: relPath,
      fileName,
      extension: ext,
      isReadOnly
    });
  }

  public removeFile(uri: vscode.Uri): void {
    const normalized = normalizePath(uri.fsPath);
    this.fileIndex.delete(normalized);
  }

  public getAllFiles(): FileEntry[] {
    return Array.from(this.fileIndex.values());
  }

  public getStats(): { totalFiles: number } {
    return { totalFiles: this.fileIndex.size };
  }

  private findFilesRecursive(dir: string): vscode.Uri[] {
    const results: vscode.Uri[] = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['Library', 'Temp', 'Logs', 'obj', 'bin'].includes(entry.name)) {
          results.push(...this.findFilesRecursive(fullPath));
        }
      } else if (entry.isFile() && !entry.name.endsWith('.meta')) {
        results.push(vscode.Uri.file(fullPath));
      }
    }

    return results;
  }

  public dispose(): void {
    this.fileIndex.clear();
  }
}
