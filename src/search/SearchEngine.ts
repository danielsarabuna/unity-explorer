import {
  CSharpSymbol,
  FileEntry,
  SearchResult,
  SearchFilters,
  SymbolKind,
  UnityAttribute
} from './SymbolTypes';
import { CSharpSymbolIndexer } from './CSharpSymbolIndexer';
import { FileIndexer } from './FileIndexer';
import { ScopeResolver } from './ScopeResolver';
import { normalizePath } from '../utils/pathUtils';

export class SearchEngine {
  constructor(
    private readonly symbolIndexer: CSharpSymbolIndexer,
    private readonly fileIndexer: FileIndexer,
    private readonly scopeResolver: ScopeResolver
  ) {}

  public search(query: string, filters: SearchFilters, maxResults: number = 100): SearchResult[] {
    const rawTrimmed = query.trim();
    const { cleanQuery, inlineFilters } = this.parseQuery(rawTrimmed);

    const mergedFilters: SearchFilters = {
      ...filters,
      ...inlineFilters
    };

    const isFileKind = mergedFilters.kindFilter === 'files';

    if (isFileKind) {
      return this.searchFiles(cleanQuery, mergedFilters, maxResults);
    }

    return this.searchSymbols(cleanQuery, mergedFilters, maxResults);
  }

  public parseQuery(raw: string): { cleanQuery: string; inlineFilters: Partial<SearchFilters> } {
    let cleanQuery = raw;
    const inlineFilters: Partial<SearchFilters> = {};

    // 1. Prefix filters: t:Player, f:speed, m:Update, s:Health
    if (cleanQuery.startsWith('t:')) {
      inlineFilters.kindFilter = 'types';
      cleanQuery = cleanQuery.substring(2);
    } else if (cleanQuery.startsWith('f:')) {
      inlineFilters.kindFilter = 'members';
      cleanQuery = cleanQuery.substring(2);
    } else if (cleanQuery.startsWith('m:')) {
      inlineFilters.kindFilter = 'members';
      cleanQuery = cleanQuery.substring(2);
    } else if (cleanQuery.startsWith('file:')) {
      inlineFilters.kindFilter = 'files';
      cleanQuery = cleanQuery.substring(5);
    } else if (cleanQuery.startsWith('s:') || cleanQuery.startsWith(':serialized')) {
      inlineFilters.kindFilter = 'serialized';
      cleanQuery = cleanQuery.replace(/^(s:|:serialized)/, '');
    }

    return { cleanQuery: cleanQuery.trim(), inlineFilters };
  }

  private searchSymbols(query: string, filters: SearchFilters, maxResults: number): SearchResult[] {
    const allSymbols = this.symbolIndexer.getAllSymbols();
    const results: SearchResult[] = [];

    // Filter by location scope
    const locationFiltered = this.filterByLocationScope(allSymbols, filters);

    // Filter by kind
    const kindFiltered = this.filterByKind(locationFiltered, filters.kindFilter);

    if (!query) {
      // Empty query: return top symbols
      return kindFiltered.slice(0, maxResults).map(symbol => ({
        symbol,
        score: 100,
        matchRanges: []
      }));
    }

    const isRegex = filters.regex;
    const caseSensitive = filters.caseSensitive;
    const wholeWord = filters.wholeWord;

    let regexObj: RegExp | undefined;
    if (isRegex) {
      try {
        regexObj = new RegExp(query, caseSensitive ? '' : 'i');
      } catch {
        return [];
      }
    }

    for (const symbol of kindFiltered) {
      // Check file mask
      if (filters.fileMask && filters.fileMask !== '*.*') {
        const ext = symbol.filePath.substring(symbol.filePath.lastIndexOf('.')).toLowerCase();
        if (!filters.fileMask.toLowerCase().includes(ext)) {
          continue;
        }
      }

      let score = 0;
      let matchRanges: [number, number][] = [];

      if (regexObj) {
        const match = symbol.name.match(regexObj);
        if (match && match.index !== undefined) {
          score = 600;
          matchRanges = [[match.index, match.index + match[0].length - 1]];
        }
      } else {
        const matchInfo = this.evaluateMatch(query, symbol.name, caseSensitive, wholeWord);
        if (matchInfo) {
          score = matchInfo.score;
          matchRanges = matchInfo.matchRanges;
        }
      }

      if (score > 0) {
        // Modifiers
        if (this.isTypeSymbol(symbol.kind)) score *= 1.2;
        if (symbol.isAutoSerialized || symbol.attributes.includes(UnityAttribute.SerializeField)) score *= 1.15;
        if (symbol.isUnityEventFunction) score *= 1.1;

        results.push({
          symbol,
          score: Math.round(score),
          matchRanges
        });
      }
    }

    // Sort by score DESC
    return results
      .sort((a, b) => b.score - a.score || a.symbol!.name.localeCompare(b.symbol!.name))
      .slice(0, maxResults);
  }

