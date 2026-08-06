import * as vscode from 'vscode';

// ═══ TYPES & KINDS ═══

export enum SymbolKind {
  // Types
  Class = 'Class',
  Struct = 'Struct',
  Interface = 'Interface',
  Enum = 'Enum',
  Record = 'Record',
  Delegate = 'Delegate',
  FileScopedType = 'FileScopedType',

  // Members
  Field = 'Field',
  Property = 'Property',
  Method = 'Method',
  Constructor = 'Constructor',
  Destructor = 'Destructor',
  Operator = 'Operator',
  Indexer = 'Indexer',
  Event = 'Event',
  EnumMember = 'EnumMember',
  Constant = 'Constant',
  LocalFunction = 'LocalFunction',

  // Special
  ExtensionMethod = 'ExtensionMethod',
  InitOnlySetter = 'InitOnlySetter',
  RequiredMember = 'RequiredMember',
  RegionMarker = 'RegionMarker'
}

export enum AccessModifier {
  Public = 'public',
  Private = 'private',
  Protected = 'protected',
  Internal = 'internal',
  ProtectedInternal = 'protected internal'
}

export enum UnityAttribute {
  // Serialization
  SerializeField = 'SerializeField',
  SerializeReference = 'SerializeReference',
  NonSerialized = 'NonSerialized',
  FormerlySerializedAs = 'FormerlySerializedAs',
  HideInInspector = 'HideInInspector',

  // Inspector Display
  Header = 'Header',
  Space = 'Space',
  Tooltip = 'Tooltip',
  Range = 'Range',
  Min = 'Min',
  Max = 'Max',
  Multiline = 'Multiline',
  TextArea = 'TextArea',
  ColorUsage = 'ColorUsage',
  GradientUsage = 'GradientUsage',
  Delayed = 'Delayed',

  // Component
  RequireComponent = 'RequireComponent',
  AddComponentMenu = 'AddComponentMenu',
  DisallowMultipleComponent = 'DisallowMultipleComponent',
  ExecuteInEditMode = 'ExecuteInEditMode',
  ExecuteAlways = 'ExecuteAlways',
  SelectionBase = 'SelectionBase',
  HelpURL = 'HelpURL',
  DefaultExecutionOrder = 'DefaultExecutionOrder',

  // Asset Creation
  CreateAssetMenu = 'CreateAssetMenu',

  // Editor
  CustomEditor = 'CustomEditor',
  CustomPropertyDrawer = 'CustomPropertyDrawer',
  CanEditMultipleObjects = 'CanEditMultipleObjects',
  MenuItem = 'MenuItem',
  InitializeOnLoad = 'InitializeOnLoad',
  InitializeOnLoadMethod = 'InitializeOnLoadMethod',
  RuntimeInitializeOnLoadMethod = 'RuntimeInitializeOnLoadMethod',

  // Other
  Preserve = 'Preserve',
  Il2CppSetOption = 'Il2CppSetOption',
  SyncVar = 'SyncVar',
  Command = 'Command',
  ClientRpc = 'ClientRpc',
  ServerRpc = 'ServerRpc',
  Serializable = 'Serializable',
  ContextMenu = 'ContextMenu'
}

export const UNITY_LIFECYCLE_METHODS = new Map<string, string>([
  ['Awake', 'Lifecycle'],
  ['OnEnable', 'Lifecycle'],
  ['Start', 'Lifecycle'],
  ['OnDisable', 'Lifecycle'],
  ['OnDestroy', 'Lifecycle'],
  ['OnApplicationQuit', 'Lifecycle'],
  ['OnApplicationPause', 'Lifecycle'],
  ['OnApplicationFocus', 'Lifecycle'],
  ['FixedUpdate', 'UpdateLoop'],
  ['Update', 'UpdateLoop'],
  ['LateUpdate', 'UpdateLoop'],
  ['OnCollisionEnter', 'Physics'],
  ['OnCollisionStay', 'Physics'],
  ['OnCollisionExit', 'Physics'],
  ['OnCollisionEnter2D', 'Physics'],
  ['OnCollisionStay2D', 'Physics'],
  ['OnCollisionExit2D', 'Physics'],
  ['OnTriggerEnter', 'Physics'],
  ['OnTriggerStay', 'Physics'],
  ['OnTriggerExit', 'Physics'],
  ['OnTriggerEnter2D', 'Physics'],
  ['OnTriggerStay2D', 'Physics'],
  ['OnTriggerExit2D', 'Physics'],
  ['OnControllerColliderHit', 'Physics'],
  ['OnJointBreak', 'Physics'],
  ['OnJointBreak2D', 'Physics'],
  ['OnParticleCollision', 'Physics'],
  ['OnMouseDown', 'Input'],
  ['OnMouseUp', 'Input'],
  ['OnMouseOver', 'Input'],
  ['OnMouseExit', 'Input'],
  ['OnMouseEnter', 'Input'],
  ['OnMouseDrag', 'Input'],
  ['OnBecameVisible', 'Rendering'],
  ['OnBecameInvisible', 'Rendering'],
  ['OnPreRender', 'Rendering'],
  ['OnPostRender', 'Rendering'],
  ['OnRenderImage', 'Rendering'],
  ['OnDrawGizmos', 'Gizmos'],
  ['OnDrawGizmosSelected', 'Gizmos'],
  ['OnGUI', 'GUI'],
  ['OnValidate', 'Validation'],
  ['Reset', 'Validation'],
  ['OnAnimatorMove', 'Animation'],
  ['OnAnimatorIK', 'Animation']
]);

