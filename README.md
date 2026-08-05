# Unity Explorer for Antigravity IDE, VS Code & Cursor

[![CI Pipeline](https://github.com/danielsarabuna/unity-explorer/actions/workflows/ci.yml/badge.svg)](https://github.com/danielsarabuna/unity-explorer/actions)
[![Latest Release](https://img.shields.io/github/v/release/danielsarabuna/unity-explorer?label=Download%20.vsix&color=blue)](https://github.com/danielsarabuna/unity-explorer/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A high-performance, open-source **Unity Explorer** extension bringing JetBrains Rider's signature Unity project navigation paradigm to **Antigravity IDE**, **VS Code**, and **Cursor**.

---

## 🎯 Why Unity Explorer? (Зачем это нужно?)

When developing Unity games in VS Code, Cursor, or Antigravity IDE, standard file explorers suffer from high visual clutter:
- Dozens of auto-generated `.csproj` and `.sln` files pollute the workspace root.
- Raw `.meta` files obscure actual game assets.
- Renaming or moving files in the standard explorer can accidentally break or omit `.meta` files, causing lost GUID references in Unity scenes and prefabs.

**Unity Explorer** solves these problems by providing:
1. **Clean Domain View**: Presents `Assets/`, `Packages/`, and `ProjectSettings/` like JetBrains Rider.
2. **Guaranteed `.meta` Sync**: Renaming, moving via Drag & Drop, or deleting any file automatically performs the paired operation on its corresponding `.meta` file.

---

## ✨ Features (Возможности)

- 📁 **Rider-Style Unity Project View**: Dedicated primary sidebar tab displaying `Assets/`, `Packages/`, and `ProjectSettings/` while automatically hiding filesystem noise (`.csproj`, `.sln`, `Library/`, `Temp/`, `Logs/`, `obj/`, `bin/`).
- ⚡ **Atomic `.meta` File Synchronization**:
  - **Renaming**: Renaming `PlayerController.cs` automatically renames `PlayerController.cs.meta` on disk (with automatic transactional rollback on failure).
  - **Moving & Drag-and-Drop**: Dragging files/folders across the tree moves assets and their corresponding `.meta` files together atomically, preserving Unity GUID references across team members.
  - **Deleting**: Deleting assets removes their `.meta` files concurrently.
  - **Creating**: Creating new scripts, folders, shaders, or materials immediately generates a compliant `.meta` file with a 128-bit hex GUID (`crypto.randomBytes(16)`).
- 📦 **UPM Package Manager Integration**: Resolves local (`file:`), embedded, and installed registry packages (`Library/PackageCache`). Packages are protected with read-only guards to prevent accidental modification.
- 🎛️ **Quick Filter & Visibility Toggles**: Click the Filter button `$(filter)` in the view header toolbar to instantly toggle showing/hiding `.meta` files, `Logs/`, `Library/`, `Temp/`, `Packages/`, and `ProjectSettings/`.
- 🔄 **View Mode Switcher**: Easily toggle between **Unity View** (domain hierarchy), **File System View** (raw disk), and **Solution View** (C# assemblies).
- 🎨 **Unity Asset Icon System**: High-contrast icons for MonoBehaviour, ScriptableObject, Prefabs, Scenes, Materials, Shaders, Animations, Controllers, Audio, Textures, and `.asmdef` files.
- ⚙️ **Templates & Context Menus**: Right-click any folder to generate new MonoBehaviour, ScriptableObject, Shader, Material, or Assembly Definition files with automatic namespace resolution based on directory path.

---

## 📥 Installation (Как установить)

### Option 1: Direct Download (.vsix)
1. Download `unity-explorer-1.0.0.vsix` from [Latest Releases](https://github.com/danielsarabuna/unity-explorer/releases/latest).
2. Open **Antigravity IDE**, **VS Code**, or **Cursor**.
3. Press `Cmd+Shift+P` (or `Ctrl+Shift+P`) and type `Extensions: Install from VSIX...`
4. Select the downloaded `.vsix` file.

### Option 2: Command Line (CLI)
```bash
# For VS Code
code --install-extension unity-explorer-1.0.0.vsix

# For Cursor
cursor --install-extension unity-explorer-1.0.0.vsix
```

### Option 3: One-Click Build & Install from Source
```bash
# Clone the repository
git clone https://github.com/danielsarabuna/unity-explorer.git
cd unity-explorer

# Install dependencies
npm install

# Build .vsix installer & auto-sync to local IDE extensions
npm run package
```

---

## 🛠️ Configuration Settings

Configure via Editor Settings (`Ctrl+,` or `Cmd+,`):

| Setting Key | Default | Description |
| :--- | :--- | :--- |
| `unityExplorer.autoSyncMeta` | `true` | Automatically sync `.meta` files on rename, move, drag-and-drop, and delete. |
| `unityExplorer.showMetaFiles` | `false` | Display raw `.meta` files in the explorer tree. |
| `unityExplorer.showLogs` | `false` | Display Unity engine Logs/ folder in the explorer tree. |
| `unityExplorer.showLibrary` | `false` | Display Unity cache Library/ folder in the explorer tree. |
| `unityExplorer.showTemp` | `false` | Display Unity build Temp/ folder in the explorer tree. |
| `unityExplorer.showPackages` | `true` | Show Unity Package Manager packages in the explorer tree. |
| `unityExplorer.showProjectSettings` | `true` | Show ProjectSettings directory in the explorer tree. |

---

## ⌨️ Commands

| Command | Title | Description |
| :--- | :--- | :--- |
| `unityExplorer.refresh` | Refresh Unity Explorer | Re-scans workspace directory and packages. |
| `unityExplorer.toggleVisibilitySettings` | Filter & View Options | Interactive menu to toggle .meta, Logs, Library, Temp, Packages. |
| `unityExplorer.switchViewMode` | Switch View Mode | Toggle between Unity View, File System View, and Solution View. |
| `unityExplorer.createScript` | New C# Script | Prompts for class name and creates MonoBehaviour script with paired `.meta`. |
| `unityExplorer.createFolder` | New Folder | Creates directory with paired `.meta`. |
| `unityExplorer.createShader` | New Shader | Creates HLSL Unlit Shader with paired `.meta`. |
| `unityExplorer.createMaterial` | New Material | Creates Unity `.mat` asset with paired `.meta`. |
| `unityExplorer.createAsmdef` | New Assembly Definition | Creates `.asmdef` file with paired `.meta`. |
| `unityExplorer.rename` | Rename Asset | Atomically renames asset and `.meta` file. |
| `unityExplorer.delete` | Delete Asset | Atomically deletes asset and `.meta` file. |

---

## 🧪 Testing & Quality Assurance

```bash
# Run unit tests (Vitest)
npm run test:unit

# Run linting checks
npm run lint
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
