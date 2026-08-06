import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  CSharpSymbol,
  SymbolKind,
  AccessModifier,
  UnityAttribute,
  UNITY_LIFECYCLE_METHODS
} from './SymbolTypes';
import { ScopeResolver } from './ScopeResolver';
import { normalizePath } from '../utils/pathUtils';

export class CSharpSymbolIndexer implements vscode.Disposable {
  private symbolsByFile: Map<string, CSharpSymbol[]> = new Map();
  private allSymbolsCache: CSharpSymbol[] = [];
  private cacheNeedsUpdate: boolean = true;
  private totalIndexedFiles: number = 0;
  private totalIndexedSymbols: number = 0;
  private lastIndexTimeMs: number = 0;

  constructor(
    private readonly workspaceRoot: string,
    private readonly scopeResolver: ScopeResolver
  ) {}

  public async buildFullIndex(includePackages: boolean): Promise<void> {
    const startTime = Date.now();
    this.symbolsByFile.clear();
    this.cacheNeedsUpdate = true;

    if (!this.workspaceRoot) return;

    let csFiles: vscode.Uri[] = [];
    try {
      const globPattern = includePackages ? '{Assets,Packages}/**/*.cs' : 'Assets/**/*.cs';
      const excludePattern = '{**/Library/**,**/Temp/**,**/Logs/**,**/obj/**,**/bin/**}';
      csFiles = await vscode.workspace.findFiles(globPattern, excludePattern);
    } catch {
      // Fallback if not in VS Code extension runtime (e.g. unit tests)
      csFiles = this.findCsFilesRecursive(path.join(this.workspaceRoot, 'Assets'));
      if (includePackages) {
        const pkgFiles = this.findCsFilesRecursive(path.join(this.workspaceRoot, 'Packages'));
        csFiles.push(...pkgFiles);
      }
    }

    for (const fileUri of csFiles) {
      await this.reindexFile(fileUri);
    }

    this.lastIndexTimeMs = Date.now() - startTime;
  }

  public async reindexFile(fileUri: vscode.Uri): Promise<CSharpSymbol[]> {
    const normalizedPath = normalizePath(fileUri.fsPath);
    try {
      const content = await fs.promises.readFile(fileUri.fsPath, 'utf8');
      const projectInfo = this.scopeResolver.resolveFileProject(fileUri.fsPath);
      const symbols = this.parseCSharpCode(content, fileUri.fsPath, projectInfo.name);

      this.symbolsByFile.set(normalizedPath, symbols);
      this.cacheNeedsUpdate = true;
      return symbols;
    } catch {
      this.symbolsByFile.delete(normalizedPath);
      this.cacheNeedsUpdate = true;
      return [];
    }
  }

  public removeFile(fileUri: vscode.Uri): void {
    const normalizedPath = normalizePath(fileUri.fsPath);
    if (this.symbolsByFile.has(normalizedPath)) {
      this.symbolsByFile.delete(normalizedPath);
      this.cacheNeedsUpdate = true;
    }
  }

  public getAllSymbols(): CSharpSymbol[] {
    if (this.cacheNeedsUpdate) {
      this.allSymbolsCache = [];
      let symbolCount = 0;
      for (const symbols of this.symbolsByFile.values()) {
        this.allSymbolsCache.push(...symbols);
        symbolCount += symbols.length;
      }
      this.totalIndexedFiles = this.symbolsByFile.size;
      this.totalIndexedSymbols = symbolCount;
      this.cacheNeedsUpdate = false;
    }
    return this.allSymbolsCache;
  }

  public getSymbolsByFile(filePath: string): CSharpSymbol[] {
    const normalized = normalizePath(filePath);
    return this.symbolsByFile.get(normalized) || [];
  }

  public getStats(): { totalSymbols: number; totalFiles: number; indexTimeMs: number } {
    this.getAllSymbols(); // ensure stats updated
    return {
      totalSymbols: this.totalIndexedSymbols,
      totalFiles: this.totalIndexedFiles,
      indexTimeMs: this.lastIndexTimeMs
    };
  }

