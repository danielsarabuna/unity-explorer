import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export interface ResolvedPackage {
  name: string;
  version: string;
  rootUri: vscode.Uri;
  sourceType: 'registry' | 'local' | 'git' | 'tarball' | 'embedded';
}

export class PackageManager {
  constructor(private readonly workspaceRoot: string) {}

  public async getResolvedPackages(): Promise<ResolvedPackage[]> {
    const manifestUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Packages', 'manifest.json'));

    let manifestJson: any = {};
    try {
      const content = await vscode.workspace.fs.readFile(manifestUri);
      manifestJson = JSON.parse(new TextDecoder().decode(content));
    } catch {
      return [];
    }

    const dependencies = manifestJson.dependencies || {};
    const resolved: ResolvedPackage[] = [];

    for (const [pkgName, versionOrPath] of Object.entries<string>(dependencies)) {
      const pkgInfo = await this.resolvePackageLocation(pkgName, versionOrPath);
      if (pkgInfo) {
        resolved.push(pkgInfo);
      }
    }

    return resolved.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async resolvePackageLocation(pkgName: string, versionOrPath: string): Promise<ResolvedPackage | undefined> {
    // 1. Local Package: "file:../my-package" or "file:packages/my-package"
    if (versionOrPath.startsWith('file:')) {
      const relativePath = versionOrPath.replace('file:', '');
      const localPath = path.resolve(this.workspaceRoot, 'Packages', relativePath);
      const localUri = vscode.Uri.file(localPath);
      if (await this.exists(localUri)) {
        return { name: pkgName, version: 'local', rootUri: localUri, sourceType: 'local' };
      }
    }

    // 2. Embedded Package directly in Packages/<pkgName>
    const embeddedUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Packages', pkgName));
    if (await this.exists(embeddedUri)) {
      return { name: pkgName, version: 'embedded', rootUri: embeddedUri, sourceType: 'embedded' };
    }

    // 3. Project Library PackageCache Resolution: Library/PackageCache/com.unity.foo@1.0.0
    const packageCacheDir = path.join(this.workspaceRoot, 'Library', 'PackageCache');
    const cachedPkgUri = await this.findMatchingInPackageCache(packageCacheDir, pkgName);
    if (cachedPkgUri) {
      return { name: pkgName, version: versionOrPath, rootUri: cachedPkgUri, sourceType: 'registry' };
    }

    // 4. Fallback to Global Unity Package Cache
    const globalCacheUri = await this.findInGlobalCache(pkgName, versionOrPath);
    if (globalCacheUri) {
      return { name: pkgName, version: versionOrPath, rootUri: globalCacheUri, sourceType: 'registry' };
    }

    return undefined;
  }

  private async findMatchingInPackageCache(cacheDir: string, pkgName: string): Promise<vscode.Uri | undefined> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(cacheDir));
      for (const [folderName, type] of entries) {
        if (type === vscode.FileType.Directory && folderName.startsWith(`${pkgName}@`)) {
          return vscode.Uri.file(path.join(cacheDir, folderName));
        }
      }
    } catch {}
    return undefined;
  }

  private async findInGlobalCache(pkgName: string, version: string): Promise<vscode.Uri | undefined> {
    const userHome = os.homedir();
    const globalPaths = [
      path.join(userHome, '.library', 'Unity', 'cache', 'packages', 'packages.unity.com', `${pkgName}@${version}`),
      path.join(userHome, 'AppData', 'Local', 'Unity', 'cache', 'packages', 'packages.unity.com', `${pkgName}@${version}`)
    ];

    for (const gPath of globalPaths) {
      const uri = vscode.Uri.file(gPath);
      if (await this.exists(uri)) {
        return uri;
      }
    }
    return undefined;
  }

  private async exists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }
}
