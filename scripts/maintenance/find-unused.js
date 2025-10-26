/**
 * Best-effort static analyzer to detect unused files in the repo.
 * SAFE: Only reads files and produces a JSON report - no modifications.
 * Outputs: scripts/maintenance/unused-report.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const REPORT_PATH = path.join(__dirname, 'unused-report.json');

// Directories to exclude from analysis
const EXCLUDED_DIRS = [
  'node_modules', '.git', 'dist', 'build', 'archive', 'coverage',
  '.github', '.vscode', '.idea', 'public/assets', 'img', 'assets'
];

// File extensions to analyze
const SOURCE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];
const ASSET_EXTENSIONS = ['.css', '.scss', '.less', '.json', '.md'];

function shouldExclude(filePath) {
  const relativePath = path.relative(ROOT, filePath);
  return EXCLUDED_DIRS.some(dir => relativePath.startsWith(dir + path.sep) || relativePath.includes(path.sep + dir + path.sep));
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (shouldExclude(fullPath)) return;
    
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      const ext = path.extname(file);
      if (SOURCE_EXTENSIONS.includes(ext) || ASSET_EXTENSIONS.includes(ext)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });
  return arrayOfFiles;
}

function extractImports(content) {
  const imports = new Set();
  
  // ES6 imports: import ... from '...'
  const es6ImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = es6ImportRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }
  
  // Dynamic imports: import('...')
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }
  
  // Require: require('...')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }
  
  return Array.from(imports);
}

function resolveImportPath(importPath, fromFile) {
  // Skip external packages
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) return null;
  
  const fromDir = path.dirname(fromFile);
  let resolved = path.resolve(fromDir, importPath);
  
  // Try with extensions if not found
  if (!fs.existsSync(resolved)) {
    for (const ext of SOURCE_EXTENSIONS) {
      const withExt = resolved + ext;
      if (fs.existsSync(withExt)) return withExt;
    }
    // Try index files
    for (const ext of SOURCE_EXTENSIONS) {
      const indexFile = path.join(resolved, 'index' + ext);
      if (fs.existsSync(indexFile)) return indexFile;
    }
  } else if (fs.statSync(resolved).isDirectory()) {
    // Try index files in directory
    for (const ext of SOURCE_EXTENSIONS) {
      const indexFile = path.join(resolved, 'index' + ext);
      if (fs.existsSync(indexFile)) return indexFile;
    }
  }
  
  return fs.existsSync(resolved) ? resolved : null;
}

function analyzeUsage() {
  console.log('Scanning repository for unused files...');
  
  const allFiles = getAllFiles(ROOT);
  console.log(`Found ${allFiles.length} files to analyze`);
  
  const referencedFiles = new Set();
  
  // Always consider entry points as used
  const entryPoints = [
    path.join(ROOT, 'index.html'),
    path.join(ROOT, 'src/main.js'),
    path.join(ROOT, 'src/main.jsx'),
    path.join(ROOT, 'src/main.ts'),
    path.join(ROOT, 'src/main.tsx'),
    path.join(ROOT, 'src/App.js'),
    path.join(ROOT, 'src/App.jsx'),
    path.join(ROOT, 'vite.config.js'),
    path.join(ROOT, 'package.json'),
    path.join(ROOT, 'server.js'),
  ];
  
  entryPoints.forEach(entry => {
    if (fs.existsSync(entry)) {
      referencedFiles.add(entry);
    }
  });
  
  // Analyze each file for imports
  allFiles.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const imports = extractImports(content);
      
      imports.forEach(imp => {
        const resolved = resolveImportPath(imp, file);
        if (resolved) {
          referencedFiles.add(resolved);
        }
      });
    } catch (err) {
      console.warn(`Warning: Could not read ${file}: ${err.message}`);
    }
  });
  
  // Find unused files
  const unused = allFiles.filter(file => !referencedFiles.has(file));
  
  // Convert to relative paths for readability
  const unusedRelative = unused.map(f => path.relative(ROOT, f));
  
  const report = {
    timestamp: new Date().toISOString(),
    total_files: allFiles.length,
    referenced_files: referencedFiles.size,
    unused_files: unused.length,
    unused: unusedRelative,
    notes: [
      'This is a best-effort static analysis.',
      'Dynamic imports and runtime references may be missed.',
      'Always review the list before archiving any files.',
      'Configuration files, docs, and assets may appear unused but could be required.'
    ]
  };
  
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nReport written to: ${REPORT_PATH}`);
  console.log(`Total files analyzed: ${report.total_files}`);
  console.log(`Referenced files: ${report.referenced_files}`);
  console.log(`Potentially unused files: ${report.unused_files}`);
  
  if (report.unused_files > 0) {
    console.log('\nFirst 10 potentially unused files:');
    unusedRelative.slice(0, 10).forEach(f => console.log(`  - ${f}`));
  }
  
  return report;
}

// Run analysis
try {
  analyzeUsage();
} catch (err) {
  console.error('Error during analysis:', err);
  process.exit(1);
}