  // ═══ C# CODE PARSER ═══

  public parseCSharpCode(code: string, filePath: string, assemblyName: string): CSharpSymbol[] {
    const symbols: CSharpSymbol[] = [];
    const lines = code.split(/\r?\n/);

    let currentNamespace = '';
    const typeStack: { name: string; kind: SymbolKind; baseTypes: string[]; entryBraceDepth: number }[] = [];
    let pendingAttributes: UnityAttribute[] = [];
    let pendingDocComment: string | undefined = undefined;

    let inBlockComment = false;
    let currentBraceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1; // 1-indexed
      let lineText = lines[i];

      // Count braces on this line for depth tracking
      const openBraces = (lineText.match(/\{/g) || []).length;
      const closeBraces = (lineText.match(/\}/g) || []).length;

      // Handle multiline comments /* ... */
      if (inBlockComment) {
        if (lineText.includes('*/')) {
          lineText = lineText.substring(lineText.indexOf('*/') + 2);
          inBlockComment = false;
        } else {
          continue;
        }
      }

      if (lineText.includes('/*')) {
        const commentStart = lineText.indexOf('/*');
        const commentEnd = lineText.indexOf('*/', commentStart + 2);
        if (commentEnd !== -1) {
          lineText = lineText.substring(0, commentStart) + lineText.substring(commentEnd + 2);
        } else {
          lineText = lineText.substring(0, commentStart);
          inBlockComment = true;
        }
      }

      // Strip single line comment // (except /// doc comments)
      const trimmedLine = lineText.trim();
      if (trimmedLine.startsWith('///')) {
        const docText = trimmedLine.replace(/^Com+|<[^>]+>/g, '').trim();
        if (docText && !pendingDocComment) {
          pendingDocComment = docText;
        }
        continue;
      }

      const commentIdx = lineText.indexOf('//');
      if (commentIdx !== -1) {
        lineText = lineText.substring(0, commentIdx);
      }

      const line = lineText.trim();

      // Check if current type scope has ended
      if (typeStack.length > 0) {
        const topType = typeStack[typeStack.length - 1];
        if (currentBraceDepth < topType.entryBraceDepth && closeBraces > 0) {
          typeStack.pop();
        }
      }

      if (!line) {
        currentBraceDepth += openBraces - closeBraces;
        continue;
      }

      // 1. Region markers
      if (line.startsWith('#region')) {
        const regionName = line.replace('#region', '').trim() || 'Region';
        symbols.push(this.createSymbol({
          name: regionName,
          kind: SymbolKind.RegionMarker,
          access: AccessModifier.Public,
          line: lineNum,
          column: 1,
          filePath,
          assemblyName,
          nestingDepth: typeStack.length,
          codeLine: lines[i]
        }));
        currentBraceDepth += openBraces - closeBraces;
        continue;
      }

      // 2. Namespace parsing
      const nsMatch = line.match(/^namespace\s+([\w\.]+)(?:\s*;|\s*\{)?/);
      if (nsMatch) {
        currentNamespace = nsMatch[1];
        currentBraceDepth += openBraces - closeBraces;
        continue;
      }

      // 3. Attributes parsing
      const attrMatches = line.match(/\[([A-Za-z0-9_,\s\(\)\="'\.-]+)\]/g);
      if (attrMatches) {
        for (const attrRaw of attrMatches) {
          const attrContent = attrRaw.slice(1, -1);
          for (const attrKey of Object.keys(UnityAttribute)) {
            if (attrContent.includes(attrKey)) {
              pendingAttributes.push(attrKey as UnityAttribute);
            }
          }
        }
        // Attributes might be on their own line
        if (/^\[.+\]$/.test(line)) {
          currentBraceDepth += openBraces - closeBraces;
          continue;
        }
      }

      // 4. Type Declarations (class, struct, interface, enum, record, delegate)
      const typeMatch = line.match(
        /(?:(public|private|protected|internal|file)\s+)?(?:(static|abstract|sealed|partial|readonly|ref)\s+)*(class|struct|interface|enum|record|delegate)\s+([A-Za-z0-9_]+)(?:\s*<([^>]+)>)?(?:\s*:\s*([^{]+))?/
      );

      if (typeMatch && (!line.includes('(') || typeMatch[3] === 'delegate' || typeMatch[3] === 'record')) {
        const access = this.parseAccess(typeMatch[1]);
        const modifiers = typeMatch[2] || '';
        const keyword = typeMatch[3];
        const name = typeMatch[4];
        const genericParams = typeMatch[5] ? `<${typeMatch[5]}>` : undefined;
        const baseTypesStr = typeMatch[6];

        const baseTypes = baseTypesStr
          ? baseTypesStr.split(',').map(b => b.trim().split(' ')[0]).filter(Boolean)
          : [];

        let kind: SymbolKind = SymbolKind.Class;
        if (keyword === 'struct') kind = SymbolKind.Struct;
        else if (keyword === 'interface') kind = SymbolKind.Interface;
        else if (keyword === 'enum') kind = SymbolKind.Enum;
        else if (keyword === 'record') kind = SymbolKind.Record;
        else if (keyword === 'delegate') kind = SymbolKind.Delegate;
        if (modifiers.includes('file') || typeMatch[1] === 'file') kind = SymbolKind.FileScopedType;

        const currentContainer = typeStack.length > 0 ? typeStack[typeStack.length - 1] : undefined;

        const symbol = this.createSymbol({
          name,
          kind,
          access,
          line: lineNum,
          column: lineText.indexOf(name) + 1,
          filePath,
          assemblyName,
          containerName: currentContainer?.name,
          containerKind: currentContainer?.kind,
          namespaceName: currentNamespace,
          nestingDepth: typeStack.length,
          baseTypes,
          genericParams,
          isStatic: modifiers.includes('static'),
          isAbstract: modifiers.includes('abstract'),
          isSealed: modifiers.includes('sealed'),
          isPartial: modifiers.includes('partial'),
          isFileScoped: modifiers.includes('file') || typeMatch[1] === 'file',
          attributes: [...pendingAttributes],
          codeLine: lines[i],
          docComment: pendingDocComment
        });

        symbols.push(symbol);
        pendingAttributes = [];
        pendingDocComment = undefined;

        if (kind !== SymbolKind.Delegate) {
          const entryDepth = currentBraceDepth + (openBraces > 0 ? 1 : 1);
          typeStack.push({ name, kind, baseTypes, entryBraceDepth: entryDepth });
        }
        currentBraceDepth += openBraces - closeBraces;
        continue;
      }


      const currentType = typeStack.length > 0 ? typeStack[typeStack.length - 1] : undefined;
      if (!currentType) {
        pendingAttributes = [];
        pendingDocComment = undefined;
        continue;
      }

      // 5. Enum Members (inside enum)
      if (currentType.kind === SymbolKind.Enum) {
        const enumMemberMatch = line.match(/^([A-Za-z0-9_]+)(?:\s*=\s*[^,]+)?/);
        if (enumMemberMatch && !['public', 'private', 'protected', 'internal'].includes(enumMemberMatch[1])) {
          symbols.push(this.createSymbol({
            name: enumMemberMatch[1],
            kind: SymbolKind.EnumMember,
            access: AccessModifier.Public,
            line: lineNum,
            column: lineText.indexOf(enumMemberMatch[1]) + 1,
            filePath,
            assemblyName,
            containerName: currentType.name,
            containerKind: currentType.kind,
            namespaceName: currentNamespace,
            nestingDepth: typeStack.length,
            attributes: [...pendingAttributes],
            codeLine: lines[i],
            docComment: pendingDocComment
          }));
          pendingAttributes = [];
          pendingDocComment = undefined;
        }
        continue;
      }

      // 6. Methods, Constructors, Destructors, Operators, Indexers
      const methodMatch = line.match(
        /(?:(public|private|protected|internal)\s+)?(?:(static|virtual|override|abstract|async|sealed|extern|partial|required)\s+)*([\w<>\[\],\s\?]+?)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/
      );

      if (methodMatch) {
        const access = this.parseAccess(methodMatch[1]);
        const modifiers = methodMatch[2] || '';
        const returnTypeOrName = methodMatch[3].trim();
        const name = methodMatch[4];
        const params = methodMatch[5].trim();

        let kind: SymbolKind = SymbolKind.Method;
        let isConstructor = false;

        if (name === currentType.name) {
          kind = SymbolKind.Constructor;
          isConstructor = true;
        } else if (name.startsWith('~') || line.includes(`~${currentType.name}`)) {
          kind = SymbolKind.Destructor;
        } else if (line.includes('operator ')) {
          kind = SymbolKind.Operator;
        } else if (modifiers.includes('this') || params.startsWith('this ')) {
          kind = SymbolKind.ExtensionMethod;
        }

        const isUnityEvent = currentType.baseTypes.some(b => b.includes('MonoBehaviour') || b.includes('ScriptableObject') || b.includes('Editor'))
          && UNITY_LIFECYCLE_METHODS.has(name);
        const unityCat = isUnityEvent ? UNITY_LIFECYCLE_METHODS.get(name) : undefined;

        symbols.push(this.createSymbol({
          name,
          kind,
          access,
          line: lineNum,
          column: lineText.indexOf(name) + 1,
          filePath,
          assemblyName,
          containerName: currentType.name,
          containerKind: currentType.kind,
          namespaceName: currentNamespace,
          nestingDepth: typeStack.length,
          returnType: isConstructor ? undefined : returnTypeOrName,
          parameters: `(${params})`,
          isStatic: modifiers.includes('static'),
          isAbstract: modifiers.includes('abstract'),
          isVirtual: modifiers.includes('virtual'),
          isOverride: modifiers.includes('override'),
          isAsync: modifiers.includes('async'),
          isPartial: modifiers.includes('partial'),
          isUnityEventFunction: isUnityEvent,
          unityEventCategory: unityCat,
          attributes: [...pendingAttributes],
          codeLine: lines[i],
          docComment: pendingDocComment
        }));

        pendingAttributes = [];
        pendingDocComment = undefined;
        continue;
      }

      // 7. Properties & Auto-Properties
      const propMatch = line.match(
        /(?:(public|private|protected|internal)\s+)?(?:(static|virtual|override|abstract|sealed|required)\s+)*([\w<>\[\],\s\?]+?)\s+([A-Za-z0-9_]+)\s*\{\s*(get|set|init)/
      );

      if (propMatch) {
        const access = this.parseAccess(propMatch[1]);
        const modifiers = propMatch[2] || '';
        const propType = propMatch[3].trim();
        const name = propMatch[4];
        const accessor = propMatch[5];

        let kind: SymbolKind = SymbolKind.Property;
        if (accessor === 'init') kind = SymbolKind.InitOnlySetter;
        if (modifiers.includes('required')) kind = SymbolKind.RequiredMember;

        symbols.push(this.createSymbol({
          name,
          kind,
          access,
          line: lineNum,
          column: lineText.indexOf(name) + 1,
          filePath,
          assemblyName,
          containerName: currentType.name,
          containerKind: currentType.kind,
          namespaceName: currentNamespace,
          nestingDepth: typeStack.length,
          returnType: propType,
          isStatic: modifiers.includes('static'),
          isAbstract: modifiers.includes('abstract'),
          isVirtual: modifiers.includes('virtual'),
          isOverride: modifiers.includes('override'),
          isRequired: modifiers.includes('required'),
          attributes: [...pendingAttributes],
          codeLine: lines[i],
          docComment: pendingDocComment
        }));

        pendingAttributes = [];
        pendingDocComment = undefined;
        continue;
      }

      // 8. Fields & Constants
      const fieldMatch = line.match(
        /(?:(public|private|protected|internal)\s+)?(?:(static|const|readonly|volatile|required)\s+)*([\w<>\[\],\s\?]+?)\s+([A-Za-z0-9_]+)\s*(?:=\s*[^;]+)?;$/
      );

      if (fieldMatch) {
        const access = this.parseAccess(fieldMatch[1]);
        const modifiers = fieldMatch[2] || '';
        const fieldType = fieldMatch[3].trim();
        const name = fieldMatch[4];

        let kind: SymbolKind = SymbolKind.Field;
        if (modifiers.includes('const')) kind = SymbolKind.Constant;
        else if (modifiers.includes('required')) kind = SymbolKind.RequiredMember;

        const isMonoOrSO = currentType.baseTypes.some(b => 
          b.includes('MonoBehaviour') || b.includes('ScriptableObject') || b.includes('NetworkBehaviour')
        );
        const isAutoSer = isMonoOrSO && access === AccessModifier.Public 
          && !modifiers.includes('static') && !modifiers.includes('const') && !modifiers.includes('readonly')
          && !pendingAttributes.includes(UnityAttribute.NonSerialized)
          && !pendingAttributes.includes(UnityAttribute.HideInInspector);

        symbols.push(this.createSymbol({
          name,
          kind,
          access,
          line: lineNum,
          column: lineText.indexOf(name) + 1,
          filePath,
          assemblyName,
          containerName: currentType.name,
          containerKind: currentType.kind,
          namespaceName: currentNamespace,
          nestingDepth: typeStack.length,
          fieldType,
          isStatic: modifiers.includes('static'),
          isConst: modifiers.includes('const'),
          isReadonly: modifiers.includes('readonly'),
          isRequired: modifiers.includes('required'),
          isAutoSerialized: isAutoSer,
          attributes: [...pendingAttributes],
          codeLine: lines[i],
          docComment: pendingDocComment
        }));

        pendingAttributes = [];
        pendingDocComment = undefined;
        continue;
      }

      // Clear attributes after unhandled line
      if (line.endsWith(';') || line.endsWith('{') || line.endsWith('}')) {
        pendingAttributes = [];
        pendingDocComment = undefined;
      }

      currentBraceDepth += openBraces - closeBraces;
    }

    return symbols;
  }

  private parseAccess(raw?: string): AccessModifier {
    if (!raw) return AccessModifier.Private;
    if (raw.includes('public')) return AccessModifier.Public;
    if (raw.includes('protected')) return AccessModifier.Protected;
    if (raw.includes('internal')) return AccessModifier.Internal;
    return AccessModifier.Private;
  }

  private createSymbol(partial: Partial<CSharpSymbol> & { name: string; kind: SymbolKind; line: number; column: number; filePath: string }): CSharpSymbol {
    return {
      access: AccessModifier.Private,
      assemblyName: 'Assembly-CSharp',
      nestingDepth: 0,
      isStatic: false,
      isAbstract: false,
      isVirtual: false,
      isOverride: false,
      isReadonly: false,
      isConst: false,
      isSealed: false,
      isAsync: false,
      isPartial: false,
      isRequired: false,
      isFileScoped: false,
      attributes: [],
      isUnityEventFunction: false,
      isAutoSerialized: false,
      codeLine: '',
      ...partial
    };
  }

  private findCsFilesRecursive(dir: string): vscode.Uri[] {
    const results: vscode.Uri[] = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'Library' && entry.name !== 'Temp' && entry.name !== 'Logs' && entry.name !== 'obj') {
          results.push(...this.findCsFilesRecursive(fullPath));
        }
      } else if (entry.isFile() && entry.name.endsWith('.cs')) {
        results.push(vscode.Uri.file(fullPath));
      }
    }

    return results;
  }

  public dispose(): void {
    this.symbolsByFile.clear();
    this.allSymbolsCache = [];
  }
}
