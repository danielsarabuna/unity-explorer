import * as vscode from 'vscode';
import * as path from 'path';
import { UnityTreeDataProvider } from './tree/UnityTreeDataProvider';
import { UnityTreeDragAndDropController } from './tree/UnityTreeDragAndDropController';
import { UnityTreeItem } from './tree/UnityTreeItem';
import { MetaSyncEngine } from './sync/MetaSyncEngine';
import { PackageManager } from './packages/PackageManager';
import { TemplateManager } from './templates/TemplateManager';
import { setupFileSystemWatcher } from './watchers/UnityFileSystemWatcher';
import { detectAndSetUnityContext } from './utils/contextUtils';

export async function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return;

  await detectAndSetUnityContext(workspaceRoot);

  const metaSyncEngine = new MetaSyncEngine();
  const packageManager = new PackageManager(workspaceRoot);
  const treeDataProvider = new UnityTreeDataProvider(workspaceRoot, packageManager);
  const dragAndDropController = new UnityTreeDragAndDropController(metaSyncEngine);

  const treeView = vscode.window.createTreeView('unityExplorer', {
    treeDataProvider,
    dragAndDropController,
    canSelectMany: true
  });

  setupFileSystemWatcher(context, workspaceRoot, treeDataProvider);

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

    vscode.commands.registerCommand('unityExplorer.refresh', () => {
      treeDataProvider.refresh();
    }),

    vscode.commands.registerCommand('unityExplorer.toggleVisibilitySettings', async () => {
      const config = vscode.workspace.getConfiguration('unityExplorer');
      const showMeta = config.get<boolean>('showMetaFiles', false);
      const showLogs = config.get<boolean>('showLogs', false);
      const showLibrary = config.get<boolean>('showLibrary', false);
      const showTemp = config.get<boolean>('showTemp', false);
      const showPackages = config.get<boolean>('showPackages', true);
      const showProjectSettings = config.get<boolean>('showProjectSettings', true);

      const items: (vscode.QuickPickItem & { key: string; current: boolean })[] = [
        {
          label: `${showMeta ? '$(check)' : '$(blank)'} Show .meta Files`,
          description: 'Display raw .meta files in the explorer tree',
          key: 'showMetaFiles',
          current: showMeta
        },
        {
          label: `${showLogs ? '$(check)' : '$(blank)'} Show Logs Folder`,
          description: 'Display Unity engine Logs/ folder',
          key: 'showLogs',
          current: showLogs
        },
        {
          label: `${showLibrary ? '$(check)' : '$(blank)'} Show Library Folder`,
          description: 'Display Unity cache Library/ folder',
          key: 'showLibrary',
          current: showLibrary
        },
        {
          label: `${showTemp ? '$(check)' : '$(blank)'} Show Temp Folder`,
          description: 'Display Unity build Temp/ folder',
          key: 'showTemp',
          current: showTemp
        },
        {
          label: `${showPackages ? '$(check)' : '$(blank)'} Show Packages`,
          description: 'Display Unity Package Manager packages',
          key: 'showPackages',
          current: showPackages
        },
        {
          label: `${showProjectSettings ? '$(check)' : '$(blank)'} Show ProjectSettings`,
          description: 'Display Unity engine settings folder',
          key: 'showProjectSettings',
          current: showProjectSettings
        }
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Toggle Explorer Visibility Settings'
      });

      if (selected) {
        await config.update(selected.key, !selected.current, vscode.ConfigurationTarget.Workspace);
        treeDataProvider.loadConfiguration();
        treeDataProvider.refresh();
      }
    }),

    vscode.commands.registerCommand('unityExplorer.switchViewMode', async () => {
      const selected = await vscode.window.showQuickPick(
        [
          { label: '$(symbol-namespace) Unity View', description: 'Clean Unity domain tree (Assets, Packages, Settings)', mode: 'unity' },
          { label: '$(files) File System View', description: 'Raw disk file tree', mode: 'allFiles' },
          { label: '$(project) Solution View', description: 'C# Assemblies & Solution references', mode: 'solution' }
        ],
        { placeHolder: 'Select View Mode' }
      );

      if (!selected) return;

      if (selected.mode === 'allFiles') {
        await vscode.commands.executeCommand('workbench.view.explorer');
      } else {
        vscode.window.showInformationMessage(`Switched to ${selected.label}`);
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
