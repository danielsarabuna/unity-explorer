import * as vscode from 'vscode';
import * as path from 'path';
import { UnityTreeDataProvider } from './tree/UnityTreeDataProvider';
import { UnityTreeDragAndDropController } from './tree/UnityTreeDragAndDropController';
import { UnityTreeItem } from './tree/UnityTreeItem';
import { MetaSyncEngine } from './sync/MetaSyncEngine';
import { PackageManager } from './packages/PackageManager';
import { TemplateManager } from './templates/TemplateManager';
import { setupFileSystemWatcher, setupSearchIndexWatcher } from './watchers/UnityFileSystemWatcher';
import { detectAndSetUnityContext } from './utils/contextUtils';
import { ScopeResolver } from './search/ScopeResolver';
import { CSharpSymbolIndexer } from './search/CSharpSymbolIndexer';
import { FileIndexer } from './search/FileIndexer';
import { SearchEngine } from './search/SearchEngine';
import { SearchPanelProvider } from './search/SearchPanelProvider';

export async function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return;

  await detectAndSetUnityContext(workspaceRoot);

  const scopeResolver = new ScopeResolver(workspaceRoot);
  const metaSyncEngine = new MetaSyncEngine();
  const packageManager = new PackageManager(workspaceRoot);
  const treeDataProvider = new UnityTreeDataProvider(workspaceRoot, packageManager, scopeResolver);
  const dragAndDropController = new UnityTreeDragAndDropController(metaSyncEngine);

  const treeView = vscode.window.createTreeView('unityExplorer', {
    treeDataProvider,
    dragAndDropController,
    canSelectMany: true
  });

  // Search Engine Initialization
  const symbolIndexer = new CSharpSymbolIndexer(workspaceRoot, scopeResolver);
  const fileIndexer = new FileIndexer(workspaceRoot, []);
  const searchEngine = new SearchEngine(symbolIndexer, fileIndexer, scopeResolver);
  const searchPanel = new SearchPanelProvider(context.extensionUri, searchEngine, symbolIndexer, scopeResolver);

  // Background indexing
  vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: 'Unity: Indexing C# symbols…' },
    async () => {
      await scopeResolver.parseSolution();
      await symbolIndexer.buildFullIndex(false);
      await fileIndexer.buildIndex(false);
    }
  );

  setupFileSystemWatcher(context, workspaceRoot, treeDataProvider);
  setupSearchIndexWatcher(context, workspaceRoot, symbolIndexer, fileIndexer);

  // Register WillRenameFiles handler for external / editor file renames
  context.subscriptions.push(
    vscode.workspace.onWillRenameFiles(async event => {
      const config = vscode.workspace.getConfiguration('unityExplorer');
      if (!config.get<boolean>('autoSyncMeta', true)) return;

      for (const file of event.files) {
        const oldMeta = vscode.Uri.file(`${file.oldUri.fsPath}.meta`);
        const newMeta = vscode.Uri.file(`${file.newUri.fsPath}.meta`);

        if (await metaSyncEngine.fileExists(oldMeta)) {
          const edit = new vscode.WorkspaceEdit();
          edit.renameFile(oldMeta, newMeta, { overwrite: true, ignoreIfExists: false });
          await vscode.workspace.applyEdit(edit);
        }
      }
    })
  );

  // Register Commands
  context.subscriptions.push(
    treeView,
    searchPanel,

    vscode.commands.registerCommand('unityExplorer.searchEverywhere', () => searchPanel.show()),
    vscode.commands.registerCommand('unityExplorer.searchTypes', () => searchPanel.show('types')),
    vscode.commands.registerCommand('unityExplorer.searchMembers', () => searchPanel.show('members')),
    vscode.commands.registerCommand('unityExplorer.searchFiles', () => searchPanel.show('files')),

    vscode.commands.registerCommand('unityExplorer.refresh', () => {
      treeDataProvider.refresh();
    }),

    vscode.commands.registerCommand('unityExplorer.toggleVisibility', async () => {
      const config = vscode.workspace.getConfiguration('unityExplorer');
      const showMetaFiles = config.get<boolean>('showMetaFiles', false);
      const showLogs = config.get<boolean>('showLogs', false);
      const showLibrary = config.get<boolean>('showLibrary', false);
      const showTemp = config.get<boolean>('showTemp', false);
      const showPackages = config.get<boolean>('showPackages', true);
      const showProjectSettings = config.get<boolean>('showProjectSettings', true);

      interface VisibilityQuickPickItem extends vscode.QuickPickItem {
        key: string;
      }

      const items: VisibilityQuickPickItem[] = [
        {
          label: 'Show .meta Files',
          description: 'Display raw .meta files in the explorer tree',
          picked: showMetaFiles,
          key: 'showMetaFiles'
        },
        {
          label: 'Show Logs Folder',
          description: 'Display Unity engine Logs/ folder',
          picked: showLogs,
          key: 'showLogs'
        },
        {
          label: 'Show Library Folder',
          description: 'Display Unity cache Library/ folder',
          picked: showLibrary,
          key: 'showLibrary'
        },
        {
          label: 'Show Temp Folder',
          description: 'Display Unity build Temp/ folder',
          picked: showTemp,
          key: 'showTemp'
        },
        {
          label: 'Show Packages',
          description: 'Display Unity Package Manager packages',
          picked: showPackages,
          key: 'showPackages'
        },
        {
          label: 'Show ProjectSettings',
          description: 'Display Unity engine settings folder',
          picked: showProjectSettings,
          key: 'showProjectSettings'
        }
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Toggle Explorer Visibility Settings',
        canPickMany: true
      });

      if (!selected) return;

      const selectedKeys = new Set(selected.map(item => item.key));
      for (const item of items) {
        const newValue = selectedKeys.has(item.key);
        await config.update(item.key, newValue, vscode.ConfigurationTarget.Global);
      }
      treeDataProvider.refresh();
    }),

    vscode.commands.registerCommand('unityExplorer.switchViewMode', async () => {
      const currentMode = treeDataProvider.getViewMode();
      const selected = await vscode.window.showQuickPick(
        [
          {
            label: `${currentMode === 'unity' ? '$(check)' : '$(blank)'} Unity View`,
            description: 'Clean Unity domain tree (Assets, Packages, Settings)',
            mode: 'unity'
          },
          {
            label: `${currentMode === 'solution' ? '$(check)' : '$(blank)'} Solution View`,
            description: 'C# Assemblies (.asmdef & .csproj) & file mappings',
            mode: 'solution'
          },
          {
            label: `${currentMode === 'allFiles' ? '$(check)' : '$(blank)'} All Files View`,
            description: 'Raw workspace directory tree',
            mode: 'allFiles'
          }
        ],
        { placeHolder: 'Select View Mode' }
      );

      if (!selected) return;

      treeDataProvider.setViewMode(selected.mode as any);
      if (selected.mode === 'unity') {
        treeView.title = 'Unity Project';
      } else if (selected.mode === 'solution') {
        treeView.title = 'C# Solution View';
      } else {
        treeView.title = 'All Workspace Files';
      }
    }),

    vscode.commands.registerCommand('unityExplorer.createScript', async (item?: UnityTreeItem) => {
      const targetDir = getTargetDir(item, workspaceRoot);

      const scriptName = await vscode.window.showInputBox({
        prompt: 'Enter C# Script Name',
        placeHolder: 'NewBehaviourScript',
        validateInput: text => {
          if (!text || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) {
            return 'Invalid C# class identifier.';
          }
          return null;
        }
      });

      if (!scriptName) return;

      const scriptUri = vscode.Uri.file(path.join(targetDir, `${scriptName}.cs`));
      const ns = TemplateManager.deriveNamespace(workspaceRoot, targetDir);
      const template = TemplateManager.getMonoBehaviourTemplate(scriptName, ns);

      await metaSyncEngine.createAsset(scriptUri, template.content, false, true);
      treeDataProvider.refresh();
      await vscode.window.showTextDocument(scriptUri);
    }),

    vscode.commands.registerCommand('unityExplorer.createFolder', async (item?: UnityTreeItem) => {
      const targetDir = getTargetDir(item, workspaceRoot);

      const folderName = await vscode.window.showInputBox({
        prompt: 'Enter Folder Name',
        placeHolder: 'NewFolder'
      });

      if (!folderName) return;

      const folderUri = vscode.Uri.file(path.join(targetDir, folderName));
      await metaSyncEngine.createAsset(folderUri, '', true, false);
      treeDataProvider.refresh();
    }),

    vscode.commands.registerCommand('unityExplorer.createShader', async (item?: UnityTreeItem) => {
      const targetDir = getTargetDir(item, workspaceRoot);

      const shaderName = await vscode.window.showInputBox({
        prompt: 'Enter Shader Name',
        placeHolder: 'NewUnlitShader'
      });

      if (!shaderName) return;

      const template = TemplateManager.getUnlitShaderTemplate(shaderName);
      const shaderUri = vscode.Uri.file(path.join(targetDir, template.filename));

      await metaSyncEngine.createAsset(shaderUri, template.content, false, false);
      treeDataProvider.refresh();
      await vscode.window.showTextDocument(shaderUri);
    }),

    vscode.commands.registerCommand('unityExplorer.createMaterial', async (item?: UnityTreeItem) => {
      const targetDir = getTargetDir(item, workspaceRoot);

      const matName = await vscode.window.showInputBox({
        prompt: 'Enter Material Name',
        placeHolder: 'NewMaterial'
      });

      if (!matName) return;

      const template = TemplateManager.getMaterialTemplate(matName);
      const matUri = vscode.Uri.file(path.join(targetDir, template.filename));

      await metaSyncEngine.createAsset(matUri, template.content, false, false);
      treeDataProvider.refresh();
    }),

    vscode.commands.registerCommand('unityExplorer.createAsmdef', async (item?: UnityTreeItem) => {
      const targetDir = getTargetDir(item, workspaceRoot);

      const asmName = await vscode.window.showInputBox({
        prompt: 'Enter Assembly Definition Name',
        placeHolder: 'MyCompany.MyFeature'
      });

      if (!asmName) return;

      const template = TemplateManager.getAsmdefTemplate(asmName);
      const asmUri = vscode.Uri.file(path.join(targetDir, template.filename));

      await metaSyncEngine.createAsset(asmUri, template.content, false, false);
      treeDataProvider.refresh();
      await vscode.window.showTextDocument(asmUri);
    }),

    vscode.commands.registerCommand('unityExplorer.rename', async (item?: UnityTreeItem) => {
      if (!item || item.isReadOnly) return;

      const currentName = path.basename(item.uri.fsPath);
      const newName = await vscode.window.showInputBox({
        prompt: 'Enter new name',
        value: currentName
      });

      if (!newName || newName === currentName) return;

      await metaSyncEngine.renameAsset(item.uri, newName);
      treeDataProvider.refresh();
    }),

    vscode.commands.registerCommand('unityExplorer.delete', async (item?: UnityTreeItem) => {
      if (!item || item.isReadOnly) return;

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete '${item.label}' and its associated .meta file?`,
        { modal: true },
        'Delete'
      );

      if (confirm === 'Delete') {
        await metaSyncEngine.deleteAssets([item.uri]);
        treeDataProvider.refresh();
      }
    }),

    vscode.commands.registerCommand('unityExplorer.revealInFinder', async (item?: UnityTreeItem) => {
      const targetUri = item ? item.uri : vscode.Uri.file(path.join(workspaceRoot, 'Assets'));
      await vscode.commands.executeCommand('revealFileInOS', targetUri);
    })
  );
}

function getTargetDir(item: UnityTreeItem | undefined, workspaceRoot: string): string {
  if (item) {
    if (item.itemType === 'folder' || item.itemType === 'assetsRoot') {
      return item.uri.fsPath;
    }
    return path.dirname(item.uri.fsPath);
  }
  return path.join(workspaceRoot, 'Assets');
}

export function deactivate() {}
