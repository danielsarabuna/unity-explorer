import * as crypto from 'crypto';

export function generateUnityGuid(): string {
  return crypto.randomBytes(16).toString('hex').toLowerCase();
}

export function generateMetaContent(isFolder: boolean, isCSharpScript: boolean = false): string {
  const guid = generateUnityGuid();
  
  if (isFolder) {
    return `fileFormatVersion: 2
guid: ${guid}
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
  }

  if (isCSharpScript) {
    return `fileFormatVersion: 2
guid: ${guid}
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
  }

  return `fileFormatVersion: 2
guid: ${guid}
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
}
