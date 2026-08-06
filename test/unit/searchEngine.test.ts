import { describe, it, expect, beforeEach } from 'vitest';
import { SearchEngine } from '../../src/search/SearchEngine';
import { CSharpSymbolIndexer } from '../../src/search/CSharpSymbolIndexer';
import { FileIndexer } from '../../src/search/FileIndexer';
import { ScopeResolver } from '../../src/search/ScopeResolver';
import { SearchFilters } from '../../src/search/SymbolTypes';

describe('SearchEngine', () => {
  let scopeResolver: ScopeResolver;
  let symbolIndexer: CSharpSymbolIndexer;
  let fileIndexer: FileIndexer;
  let searchEngine: SearchEngine;

  const defaultFilters: SearchFilters = {
    locationScope: 'solution',
    kindFilter: 'all',
    fileMask: '*.*',
    regex: false,
    caseSensitive: false,
    wholeWord: false,
    includeNonProjectItems: false
  };

  beforeEach(() => {
    scopeResolver = new ScopeResolver('/dummy');
    symbolIndexer = new CSharpSymbolIndexer('/dummy', scopeResolver);
    fileIndexer = new FileIndexer('/dummy', []);
    searchEngine = new SearchEngine(symbolIndexer, fileIndexer, scopeResolver);
  });

  it('matches CamelHump query PCon -> PlayerController', () => {
    const code = `
      public class PlayerController : MonoBehaviour {}
      public class PacketConnection {}
    `;
    symbolIndexer.parseCSharpCode(code, '/dummy/PlayerController.cs', 'Assembly-CSharp');

    // Manually inject symbols for unit testing
    const parsed = symbolIndexer.parseCSharpCode(code, '/dummy/PlayerController.cs', 'Assembly-CSharp');
    // @ts-ignore
    symbolIndexer.symbolsByFile.set('/dummy/playercontroller.cs', parsed);

    const results = searchEngine.search('PlCon', defaultFilters);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].symbol?.name).toBe('PlayerController');
  });

  it('filters by kind: types', () => {
    const code = `
      public class PlayerController {
        public float speed = 5.0f;
        public void Move() {}
      }
    `;
    const parsed = symbolIndexer.parseCSharpCode(code, '/dummy/Player.cs', 'Assembly-CSharp');
    // @ts-ignore
    symbolIndexer.symbolsByFile.set('/dummy/player.cs', parsed);

    const typeResults = searchEngine.search('Player', { ...defaultFilters, kindFilter: 'types' });
    expect(typeResults.every(r => r.symbol?.kind === 'Class')).toBe(true);

    const memberResults = searchEngine.search('speed', { ...defaultFilters, kindFilter: 'members' });
    expect(memberResults.some(r => r.symbol?.name === 'speed')).toBe(true);
  });

  it('filters by inline query prefix t: f: m:', () => {
    const code = `
      public class PlayerController {
        public float speed = 5.0f;
      }
    `;
    const parsed = symbolIndexer.parseCSharpCode(code, '/dummy/Player.cs', 'Assembly-CSharp');
    // @ts-ignore
    symbolIndexer.symbolsByFile.set('/dummy/player.cs', parsed);

    const parsedFilter = searchEngine.parseQuery('t:Player');
    expect(parsedFilter.cleanQuery).toBe('Player');
    expect(parsedFilter.inlineFilters.kindFilter).toBe('types');
  });

  it('evaluates wildcard query *Manager', () => {
    const code = `
      public class UIManager {}
      public class GameManager {}
      public class PlayerController {}
    `;
    const parsed = symbolIndexer.parseCSharpCode(code, '/dummy/Managers.cs', 'Assembly-CSharp');
    // @ts-ignore
    symbolIndexer.symbolsByFile.set('/dummy/managers.cs', parsed);

    const results = searchEngine.search('*Manager', defaultFilters);
    expect(results.length).toBe(2);
    expect(results.map(r => r.symbol?.name)).toContain('UIManager');
    expect(results.map(r => r.symbol?.name)).toContain('GameManager');
  });
});
