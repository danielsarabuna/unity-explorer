const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Building Unity Explorer extension bundle...');
execSync(`node "${path.join(rootDir, 'esbuild.js')}" --production`, { stdio: 'inherit', cwd: rootDir });

console.log('📦 Packaging extension into .vsix file...');
try {
  execSync('npx vsce package --no-dependencies -o unity-explorer.vsix', { stdio: 'inherit', cwd: rootDir });
  console.log('\n✅ Created VSIX package: unity-explorer.vsix');
} catch (err) {
  console.warn('⚠️ vsce packaging note:', err.message);
}

// Target extensions directories for Antigravity IDE, VS Code, and Cursor
const homeDir = os.homedir();
const targetDirs = [
  path.join(homeDir, '.antigravity-ide', 'extensions', 'danielsarabuna.unity-explorer-1.0.0'),
  path.join(homeDir, '.antigravity-ide', 'extensions', 'unity-explorer'),
  path.join(homeDir, '.vscode', 'extensions', 'unity-explorer'),
  path.join(homeDir, '.cursor', 'extensions', 'unity-explorer')
];

console.log('\n🔄 Syncing extension build to local IDE extension directories...');
for (const targetDir of targetDirs) {
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.cpSync(path.join(rootDir, 'dist'), path.join(targetDir, 'dist'), { recursive: true });
    fs.cpSync(path.join(rootDir, 'package.json'), path.join(targetDir, 'package.json'));
    if (fs.existsSync(path.join(rootDir, 'resources'))) {
      fs.cpSync(path.join(rootDir, 'resources'), path.join(targetDir, 'resources'), { recursive: true });
    }
    console.log(`  -> Installed/Updated: ${targetDir}`);
  } catch (err) {
    console.warn(`  -> Skipping ${targetDir}: ${err.message}`);
  }
}

console.log('\n🎉 Pipeline complete! You can now use unity-explorer.vsix or restart your IDE to apply changes.');
