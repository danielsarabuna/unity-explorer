(function () {
  const vscode = acquireVsCodeApi();

  // State
  let currentResults = [];
  let selectedIndex = -1;
  let debounceTimer = null;
  let currentFilters = {
    locationScope: 'solution',
    projectName: undefined,
    directoryPath: undefined,
    scopeName: undefined,
    kindFilter: 'all',
    fileMask: '*.*',
    regex: false,
    caseSensitive: false,
    wholeWord: false,
    includeNonProjectItems: false
  };

  // DOM Elements
  const searchInput = document.getElementById('searchInput');
  const fileMaskEnabled = document.getElementById('fileMaskEnabled');
  const fileMaskSelect = document.getElementById('fileMaskSelect');
  const btnRegex = document.getElementById('btnRegex');
  const btnCase = document.getElementById('btnCase');
  const btnWord = document.getElementById('btnWord');
  const includeNonProject = document.getElementById('includeNonProject');
  const resultsList = document.getElementById('resultsList');
  const statusText = document.getElementById('statusText');
  const btnOpenEditor = document.getElementById('btnOpenEditor');

  const locationTabs = document.querySelectorAll('.scope-tab');
  const kindTabs = document.querySelectorAll('.kind-tab');
  const projectSelect = document.getElementById('projectSelect');
  const scopeSelect = document.getElementById('scopeSelect');
  const btnPickDir = document.getElementById('btnPickDir');
  const directoryPathDisplay = document.getElementById('directoryPathDisplay');

  // Init
  window.addEventListener('load', () => {
    vscode.postMessage({ type: 'get-projects' });
    vscode.postMessage({ type: 'get-scopes' });
    searchInput.focus();
  });

  // Event Listeners
  searchInput.addEventListener('input', triggerSearch);

  fileMaskEnabled.addEventListener('change', () => {
    fileMaskSelect.disabled = !fileMaskEnabled.checked;
    currentFilters.fileMask = fileMaskEnabled.checked ? fileMaskSelect.value : '*.*';
    triggerSearch();
  });

  fileMaskSelect.addEventListener('change', () => {
    currentFilters.fileMask = fileMaskSelect.value;
    triggerSearch();
  });

  btnRegex.addEventListener('click', () => {
    btnRegex.classList.toggle('active');
    currentFilters.regex = btnRegex.classList.contains('active');
    triggerSearch();
  });

  btnCase.addEventListener('click', () => {
    btnCase.classList.toggle('active');
    currentFilters.caseSensitive = btnCase.classList.contains('active');
    triggerSearch();
  });

  btnWord.addEventListener('click', () => {
    btnWord.classList.toggle('active');
    currentFilters.wholeWord = btnWord.classList.contains('active');
    triggerSearch();
  });

  includeNonProject.addEventListener('change', () => {
    currentFilters.includeNonProjectItems = includeNonProject.checked;
    triggerSearch();
  });

  // Location Scope Tabs
  locationTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
      locationTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const loc = tab.dataset.location;
      currentFilters.locationScope = loc;

      projectSelect.style.display = loc === 'project' ? 'inline-block' : 'none';
      btnPickDir.style.display = loc === 'directory' ? 'inline-block' : 'none';
      scopeSelect.style.display = loc === 'scope' ? 'inline-block' : 'none';

      triggerSearch();
    });
  });

  projectSelect.addEventListener('change', () => {
    currentFilters.projectName = projectSelect.value;
    triggerSearch();
  });

  scopeSelect.addEventListener('change', () => {
    currentFilters.scopeName = scopeSelect.value;
    triggerSearch();
  });

  btnPickDir.addEventListener('click', () => {
    vscode.postMessage({ type: 'pick-directory' });
  });

  // Kind Filter Tabs
  kindTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      kindTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilters.kindFilter = tab.dataset.kind;
      triggerSearch();
    });
  });

  // Keyboard Navigation
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectResult(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectResult(selectedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < currentResults.length) {
        navigateResult(currentResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      // Handled by extension
    } else if (e.altKey && e.key.toLowerCase() === 'r') {
      btnRegex.click();
    } else if (e.altKey && e.key.toLowerCase() === 'c') {
      btnCase.click();
    } else if (e.altKey && e.key.toLowerCase() === 'w') {
      btnWord.click();
    }
  });

  btnOpenEditor.addEventListener('click', () => {
    if (selectedIndex >= 0 && selectedIndex < currentResults.length) {
      navigateResult(currentResults[selectedIndex]);
    }
  });

  // Incoming Messages from Extension Host
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'results':
        renderResults(message.items, message.stats);
        break;

      case 'projects-list':
        populateProjects(message.projects);
        break;

      case 'scopes-list':
        populateScopes(message.scopes);
        break;

      case 'directory-picked':
        currentFilters.directoryPath = message.path;
        directoryPathDisplay.textContent = shortenPath(message.path);
        directoryPathDisplay.title = message.path;
        triggerSearch();
        break;

      case 'set-kind-filter':
        const targetTab = Array.from(kindTabs).find(t => t.dataset.kind === message.kindFilter);
        if (targetTab) {
          targetTab.click();
        }
        break;
    }
  });

  // Search Logic
  function triggerSearch() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      vscode.postMessage({
        type: 'search',
        query: searchInput.value,
        filters: currentFilters
      });
    }, 150);
  }

  function renderResults(items, stats) {
    currentResults = items;
    selectedIndex = -1;
    resultsList.innerHTML = '';

    statusText.textContent = `${stats.totalResults} results · ${stats.totalFiles} files · ${stats.totalSymbols} symbols · ${stats.searchTimeMs}ms`;
    btnOpenEditor.disabled = true;

    if (items.length === 0) {
      resultsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p class="empty-title">No matching symbols found</p>
          <p class="empty-hint">Try adjusting search query or location scope</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'result-item';

      const isSymbol = !!item.symbol;
      const icon = getSymbolIcon(isSymbol ? item.symbol.kind : 'File', isSymbol ? item.symbol.attributes : []);
      const name = isSymbol ? item.symbol.name : item.file.fileName;
      const pathStr = isSymbol ? `${item.symbol.filePath}:${item.symbol.line}` : item.file.relativePath;
      const codeLine = isSymbol ? item.symbol.codeLine : '';
      const sig = isSymbol
        ? (item.symbol.returnType || item.symbol.fieldType || (item.symbol.baseTypes ? `: ${item.symbol.baseTypes.join(', ')}` : ''))
        : '';

      const highlightedName = highlightMatches(name, item.matchRanges);

      div.innerHTML = `
        <div class="result-header">
          <div class="result-main">
            <span class="result-icon">${icon}</span>
            <span class="result-name">${highlightedName}</span>
            <span class="result-sig">${escapeHtml(sig)}</span>
          </div>
          <span class="result-path">${escapeHtml(shortenPath(pathStr))}</span>
        </div>
        ${codeLine ? `<div class="result-code">${escapeHtml(codeLine.trim())}</div>` : ''}
      `;

      div.addEventListener('click', () => {
        selectResult(index);
        navigateResult(item);
      });

      fragment.appendChild(div);
    });

    resultsList.appendChild(fragment);
    selectResult(0);
  }

  function selectResult(index) {
    const items = resultsList.querySelectorAll('.result-item');
    if (items.length === 0) return;

    if (selectedIndex >= 0 && selectedIndex < items.length) {
      items[selectedIndex].classList.remove('selected');
    }

    selectedIndex = Math.max(0, Math.min(index, items.length - 1));
    const selectedItem = items[selectedIndex];
    selectedItem.classList.add('selected');
    selectedItem.scrollIntoView({ block: 'nearest' });

    btnOpenEditor.disabled = false;
  }

  function navigateResult(item) {
    if (item.symbol) {
      vscode.postMessage({
        type: 'navigate',
        filePath: item.symbol.filePath,
        line: item.symbol.line,
        column: item.symbol.column
      });
    } else if (item.file) {
      vscode.postMessage({
        type: 'navigate',
        filePath: item.file.absolutePath,
        line: 1,
        column: 1
      });
    }
  }

  function populateProjects(projects) {
    projectSelect.innerHTML = '';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = `${p.name}${p.isEditorOnly ? ' (Editor)' : ''}`;
      projectSelect.appendChild(opt);
    });
    if (projects.length > 0) {
      currentFilters.projectName = projects[0].name;
    }
  }

  function populateScopes(scopes) {
    scopeSelect.innerHTML = '';
    scopes.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      scopeSelect.appendChild(opt);
    });
    if (scopes.length > 0) {
      currentFilters.scopeName = scopes[0].name;
    }
  }

  function getSymbolIcon(kind, attributes = []) {
    if (attributes.includes('SerializeField')) return '🟡';
    switch (kind) {
      case 'Class': return '🟨';
      case 'Struct': return '🟦';
      case 'Interface': return '🟩';
      case 'Enum': return '🟧';
      case 'Record': return '🟪';
      case 'Delegate': return '🟫';
      case 'Field': return '🔹';
      case 'Property': return '🟣';
      case 'Method': return '⚡';
      case 'Constructor': return '🛠️';
      case 'Event': return '🌩️';
      case 'EnumMember': return '🔸';
      case 'Constant': return '🔒';
      case 'File': return '📄';
      default: return '🔹';
    }
  }

  function highlightMatches(text, ranges) {
    if (!ranges || ranges.length === 0) return escapeHtml(text);
    let html = '';
    let last = 0;

    ranges.forEach(([start, end]) => {
      html += escapeHtml(text.slice(last, start));
      html += `<mark>${escapeHtml(text.slice(start, end + 1))}</mark>`;
      last = end + 1;
    });

    html += escapeHtml(text.slice(last));
    return html;
  }

  function shortenPath(p) {
    if (!p) return '';
    const parts = p.split(/[/\\]/);
    if (parts.length > 3) {
      return `…/${parts.slice(-3).join('/')}`;
    }
    return p;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