  private searchFiles(query: string, filters: SearchFilters, maxResults: number): SearchResult[] {
    const allFiles = this.fileIndexer.getAllFiles();
    const results: SearchResult[] = [];

    const caseSensitive = filters.caseSensitive;
    const wholeWord = filters.wholeWord;

    for (const file of allFiles) {
      // Apply location scope filter to files
      if (!this.matchesFileLocationScope(file.absolutePath, filters)) {
        continue;
      }

      if (filters.fileMask && filters.fileMask !== '*.*') {
        if (!filters.fileMask.toLowerCase().includes(file.extension)) {
          continue;
        }
      }

      if (!query) {
        results.push({ file, score: 100, matchRanges: [] });
        continue;
      }

      const matchInfo = this.evaluateMatch(query, file.fileName, caseSensitive, wholeWord);
      if (matchInfo && matchInfo.score > 0) {
        results.push({
          file,
          score: matchInfo.score,
          matchRanges: matchInfo.matchRanges
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score || a.file!.fileName.localeCompare(b.file!.fileName))
      .slice(0, maxResults);
  }

  private evaluateMatch(
    query: string,
    target: string,
    caseSensitive: boolean,
    wholeWord: boolean
  ): { score: number; matchRanges: [number, number][] } | undefined {
    const targetComp = caseSensitive ? target : target.toLowerCase();
    const queryComp = caseSensitive ? query : query.toLowerCase();

    if (wholeWord) {
      if (targetComp === queryComp) {
        return { score: 1000, matchRanges: [[0, target.length - 1]] };
      }
      return undefined;
    }

    // 1. Exact Match
    if (targetComp === queryComp) {
      return { score: 1000, matchRanges: [[0, target.length - 1]] };
    }

    // 2. Exact Prefix Match
    if (targetComp.startsWith(queryComp)) {
      return { score: 900, matchRanges: [[0, queryComp.length - 1]] };
    }

    // 3. CamelHump Match
    const camelHumpResult = this.matchCamelHump(query, target);
    if (camelHumpResult) {
      return camelHumpResult;
    }

    // 4. Substring Match
    const subIdx = targetComp.indexOf(queryComp);
    if (subIdx !== -1) {
      return {
        score: 500,
        matchRanges: [[subIdx, subIdx + queryComp.length - 1]]
      };
    }

    // 5. Multi-Word AND Match
    if (queryComp.includes(' ')) {
      const words = queryComp.split(/\s+/).filter(Boolean);
      let allFound = true;
      const ranges: [number, number][] = [];

      for (const word of words) {
        const idx = targetComp.indexOf(word);
        if (idx === -1) {
          allFound = false;
          break;
        }
        ranges.push([idx, idx + word.length - 1]);
      }

      if (allFound) {
        return { score: 400, matchRanges: ranges };
      }
    }

    // 6. Wildcard Match
    if (queryComp.includes('*') || queryComp.includes('?')) {
      const pattern = queryComp.replace(/\*/g, '.*').replace(/\?/g, '.');
      const regex = new RegExp(`^${pattern}$`, 'i');
      if (regex.test(target)) {
        return { score: 350, matchRanges: [[0, target.length - 1]] };
      }
    }

    // 7. Fuzzy Match (Levenshtein distance <= 2 for queries >= 4 chars)
    if (queryComp.length >= 4) {
      const dist = this.levenshteinDistance(queryComp, targetComp.substring(0, queryComp.length));
      if (dist <= 2) {
        return { score: 100, matchRanges: [[0, queryComp.length - 1]] };
      }
    }

    return undefined;
  }

  private matchCamelHump(query: string, target: string): { score: number; matchRanges: [number, number][] } | undefined {
    // Extract capital letters / word anchors from target (e.g. PlayerController -> P at 0, C at 6)
    const anchors: number[] = [];
    for (let i = 0; i < target.length; i++) {
      const char = target[i];
      if (i === 0 || (char >= 'A' && char <= 'Z') || target[i - 1] === '_') {
        anchors.push(i);
      }
    }

    if (anchors.length < 2) return undefined;

    let targetIdx = 0;
    let queryIdx = 0;
    const ranges: [number, number][] = [];

    while (queryIdx < query.length && targetIdx < target.length) {
      const qChar = query[queryIdx].toLowerCase();
      const tChar = target[targetIdx].toLowerCase();

      if (qChar === tChar) {
        const start = targetIdx;
        while (
          queryIdx < query.length &&
          targetIdx < target.length &&
          query[queryIdx].toLowerCase() === target[targetIdx].toLowerCase()
        ) {
          queryIdx++;
          targetIdx++;
        }
        ranges.push([start, targetIdx - 1]);
      } else {
        // Jump to next anchor
        const nextAnchor = anchors.find(a => a > targetIdx);
        if (nextAnchor !== undefined) {
          targetIdx = nextAnchor;
        } else {
          break;
        }
      }
    }

    if (queryIdx === query.length) {
      const isExactHump = query.length === anchors.length;
      return {
        score: isExactHump ? 800 : 750,
        matchRanges: ranges
      };
    }

    return undefined;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  private filterByLocationScope(symbols: CSharpSymbol[], filters: SearchFilters): CSharpSymbol[] {
    switch (filters.locationScope) {
      case 'project':
        if (!filters.projectName) return symbols;
        return symbols.filter(s => s.assemblyName === filters.projectName);

      case 'directory':
        if (!filters.directoryPath) return symbols;
        const normDir = normalizePath(filters.directoryPath);
        return symbols.filter(s => normalizePath(s.filePath).startsWith(normDir));

      case 'scope':
        if (!filters.scopeName) return symbols;
        return symbols.filter(s => this.scopeResolver.matchesScope(s.filePath, filters.scopeName!));

      case 'solution':
      default:
        return symbols;
    }
  }

  private matchesFileLocationScope(filePath: string, filters: SearchFilters): boolean {
    const normFile = normalizePath(filePath);
    switch (filters.locationScope) {
      case 'project':
        if (!filters.projectName) return true;
        const proj = this.scopeResolver.resolveFileProject(filePath);
        return proj.name === filters.projectName;

      case 'directory':
        if (!filters.directoryPath) return true;
        const normDir = normalizePath(filters.directoryPath);
        return normFile.startsWith(normDir);

      case 'scope':
        if (!filters.scopeName) return true;
        return this.scopeResolver.matchesScope(filePath, filters.scopeName);

      case 'solution':
      default:
        return true;
    }
  }

  private filterByKind(symbols: CSharpSymbol[], kindFilter: string): CSharpSymbol[] {
    switch (kindFilter) {
      case 'types':
        return symbols.filter(s => this.isTypeSymbol(s.kind));
      case 'members':
        return symbols.filter(s => !this.isTypeSymbol(s.kind) && s.kind !== SymbolKind.RegionMarker);
      case 'serialized':
        return symbols.filter(
          s => s.isAutoSerialized || s.attributes.includes(UnityAttribute.SerializeField)
        );
      case 'all':
      default:
        return symbols;
    }
  }

  private isTypeSymbol(kind: SymbolKind): boolean {
    return [
      SymbolKind.Class,
      SymbolKind.Struct,
      SymbolKind.Interface,
      SymbolKind.Enum,
      SymbolKind.Record,
      SymbolKind.Delegate,
      SymbolKind.FileScopedType
    ].includes(kind);
  }
}
