var Q=Object.create;var S=Object.defineProperty;var X=Object.getOwnPropertyDescriptor;var Z=Object.getOwnPropertyNames;var K=Object.getPrototypeOf,q=Object.prototype.hasOwnProperty;var Y=(c,e)=>{for(var s in e)S(c,s,{get:e[s],enumerable:!0})},O=(c,e,s,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let t of Z(e))!q.call(c,t)&&t!==s&&S(c,t,{get:()=>e[t],enumerable:!(o=X(e,t))||o.enumerable});return c};var h=(c,e,s)=>(s=c!=null?Q(K(c)):{},O(e||!c||!c.__esModule?S(s,"default",{value:c,enumerable:!0}):s,c)),ee=c=>O(S({},"__esModule",{value:!0}),c);var re={};Y(re,{activate:()=>se,deactivate:()=>oe});module.exports=ee(re);var i=h(require("vscode")),w=h(require("path"));var p=h(require("vscode")),b=h(require("path"));var m=h(require("vscode")),D=h(require("path")),y=class extends m.TreeItem{constructor(s,o,t,a,l=!1,r){super(s,a);this.label=s;this.uri=o;this.itemType=t;this.collapsibleState=a;this.isReadOnly=l;this.packageInfo=r;this.resourceUri=o,this.tooltip=`${o.fsPath}${l?" (Read-Only Package Asset)":""}`,(t==="asset"||t==="folder")&&(this.metaUri=m.Uri.file(`${o.fsPath}.meta`)),this.contextValue=this.deriveContextValue(),this.iconPath=this.deriveIcon(),!l&&(t==="asset"||t==="packageAsset"||t==="metaFile")&&(this.command={command:"vscode.open",title:"Open File",arguments:[o]})}metaUri;deriveContextValue(){if(this.isReadOnly)return this.itemType==="package"?"unityPackageReadOnly":"unityAssetReadOnly";switch(this.itemType){case"assetsRoot":return"unityAssetsRoot";case"folder":return"unityFolder";case"asset":return"unityAsset";case"metaFile":return"unityMetaFile";case"packageRoot":return"unityPackageRoot";case"package":return"unityPackage";case"projectSettingsRoot":return"unityProjectSettingsRoot";case"logsRoot":return"unityLogsRoot";case"libraryRoot":return"unityLibraryRoot";case"tempRoot":return"unityTempRoot";default:return"unityAsset"}}deriveIcon(){if(this.itemType==="assetsRoot")return new m.ThemeIcon("root-folder");if(this.itemType==="packageRoot")return new m.ThemeIcon("archive");if(this.itemType==="projectSettingsRoot")return new m.ThemeIcon("settings-gear");if(this.itemType==="logsRoot")return new m.ThemeIcon("output");if(this.itemType==="libraryRoot"||this.itemType==="tempRoot")return new m.ThemeIcon("server-environment");if(this.itemType==="package")return new m.ThemeIcon("package");if(this.itemType==="metaFile")return new m.ThemeIcon("key");if(this.itemType==="folder"||this.itemType==="packageFolder"){let o=D.basename(this.uri.fsPath).toLowerCase();return o==="editor"?new m.ThemeIcon("tools"):o==="resources"?new m.ThemeIcon("database"):o==="plugins"?new m.ThemeIcon("plug"):m.ThemeIcon.Folder}switch(D.extname(this.uri.fsPath).toLowerCase()){case".cs":return new m.ThemeIcon("symbol-class");case".prefab":return new m.ThemeIcon("symbol-structure");case".mat":return new m.ThemeIcon("symbol-color");case".unity":return new m.ThemeIcon("symbol-event");case".shader":case".shadergraph":return new m.ThemeIcon("symbol-misc");case".anim":return new m.ThemeIcon("symbol-key");case".controller":return new m.ThemeIcon("circuit-board");case".asmdef":return new m.ThemeIcon("extensions");case".png":case".jpg":case".psd":case".tga":return new m.ThemeIcon("file-media");case".mp3":case".wav":case".ogg":return new m.ThemeIcon("device-camera-video");case".json":case".asset":return new m.ThemeIcon("json");case".meta":return new m.ThemeIcon("key");default:return m.ThemeIcon.File}}};var R=class{constructor(e,s){this.workspaceRoot=e;this.packageManager=s;this.loadConfiguration(),p.workspace.onDidChangeConfiguration(o=>{o.affectsConfiguration("unityExplorer")&&(this.loadConfiguration(),this.refresh())})}_onDidChangeTreeData=new p.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;refreshDebounceTimer;showMetaFiles=!1;showLogs=!1;showLibrary=!1;showTemp=!1;showPackages=!0;showProjectSettings=!0;excludedPatterns=[];loadConfiguration(){let e=p.workspace.getConfiguration("unityExplorer");this.showMetaFiles=e.get("showMetaFiles",!1),this.showLogs=e.get("showLogs",!1),this.showLibrary=e.get("showLibrary",!1),this.showTemp=e.get("showTemp",!1),this.showPackages=e.get("showPackages",!0),this.showProjectSettings=e.get("showProjectSettings",!0),this.excludedPatterns=e.get("excludedPatterns",["**/.git/**","**/obj/**","**/bin/**"])}refresh(e){this.refreshDebounceTimer&&clearTimeout(this.refreshDebounceTimer),this.refreshDebounceTimer=setTimeout(()=>{this._onDidChangeTreeData.fire(e)},150)}getTreeItem(e){return e}async getChildren(e){if(!this.workspaceRoot)return[];if(!e){let s=[],o=p.Uri.file(b.join(this.workspaceRoot,"Assets"));try{await p.workspace.fs.stat(o),s.push(new y("Assets",o,"assetsRoot",p.TreeItemCollapsibleState.Expanded))}catch{}if(this.showPackages){let t=p.Uri.file(b.join(this.workspaceRoot,"Packages"));s.push(new y("Packages",t,"packageRoot",p.TreeItemCollapsibleState.Collapsed))}if(this.showProjectSettings){let t=p.Uri.file(b.join(this.workspaceRoot,"ProjectSettings"));try{await p.workspace.fs.stat(t),s.push(new y("ProjectSettings",t,"projectSettingsRoot",p.TreeItemCollapsibleState.Collapsed))}catch{}}if(this.showLogs){let t=p.Uri.file(b.join(this.workspaceRoot,"Logs"));try{await p.workspace.fs.stat(t),s.push(new y("Logs",t,"logsRoot",p.TreeItemCollapsibleState.Collapsed))}catch{}}if(this.showLibrary){let t=p.Uri.file(b.join(this.workspaceRoot,"Library"));try{await p.workspace.fs.stat(t),s.push(new y("Library",t,"libraryRoot",p.TreeItemCollapsibleState.Collapsed))}catch{}}if(this.showTemp){let t=p.Uri.file(b.join(this.workspaceRoot,"Temp"));try{await p.workspace.fs.stat(t),s.push(new y("Temp",t,"tempRoot",p.TreeItemCollapsibleState.Collapsed))}catch{}}return s}return e.itemType==="packageRoot"?(await this.packageManager.getResolvedPackages()).map(o=>new y(`${o.name} @ ${o.version}`,o.rootUri,"package",p.TreeItemCollapsibleState.Collapsed,!0,{name:o.name,version:o.version,sourceType:o.sourceType})):this.getDirectoryChildren(e.uri,e.isReadOnly)}async getDirectoryChildren(e,s){try{let o=await p.workspace.fs.readDirectory(e),t=[];for(let[a,l]of o){if(this.isExcluded(a))continue;let r=p.Uri.file(b.join(e.fsPath,a)),n=l===p.FileType.Directory,d=a.endsWith(".meta"),u;s?u=n?"packageFolder":"packageAsset":n?u="folder":d?u="metaFile":u="asset",t.push(new y(a,r,u,n?p.TreeItemCollapsibleState.Collapsed:p.TreeItemCollapsibleState.None,s))}return t.sort((a,l)=>{let r=a.collapsibleState!==p.TreeItemCollapsibleState.None,n=l.collapsibleState!==p.TreeItemCollapsibleState.None;return r&&!n?-1:!r&&n?1:a.label.localeCompare(l.label,void 0,{sensitivity:"base"})})}catch{return[]}}isExcluded(e){return e.endsWith(".meta")&&!this.showMetaFiles||e.startsWith(".")&&e!==".gitignore"||e==="Logs"&&!this.showLogs||e==="Library"&&!this.showLibrary||e==="Temp"&&!this.showTemp?!0:["obj","bin"].includes(e)}};var k=h(require("vscode")),V=h(require("path")),M=class{constructor(e){this.metaSyncEngine=e}dropMimeTypes=["application/vnd.code.tree.unityExplorer","text/uri-list"];dragMimeTypes=["application/vnd.code.tree.unityExplorer"];async handleDrag(e,s,o){let t=e.filter(l=>!l.isReadOnly&&l.itemType!=="packageRoot");if(t.length===0)return;let a=t.map(l=>l.uri.toString());s.set("application/vnd.code.tree.unityExplorer",new k.DataTransferItem(a))}async handleDrop(e,s,o){let t=s.get("application/vnd.code.tree.unityExplorer");if(!t)return;let l=t.value.map(n=>k.Uri.parse(n));if(!e)return;if(e.isReadOnly){k.window.showWarningMessage("Cannot drop assets into read-only Package directories.");return}let r;e.itemType==="folder"||e.itemType==="assetsRoot"||e.itemType==="packageRoot"?r=e.uri:r=k.Uri.file(V.dirname(e.uri.fsPath));try{await this.metaSyncEngine.moveAssets(l,r)}catch(n){k.window.showErrorMessage(`Drag & Drop failed: ${n.message}`)}}};var f=h(require("vscode")),x=h(require("path"));var _=h(require("crypto"));function te(){return _.randomBytes(16).toString("hex").toLowerCase()}function B(c,e=!1){let s=te();return c?`fileFormatVersion: 2
guid: ${s}
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`:e?`fileFormatVersion: 2
guid: ${s}
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`:`fileFormatVersion: 2
guid: ${s}
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`}var $=class{async renameAsset(e,s){let o=x.dirname(e.fsPath),t=f.Uri.file(x.join(o,s)),a=f.Uri.file(`${e.fsPath}.meta`),l=f.Uri.file(`${t.fsPath}.meta`),r=await this.fileExists(a);if(await f.workspace.fs.rename(e,t,{overwrite:!1}),r)try{await f.workspace.fs.rename(a,l,{overwrite:!1})}catch(n){throw await f.workspace.fs.rename(t,e,{overwrite:!0}),new Error(`Failed to rename associated .meta file (${n.message}). Operation rolled back.`)}else{let d=((await f.workspace.fs.stat(t)).type&f.FileType.Directory)!==0;await this.createMetaFile(t,d,t.fsPath.endsWith(".cs"))}}async moveAssets(e,s){for(let o of e){let t=x.basename(o.fsPath),a=f.Uri.file(x.join(s.fsPath,t));if(o.fsPath===a.fsPath)continue;let l=f.Uri.file(`${o.fsPath}.meta`),r=f.Uri.file(`${a.fsPath}.meta`),n=await this.fileExists(l);if(await f.workspace.fs.rename(o,a,{overwrite:!1}),n)try{await f.workspace.fs.rename(l,r,{overwrite:!1})}catch(d){throw await f.workspace.fs.rename(a,o,{overwrite:!0}),new Error(`Failed to move .meta file for ${t}: ${d.message}. Operation rolled back.`)}}}async deleteAssets(e,s=!0){for(let o of e){let t=f.Uri.file(`${o.fsPath}.meta`),a=await this.fileExists(t);if(await f.workspace.fs.delete(o,{recursive:!0,useTrash:s}),a)try{await f.workspace.fs.delete(t,{recursive:!1,useTrash:s})}catch(l){f.window.showWarningMessage(`Asset deleted, but failed to delete .meta file: ${l.message}`)}}}async createAsset(e,s,o=!1,t=!1){if(o)await f.workspace.fs.createDirectory(e);else{let a=new TextEncoder;await f.workspace.fs.writeFile(e,a.encode(s))}await this.createMetaFile(e,o,t)}async createMetaFile(e,s,o){let t=f.Uri.file(`${e.fsPath}.meta`);if(await this.fileExists(t))return;let a=B(s,o),l=new TextEncoder;await f.workspace.fs.writeFile(t,l.encode(a))}async fileExists(e){try{return await f.workspace.fs.stat(e),!0}catch{return!1}}};var g=h(require("vscode")),T=h(require("path")),W=h(require("os")),E=class{constructor(e){this.workspaceRoot=e}async getResolvedPackages(){let e=g.Uri.file(T.join(this.workspaceRoot,"Packages","manifest.json")),s={};try{let a=await g.workspace.fs.readFile(e);s=JSON.parse(new TextDecoder().decode(a))}catch{return[]}let o=s.dependencies||{},t=[];for(let[a,l]of Object.entries(o)){let r=await this.resolvePackageLocation(a,l);r&&t.push(r)}return t.sort((a,l)=>a.name.localeCompare(l.name))}async resolvePackageLocation(e,s){if(s.startsWith("file:")){let r=s.replace("file:",""),n=T.resolve(this.workspaceRoot,"Packages",r),d=g.Uri.file(n);if(await this.exists(d))return{name:e,version:"local",rootUri:d,sourceType:"local"}}let o=g.Uri.file(T.join(this.workspaceRoot,"Packages",e));if(await this.exists(o))return{name:e,version:"embedded",rootUri:o,sourceType:"embedded"};let t=T.join(this.workspaceRoot,"Library","PackageCache"),a=await this.findMatchingInPackageCache(t,e);if(a)return{name:e,version:s,rootUri:a,sourceType:"registry"};let l=await this.findInGlobalCache(e,s);if(l)return{name:e,version:s,rootUri:l,sourceType:"registry"}}async findMatchingInPackageCache(e,s){try{let o=await g.workspace.fs.readDirectory(g.Uri.file(e));for(let[t,a]of o)if(a===g.FileType.Directory&&t.startsWith(`${s}@`))return g.Uri.file(T.join(e,t))}catch{}}async findInGlobalCache(e,s){let o=W.homedir(),t=[T.join(o,".library","Unity","cache","packages","packages.unity.com",`${e}@${s}`),T.join(o,"AppData","Local","Unity","cache","packages","packages.unity.com",`${e}@${s}`)];for(let a of t){let l=g.Uri.file(a);if(await this.exists(l))return l}}async exists(e){try{return await g.workspace.fs.stat(e),!0}catch{return!1}}};var j=h(require("path")),U=class{static deriveNamespace(e,s){let t=j.relative(e,s).split(j.sep).filter(a=>a&&a!=="Assets"&&a!=="Scripts").map(a=>a.replace(/[^a-zA-Z0-9_]/g,""));return t.length===0?"Project":t.join(".")}static getMonoBehaviourTemplate(e,s){return{filename:`${e}.cs`,content:`using UnityEngine;

namespace ${s}
{
    public class ${e} : MonoBehaviour
    {
        private void Start()
        {
            
        }

        private void Update()
        {
            
        }
    }
}
`,isFolder:!1,isCSharp:!0}}static getScriptableObjectTemplate(e,s){return{filename:`${e}.cs`,content:`using UnityEngine;

namespace ${s}
{
    [CreateAssetMenu(fileName = "${e}", menuName = "${s}/${e}", order = 0)]
    public class ${e} : ScriptableObject
    {
        
    }
}
`,isFolder:!1,isCSharp:!0}}static getUnlitShaderTemplate(e){return{filename:`${e}.shader`,content:`Shader "Custom/${e}"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 100

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 vertex : SV_POSITION;
            };

            sampler2D _MainTex;
            float4 _MainTex_ST;

            v2f vert (appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 col = tex2D(_MainTex, i.uv);
                return col;
            }
            ENDCG
        }
    }
}
`,isFolder:!1,isCSharp:!1}}static getAsmdefTemplate(e){return{filename:`${e}.asmdef`,content:JSON.stringify({name:e,rootNamespace:e,references:[],includePlatforms:[],excludePlatforms:[],allowUnsafeCode:!1,overrideReferences:!1,precompiledReferences:[],autoReferenced:!0,defineConstraints:[],versionDefines:[],noEngineReferences:!1},null,4),isFolder:!1,isCSharp:!1}}static getMaterialTemplate(e){return{filename:`${e}.mat`,content:`%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!21 &2100000
Material:
  serializedVersion: 8
  m_Name: ${e}
  m_Shader: {fileID: 4800000, guid: 0000000000000000f000000000000000, type: 0}
  m_ValidKeywords: []
  m_InvalidKeywords: []
`,isFolder:!1,isCSharp:!1}}};var F=h(require("vscode"));function G(c,e,s){let o=new F.RelativePattern(e,"{Assets,Packages,ProjectSettings,Logs,Library,Temp}/**/*"),t=F.workspace.createFileSystemWatcher(o),a=()=>s.refresh();t.onDidCreate(a),t.onDidChange(a),t.onDidDelete(a),c.subscriptions.push(t)}var H=h(require("vscode")),L=h(require("fs")),N=h(require("path"));async function z(c){let e=L.existsSync(N.join(c,"Assets")),s=L.existsSync(N.join(c,"ProjectSettings")),o=e||s;return await H.commands.executeCommand("setContext","unityExplorer:isUnityProject",o),o}async function se(c){let e=i.workspace.workspaceFolders?.[0]?.uri.fsPath;if(!e)return;await z(e);let s=new $,o=new E(e),t=new R(e,o),a=new M(s),l=i.window.createTreeView("unityExplorer",{treeDataProvider:t,dragAndDropController:a,canSelectMany:!0});G(c,e,t),c.subscriptions.push(i.workspace.onWillRenameFiles(async r=>{if(i.workspace.getConfiguration("unityExplorer").get("autoSyncMeta",!0))for(let d of r.files){let u=i.Uri.file(`${d.oldUri.fsPath}.meta`),v=i.Uri.file(`${d.newUri.fsPath}.meta`);if(await s.fileExists(u)){let P=new i.WorkspaceEdit;P.renameFile(u,v,{overwrite:!0,ignoreIfExists:!1}),await i.workspace.applyEdit(P)}}})),c.subscriptions.push(l,i.commands.registerCommand("unityExplorer.refresh",()=>{t.refresh()}),i.commands.registerCommand("unityExplorer.toggleVisibilitySettings",async()=>{let r=i.workspace.getConfiguration("unityExplorer"),n=r.get("showMetaFiles",!1),d=r.get("showLogs",!1),u=r.get("showLibrary",!1),v=r.get("showTemp",!1),P=r.get("showPackages",!0),C=r.get("showProjectSettings",!0),J=[{label:`${n?"$(check)":"$(blank)"} Show .meta Files`,description:"Display raw .meta files in the explorer tree",key:"showMetaFiles",current:n},{label:`${d?"$(check)":"$(blank)"} Show Logs Folder`,description:"Display Unity engine Logs/ folder",key:"showLogs",current:d},{label:`${u?"$(check)":"$(blank)"} Show Library Folder`,description:"Display Unity cache Library/ folder",key:"showLibrary",current:u},{label:`${v?"$(check)":"$(blank)"} Show Temp Folder`,description:"Display Unity build Temp/ folder",key:"showTemp",current:v},{label:`${P?"$(check)":"$(blank)"} Show Packages`,description:"Display Unity Package Manager packages",key:"showPackages",current:P},{label:`${C?"$(check)":"$(blank)"} Show ProjectSettings`,description:"Display Unity engine settings folder",key:"showProjectSettings",current:C}],A=await i.window.showQuickPick(J,{placeHolder:"Toggle Explorer Visibility Settings"});A&&(await r.update(A.key,!A.current,i.ConfigurationTarget.Workspace),t.loadConfiguration(),t.refresh())}),i.commands.registerCommand("unityExplorer.switchViewMode",async()=>{let r=await i.window.showQuickPick([{label:"$(symbol-namespace) Unity View",description:"Clean Unity domain tree (Assets, Packages, Settings)",mode:"unity"},{label:"$(files) File System View",description:"Raw disk file tree",mode:"allFiles"},{label:"$(project) Solution View",description:"C# Assemblies & Solution references",mode:"solution"}],{placeHolder:"Select View Mode"});r&&(r.mode==="allFiles"?await i.commands.executeCommand("workbench.view.explorer"):i.window.showInformationMessage(`Switched to ${r.label}`))}),i.commands.registerCommand("unityExplorer.createScript",async r=>{let n=I(r,e),d=await i.window.showInputBox({prompt:"Enter C# Script Name",placeHolder:"NewBehaviourScript",validateInput:C=>!C||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(C)?"Invalid C# class identifier.":null});if(!d)return;let u=i.Uri.file(w.join(n,`${d}.cs`)),v=U.deriveNamespace(e,n),P=U.getMonoBehaviourTemplate(d,v);await s.createAsset(u,P.content,!1,!0),t.refresh(),await i.window.showTextDocument(u)}),i.commands.registerCommand("unityExplorer.createFolder",async r=>{let n=I(r,e),d=await i.window.showInputBox({prompt:"Enter Folder Name",placeHolder:"NewFolder"});if(!d)return;let u=i.Uri.file(w.join(n,d));await s.createAsset(u,"",!0,!1),t.refresh()}),i.commands.registerCommand("unityExplorer.createShader",async r=>{let n=I(r,e),d=await i.window.showInputBox({prompt:"Enter Shader Name",placeHolder:"NewUnlitShader"});if(!d)return;let u=U.getUnlitShaderTemplate(d),v=i.Uri.file(w.join(n,u.filename));await s.createAsset(v,u.content,!1,!1),t.refresh(),await i.window.showTextDocument(v)}),i.commands.registerCommand("unityExplorer.createMaterial",async r=>{let n=I(r,e),d=await i.window.showInputBox({prompt:"Enter Material Name",placeHolder:"NewMaterial"});if(!d)return;let u=U.getMaterialTemplate(d),v=i.Uri.file(w.join(n,u.filename));await s.createAsset(v,u.content,!1,!1),t.refresh()}),i.commands.registerCommand("unityExplorer.createAsmdef",async r=>{let n=I(r,e),d=await i.window.showInputBox({prompt:"Enter Assembly Definition Name",placeHolder:"MyCompany.MyFeature"});if(!d)return;let u=U.getAsmdefTemplate(d),v=i.Uri.file(w.join(n,u.filename));await s.createAsset(v,u.content,!1,!1),t.refresh(),await i.window.showTextDocument(v)}),i.commands.registerCommand("unityExplorer.rename",async r=>{if(!r||r.isReadOnly)return;let n=w.basename(r.uri.fsPath),d=await i.window.showInputBox({prompt:"Enter new name",value:n});!d||d===n||(await s.renameAsset(r.uri,d),t.refresh())}),i.commands.registerCommand("unityExplorer.delete",async r=>{if(!r||r.isReadOnly)return;await i.window.showWarningMessage(`Are you sure you want to delete '${r.label}' and its associated .meta file?`,{modal:!0},"Delete")==="Delete"&&(await s.deleteAssets([r.uri]),t.refresh())}),i.commands.registerCommand("unityExplorer.revealInFinder",async r=>{let n=r?r.uri:i.Uri.file(w.join(e,"Assets"));await i.commands.executeCommand("revealFileInOS",n)}))}function I(c,e){return c?c.itemType==="folder"||c.itemType==="assetsRoot"?c.uri.fsPath:w.dirname(c.uri.fsPath):w.join(e,"Assets")}function oe(){}0&&(module.exports={activate,deactivate});