// ═══ SYMBOL & FILE MODEL ═══

export interface CSharpSymbol {
  name: string;
  kind: SymbolKind;
  access: AccessModifier;

  line: number;           // 1-indexed
  column: number;         // 1-indexed
  endLine?: number;
  filePath: string;       // absolute path
  assemblyName?: string;  // "Assembly-CSharp", "MyGame.Core", etc.

  containerName?: string;
  containerKind?: SymbolKind;
  namespaceName?: string;
  nestingDepth: number;

  returnType?: string;
  fieldType?: string;
  parameters?: string;
  baseTypes?: string[];
  genericParams?: string;

  isStatic: boolean;
  isAbstract: boolean;
  isVirtual: boolean;
  isOverride: boolean;
  isReadonly: boolean;
  isConst: boolean;
  isSealed: boolean;
  isAsync: boolean;
  isPartial: boolean;
  isRequired: boolean;
  isFileScoped: boolean;

  attributes: UnityAttribute[];
  isUnityEventFunction: boolean;
  unityEventCategory?: string;
  isAutoSerialized: boolean;

  codeLine: string;
  docComment?: string;
}

export interface FileEntry {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  isReadOnly: boolean;
  assemblyName?: string;
}

export interface SearchResult {
  symbol?: CSharpSymbol;
  file?: FileEntry;
  score: number;
  matchRanges: [number, number][]; // pairs of [start, end] indices in name
}

// ═══ FILTERS & SCOPES ═══

export type LocationScope = 'solution' | 'project' | 'directory' | 'scope';
export type KindFilter = 'all' | 'types' | 'members' | 'files' | 'serialized';

export interface SearchFilters {
  locationScope: LocationScope;
  projectName?: string;       // for locationScope === 'project'
  directoryPath?: string;     // for locationScope === 'directory'
  scopeName?: string;         // for locationScope === 'scope'

  kindFilter: KindFilter;

  fileMask: string;           // "*.cs", "*.shader", "*.*", etc.
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  includeNonProjectItems: boolean;
}

export interface ScopeDefinition {
  name: string;
  includePatterns: string[];
  excludePatterns: string[];
  description?: string;
}

export interface ProjectInfo {
  name: string;
  type: 'csproj' | 'asmdef';
  rootDirectory: string;
  filePaths: Set<string>;
  isEditorOnly: boolean;
}

export interface SearchStats {
  totalResults: number;
  searchTimeMs: number;
  totalFiles: number;
  totalSymbols: number;
}

// ═══ WEBVIEW MESSAGES ═══

export type WebviewMessage =
  | { type: 'search'; query: string; filters: SearchFilters }
  | { type: 'navigate'; filePath: string; line: number; column: number }
  | { type: 'preview'; filePath: string; line: number }
  | { type: 'get-projects' }
  | { type: 'get-scopes' }
  | { type: 'pick-directory' }
  | { type: 'results'; items: SearchResult[]; stats: SearchStats }
  | { type: 'projects-list'; projects: { name: string; isEditorOnly: boolean }[] }
  | { type: 'scopes-list'; scopes: ScopeDefinition[] }
  | { type: 'directory-picked'; path: string }
  | { type: 'index-stats'; stats: SearchStats }
  | { type: 'indexing-progress'; percent: number; currentFile: string };
