# Unity Explorer for Antigravity IDE, VS Code & Cursor

[![CI Status](https://github.com/antigravity/unity-explorer/workflows/CI/badge.svg)](https://github.com/antigravity/unity-explorer/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A high-performance, open-source **Unity Explorer** extension replicating JetBrains Rider's Unity project view paradigm. It provides clean, domain-focused navigation of Unity projects inside **Antigravity IDE**, **VS Code**, and **Cursor**.

---

## ✨ Features

- 📁 **Rider-Style Unity Project View**: Dedicated tree view displaying `Assets/`, `Packages/`, and `ProjectSettings/` while automatically hiding filesystem noise (`.csproj`, `.sln`, `Library/`, `Temp/`, `Logs/`, `obj/`, `bin/`).
- ⚡ **Atomic `.meta` File Synchronization**:
  - **Renaming**: Renaming `PlayerController.cs` automatically renames `PlayerController.cs.meta` on disk.
  - **Moving & Drag-and-Drop**: Dragging files/folders across the tree moves assets and their corresponding `.meta` files together atomically, preserving Unity GUID references.
  - **Deleting**: Deleting assets removes their `.meta` files concurrently.
  - **Creating**: Creating new scripts, folders, shaders, or materials immediately generates a compliant `.meta` file with a 128-bit hex GUID.
- 📦 **UPM Package Manager Integration**: Resolves local (`file:`), embedded, and installed registry packages (`Library/PackageCache`). Packages are protected with read-only guards.
- 🔄 **View Mode Switcher**: Easily toggle between **Unity View** (domain hierarchy), **File System View** (raw disk), and **Solution View** (C# assemblies).
- 🎨 **Unity Asset Icon System**: High-contrast icons for MonoBehaviour, ScriptableObject, Prefabs, Scenes, Materials, Shaders, Animations, Controllers, Audio, Textures, and `.asmdef` files.
- ⚙️ **Templates & Context Menus**: Right-click any folder to generate new MonoBehaviour, ScriptableObject, Shader, Material, or Assembly Definition files with automatic namespace resolution based on directory path.

---

## 🚀 Installation & Usage

1. Install the extension in **Antigravity IDE**, **VS Code**, or **Cursor**.
2. Open any Unity project workspace containing `Assets/` or `ProjectSettings/`.
3. Click the **Unity Explorer** icon in the Activity Bar to open the Unity Project View.

---

## 🛠️ Configuration Settings

Configure via Editor Settings (`Ctrl+,` or `Cmd+,`):

| Setting Key | Default | Description |
| :--- | :--- | :--- |
| `unityExplorer.autoSyncMeta` | `true` | Automatically sync `.meta` files on rename, move, drag-and-drop, and delete. |
| `unityExplorer.showPackages` | `true` | Show Unity Package Manager packages in the explorer tree. |
| `unityExplorer.showProjectSettings` | `true` | Show ProjectSettings directory in the explorer tree. |
| `unityExplorer.excludedPatterns` | `["**/*.meta", "**/.git/**", "**/Library/**", "**/Temp/**"]` | Glob patterns to exclude from tree rendering. |

---

## ⌨️ Commands

| Command | Title | Description |
| :--- | :--- | :--- |
| `unityExplorer.refresh` | Refresh Explorer | Re-scans workspace directory and packages. |
| `unityExplorer.switchViewMode` | Switch View Mode | Toggle between Unity View, File System View, and Solution View. |
| `unityExplorer.createScript` | New C# Script | Prompts for class name and creates MonoBehaviour script with paired `.meta`. |
| `unityExplorer.createFolder` | New Folder | Creates directory with paired `.meta`. |
| `unityExplorer.createShader` | New Shader | Creates HLSL Unlit Shader with paired `.meta`. |
| `unityExplorer.createMaterial` | New Material | Creates Unity `.mat` asset with paired `.meta`. |
| `unityExplorer.createAsmdef` | New Assembly Definition | Creates `.asmdef` file with paired `.meta`. |
| `unityExplorer.rename` | Rename Asset | Atomically renames asset and `.meta` file. |
| `unityExplorer.delete` | Delete Asset | Atomically deletes asset and `.meta` file. |

---

## 🧪 Testing & Development

```bash
# Install dependencies
npm install

# Fast bundle development build
npm run build-fast

# Watch mode
npm run watch

# Run unit tests
npm run test:unit

# Package VSIX for distribution
npm run package
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
