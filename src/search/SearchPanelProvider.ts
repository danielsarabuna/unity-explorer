import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SearchEngine } from './SearchEngine';
import { CSharpSymbolIndexer } from './CSharpSymbolIndexer';
import { ScopeResolver } from './ScopeResolver';
import { WebviewMessage, SearchFilters } from './SymbolTypes';

export class SearchPanelProvider implements vscode.Disposable {
  private panel?: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly searchEngine: SearchEngine,
    private readonly symbolIndexer: CSharpSymbolIndexer,
    private readonly scopeResolver: ScopeResolver
  ) {}

  public show(initialKindFilter?: string): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      if (initialKindFilter) {
        this.panel.webview.postMessage({
          type: 'set-kind-filter',
          kindFilter: initialKindFilter
        });
      }
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'unitySearch',
      'Unity Search',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(this.extensionUri.fsPath, 'src', 'search', 'webview'))],
        retainContextWhenHidden: true
      }
    );

    this.panel.webview.html = this.getHtmlContent(this.panel.webview);

    this.panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        await this.handleMessage(message);
      },
      null,
      this.disposables
    );

    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.disposables
    );

    if (initialKindFilter) {
      setTimeout(() => {
        this.panel?.webview.postMessage({
          type: 'set-kind-filter',
          kindFilter: initialKindFilter
        });
      }, 300);
    }
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    if (!this.panel) return;

    switch (message.type) {
      case 'search': {
        const startTime = Date.now();
        const results = this.searchEngine.search(message.query, message.filters);
        const searchTimeMs = Date.now() - startTime;
        const stats = this.symbolIndexer.getStats();

        this.panel.webview.postMessage({
          type: 'results',
          items: results,
          stats: {
            totalResults: results.length,
            searchTimeMs,
            totalFiles: stats.totalFiles,
            totalSymbols: stats.totalSymbols
          }
        });
        break;
      }

      case 'navigate': {
        try {
          const uri = vscode.Uri.file(message.filePath);
          const doc = await vscode.workspace.openTextDocument(uri);
          const line = Math.max(0, message.line - 1);
          const col = Math.max(0, message.column - 1);
          const pos = new vscode.Position(line, col);

          const editor = await vscode.window.showTextDocument(doc, {
            preserveFocus: false,
            selection: new vscode.Range(pos, pos)
          });

          editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to open file: ${err.message}`);
        }
        break;
      }

      case 'get-projects': {
        const projects = this.scopeResolver.getProjects().map(p => ({
          name: p.name,
          isEditorOnly: p.isEditorOnly
        }));
        this.panel.webview.postMessage({
          type: 'projects-list',
          projects
        });
        break;
      }

      case 'get-scopes': {
        const scopes = this.scopeResolver.getAvailableScopes();
        this.panel.webview.postMessage({
          type: 'scopes-list',
          scopes
        });
        break;
      }

      case 'pick-directory': {
        const uri = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          title: 'Select Search Directory'
        });

        if (uri && uri[0]) {
          this.panel.webview.postMessage({
            type: 'directory-picked',
            path: uri[0].fsPath
          });
        }
        break;
      }
    }
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const webviewDir = path.join(this.extensionUri.fsPath, 'src', 'search', 'webview');
    const htmlPath = path.join(webviewDir, 'searchPanel.html');
    const cssPath = path.join(webviewDir, 'searchPanel.css');
    const jsPath = path.join(webviewDir, 'searchPanel.js');

    let html = fs.readFileSync(htmlPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    // Inline CSS and JS for seamless webview execution
    html = html.replace('<!-- INLINE_CSS -->', `<style>\n${cssContent}\n</style>`);
    html = html.replace('<!-- INLINE_JS -->', `<script>\n${jsContent}\n</script>`);

    return html;
  }

  public dispose(): void {
    this.panel?.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
