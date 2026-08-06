import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectInfo, ScopeDefinition } from './SymbolTypes';
import { normalizePath } from '../utils/pathUtils';

export class ScopeResolver implements vscode.Disposable {
  private projects: Map<string, ProjectInfo> = new Map();
  private fileToProjectMap: Map<string, ProjectInfo> = new Map();
  private predefinedScopes: ScopeDefinition[] = [];

  constructor(private readonly workspaceRoot: string) {
    this.initPredefinedScopes();
  }

  private initPredefinedScopes(): void {
    this.predefinedScopes = [
      {
        name: 'Assets only',
        includePatterns: ['Assets/**/*'],
        excludePatterns: [],
        description: 'All files within the Assets folder'
      },
      {
        name: 'Editor scripts',
        includePatterns: ['**/Editor/**/*', '**/*Editor*'],
        excludePatterns: [],
        description: 'Editor-only scripts and tools'
      },
      {
        name: 'Runtime scripts',
        includePatterns: ['Assets/**/*.cs'],
        excludePatterns: ['**/Editor/**/*', '**/Tests/**/*', '**/Test/**/*'],
        description: 'Game runtime C# scripts (excluding Editor and Tests)'
      },
      {
        name: 'Tests',
        includePatterns: ['**/Tests/**/*', '**/Test/**/*'],
        excludePatterns: [],
        description: 'Unit and integration test scripts'
      },
      {
        name: 'Plugins',
        includePatterns: ['Assets/Plugins/**/*'],
        excludePatterns: [],
        description: 'Third-party plugins and native libraries'
      },
      {
        name: 'Packages',
        includePatterns: ['Packages/**/*', 'Library/PackageCache/**/*'],
        excludePatterns: [],
        description: 'Unity Package Manager packages'
      }
    ];
  }

  public async parseSolution(): Promise<void> {
    this.projects.clear();
    this.fileToProjectMap.clear();

    if (!this.workspaceRoot || !fs.existsSync(this.workspaceRoot)) {
      return;
    }

    // 1. Scan for .asmdef files
    await this.scanAsmdefFiles();

    // 2. Scan for .sln and .csproj files
    await this.scanSlnAndCsprojFiles();

    // 3. Fallback default assemblies if no .csproj / .asmdef found
    if (this.projects.size === 0) {
      this.createFallbackProjects();
    }
  }

  private async scanAsmdefFiles(): Promise<void> {
    try {
      const asmdefFiles = await vscode.workspace.findFiles('**/*.asmdef', '**/Library/**');
      for (const uri of asmdefFiles) {
        try {
          const content = await fs.promises.readFile(uri.fsPath, 'utf8');
          const json = JSON.parse(content);
          const asmName = json.name || path.basename(uri.fsPath, '.asmdef');
          const dir = path.dirname(uri.fsPath);
          const isEditor = asmName.toLowerCase().includes('editor') || 
            (json.includePlatforms && json.includePlatforms.includes('Editor') && json.includePlatforms.length === 1);

          const projectInfo: ProjectInfo = {
            name: asmName,
            type: 'asmdef',
            rootDirectory: dir,
            filePaths: new Set<string>(),
            isEditorOnly: isEditor
          };

          this.projects.set(asmName, projectInfo);
        } catch {
          // Ignore invalid asmdef
        }
      }
    } catch {
      // workspace.findFiles failed or not in VS Code context
    }
  }

  private async scanSlnAndCsprojFiles(): Promise<void> {
    try {
      const csprojFiles = await vscode.workspace.findFiles('*.csproj', '**/Library/**');
      for (const uri of csprojFiles) {
        const projName = path.basename(uri.fsPath, '.csproj');
        if (!this.projects.has(projName)) {
          const isEditor = projName.toLowerCase().includes('editor');
          const projectInfo: ProjectInfo = {
            name: projName,
            type: 'csproj',
            rootDirectory: this.workspaceRoot,
            filePaths: new Set<string>(),
            isEditorOnly: isEditor
          };
          this.projects.set(projName, projectInfo);
        }
      }
    } catch {
      // Ignore
    }
  }

  private createFallbackProjects(): void {
    const defaultRuntime: ProjectInfo = {
      name: 'Assembly-CSharp',
      type: 'csproj',
      rootDirectory: path.join(this.workspaceRoot, 'Assets'),
      filePaths: new Set<string>(),
      isEditorOnly: false
    };

    const defaultEditor: ProjectInfo = {
      name: 'Assembly-CSharp-Editor',
      type: 'csproj',
      rootDirectory: path.join(this.workspaceRoot, 'Assets'),
      filePaths: new Set<string>(),
      isEditorOnly: true
    };

    this.projects.set('Assembly-CSharp', defaultRuntime);
    this.projects.set('Assembly-CSharp-Editor', defaultEditor);
  }

  public resolveFileProject(filePath: string): ProjectInfo {
    const normalized = normalizePath(filePath);
    if (this.fileToProjectMap.has(normalized)) {
      return this.fileToProjectMap.get(normalized)!;
    }

    // 1. Check if inside an .asmdef directory (most specific first)
    let bestAsmdefMatch: ProjectInfo | undefined;
    let longestPathLen = -1;

    for (const proj of this.projects.values()) {
      if (proj.type === 'asmdef') {
        const normalizedRootDir = normalizePath(proj.rootDirectory);
        if (normalized.startsWith(normalizedRootDir + '/') || normalized === normalizedRootDir) {
          if (normalizedRootDir.length > longestPathLen) {
            longestPathLen = normalizedRootDir.length;
            bestAsmdefMatch = proj;
          }
        }
      }
    }

    if (bestAsmdefMatch) {
      bestAsmdefMatch.filePaths.add(normalized);
      this.fileToProjectMap.set(normalized, bestAsmdefMatch);
      return bestAsmdefMatch;
    }

    // 2. Default Editor vs Runtime assembly fallback
    const isEditorFile = normalized.includes('/editor/');
    const fallbackName = isEditorFile ? 'Assembly-CSharp-Editor' : 'Assembly-CSharp';
    let proj = this.projects.get(fallbackName);

    if (!proj) {
      proj = {
        name: fallbackName,
        type: 'csproj',
        rootDirectory: this.workspaceRoot,
        filePaths: new Set<string>(),
        isEditorOnly: isEditorFile
      };
      this.projects.set(fallbackName, proj);
    }

    proj.filePaths.add(normalized);
    this.fileToProjectMap.set(normalized, proj);
    return proj;
  }

  public getProjects(): ProjectInfo[] {
    return Array.from(this.projects.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  public getAvailableScopes(): ScopeDefinition[] {
    return this.predefinedScopes;
  }

  public matchesScope(filePath: string, scopeName: string): boolean {
    const scope = this.predefinedScopes.find(s => s.name === scopeName);
    if (!scope) return true;

    const relPath = normalizePath(path.relative(this.workspaceRoot, filePath));

    // Check exclude patterns
    for (const pattern of scope.excludePatterns) {
      if (this.globMatch(relPath, pattern)) return false;
    }

    // Check include patterns
    for (const pattern of scope.includePatterns) {
      if (this.globMatch(relPath, pattern)) return true;
    }

    return false;
  }

  private globMatch(filePath: string, globPattern: string): boolean {
    const regexPattern = globPattern
      .replace(/\./g, '\\.')
      .replace(/\*\*\//g, '(.+/)?')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    return new RegExp(`^${regexPattern}$`, 'i').test(filePath);
  }

  public dispose(): void {
    this.projects.clear();
    this.fileToProjectMap.clear();
  }
}
