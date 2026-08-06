export const Uri = {
  file: (path: string) => ({ fsPath: path, path, scheme: 'file', toString: () => `file://${path}` }),
  parse: (str: string) => ({ fsPath: str.replace('file://', ''), path: str, scheme: 'file', toString: () => str })
};

export const RelativePattern = class {
  constructor(public base: string, public pattern: string) {}
};

export const Position = class {
  constructor(public line: number, public character: number) {}
};

export const Range = class {
  constructor(public start: any, public end: any) {}
};

export const workspace = {
  findFiles: async (include: string, exclude?: string) => [],
  workspaceFolders: [{ uri: Uri.file('/dummy') }]
};

export const window = {
  showInformationMessage: async () => {},
  showWarningMessage: async () => {},
  showErrorMessage: async () => {},
  withProgress: async (opts: any, task: any) => task({ report: () => {} }),
  createWebviewPanel: () => ({
    webview: {
      html: '',
      postMessage: async () => {},
      onDidReceiveMessage: () => ({ dispose: () => {} })
    },
    reveal: () => {},
    onDidDispose: () => ({ dispose: () => {} }),
    dispose: () => {}
  })
};

export const ViewColumn = {
  Active: 1,
  Beside: 2
};
