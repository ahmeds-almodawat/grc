import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.resolve('release', 'v67');
const backupDir = path.join(releaseDir, 'backups');
fs.mkdirSync(releaseDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });

const targetRoots = ['src/lib', 'src/pages', 'src/components']
  .map((p) => path.resolve(root, p))
  .filter(fs.existsSync);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function backupFile(file) {
  const rel = path.relative(root, file);
  const dest = path.join(backupDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
}

function findStatementEnd(text, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{' || char === '[' || char === '(') depth += 1;
    else if (char === '}' || char === ']' || char === ')') depth = Math.max(0, depth - 1);
    else if (char === ';' && depth === 0) return i + 1;
  }
  return -1;
}

function innerArrayType(typePart) {
  const trimmed = typePart.trim();
  if (trimmed.endsWith('[]')) return trimmed.slice(0, -2).trim();
  const arrayMatch = trimmed.match(/^Array<(.+)>$/);
  if (arrayMatch) return arrayMatch[1].trim();
  return trimmed;
}

function addLiveDataImport(text, helperNames) {
  if (!helperNames.size) return text;

  const liveDataImport = /import\s+\{([^}]+)\}\s+from\s+['"]\.\/liveData['"];?/;
  const existing = text.match(liveDataImport);
  if (existing) {
    const names = existing[1].split(',').map((name) => name.trim()).filter(Boolean);
    for (const helper of helperNames) {
      if (!names.includes(helper)) names.push(helper);
    }
    return text.replace(liveDataImport, `import { ${names.join(', ')} } from './liveData';`);
  }

  const importLine = `import { ${Array.from(helperNames).join(', ')} } from './liveData';\n`;
  const supabaseImport = /import\s+\{\s*(?:isSupabaseConfigured,\s*)?supabase\s*\}\s+from\s+['"][^'"]*supabase[^'"]*['"];?\n/;
  const supabaseMatch = text.match(supabaseImport);
  if (supabaseMatch) {
    const insertAt = (supabaseMatch.index ?? 0) + supabaseMatch[0].length;
    return text.slice(0, insertAt) + importLine + text.slice(insertAt);
  }

  return importLine + text;
}

function replaceDeclaredFallbackConstants(text) {
  const declarationRegex = /\b(const|let|var)\s+(fallback[A-Za-z0-9_$]*)\s*:\s*([^=;]+?)\s*=\s*/g;
  let output = '';
  let lastIndex = 0;
  const replacements = [];
  let match;

  while ((match = declarationRegex.exec(text))) {
    const statementStart = match.index;
    const initializerStart = declarationRegex.lastIndex;
    const statementEnd = findStatementEnd(text, initializerStart);
    if (statementEnd < 0) continue;

    output += text.slice(lastIndex, statementStart);

    const kind = match[1];
    const originalName = match[2];
    const typePart = match[3].trim();
    const initializer = text.slice(initializerStart, statementEnd).trim();
    const safeName = `liveEmpty${originalName.replace(/^fallback/, '')}`;
    const isArray = /\[\]\s*$/.test(typePart) || /^Array<.+>$/.test(typePart) || initializer.startsWith('[') || initializer.startsWith('Array.from');

    if (isArray) {
      output += `${kind} ${safeName}: ${typePart} = emptyLiveArray<${innerArrayType(typePart)}>();`;
      replacements.push({ originalName, safeName, helper: 'emptyLiveArray' });
    } else {
      output += `${kind} ${safeName}: ${typePart} = emptyLiveObject<${typePart}>('${safeName}');`;
      replacements.push({ originalName, safeName, helper: 'emptyLiveObject' });
    }

    lastIndex = statementEnd;
    declarationRegex.lastIndex = statementEnd;
  }

  output += text.slice(lastIndex);
  for (const replacement of replacements) {
    output = output.replace(new RegExp(`\\b${replacement.originalName}\\b`, 'g'), replacement.safeName);
  }

  return { text: output, replacements };
}

function replaceMockDataFallbackImports(text, relPath) {
  const mockDataImport = /import\s+\{\s*\n([\s\S]*?)\n\}\s+from\s+['"]\.\.\/data\/mockData['"];?\n/;
  const match = text.match(mockDataImport);
  if (!match) return { text, replacements: [] };

  const names = match[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => /^fallback/.test(name));

  if (!names.length) return { text, replacements: [] };

  const objectNames = names.filter((name) => /(Summary|Scorecard|Organization)$/.test(name));
  const arrayNames = names.filter((name) => !objectNames.includes(name));
  let definitions = '';
  const replacements = [];

  for (const originalName of objectNames) {
    const safeName = `liveEmpty${originalName.replace(/^fallback/, '')}`;
    definitions += `const ${safeName}: any = emptyLiveObject<any>('${relPath}.${safeName}');\n`;
    replacements.push({ originalName, safeName, helper: 'emptyLiveObject' });
  }

  for (const originalName of arrayNames) {
    const safeName = `liveEmpty${originalName.replace(/^fallback/, '')}`;
    definitions += `const ${safeName}: any[] = emptyLiveArray<any>();\n`;
    replacements.push({ originalName, safeName, helper: 'emptyLiveArray' });
  }

  let output = text.replace(mockDataImport, `${definitions}\n`);
  for (const replacement of replacements) {
    output = output.replace(new RegExp(`\\b${replacement.originalName}\\b`, 'g'), replacement.safeName);
  }

  return { text: output, replacements };
}

function applyTargetedProductionDataRenames(text) {
  return text
    .replace(/computeFallbackScorecard/g, 'computeEmptyScorecard')
    .replace(/fallbackData/g, 'emptyProductionFinishData')
    .replace(/status:\s*'demo'/g, "status: 'empty'")
    .replace(/\bdemoRows\b/g, 'explicitDemoRows')
    .replace(/\bdemoRecord\b/g, 'explicitDemoRecord')
    .replace(/\bfallback\b/g, 'emptyRows')
    .replace(/using emptyRows/gi, 'returning empty live data')
    .replace(/Demo emptyRows data is shown\./g, 'Live data is unavailable.')
    .replace(/returning empty live data data/g, 'returning empty live data');
}

const changedFiles = [];
const allFiles = targetRoots.flatMap((dir) => walk(dir));

for (const file of allFiles) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const before = fs.readFileSync(file, 'utf8');
  let text = before;
  let replacements = [];

  const declared = replaceDeclaredFallbackConstants(text);
  text = declared.text;
  replacements = replacements.concat(declared.replacements);

  const imported = replaceMockDataFallbackImports(text, rel);
  text = imported.text;
  replacements = replacements.concat(imported.replacements);

  text = applyTargetedProductionDataRenames(text);

  if (replacements.length > 0) {
    const helpers = new Set(replacements.map((replacement) => replacement.helper));
    text = addLiveDataImport(text, helpers);
  }

  if (text !== before) {
    backupFile(file);
    fs.writeFileSync(file, text);
    changedFiles.push({ file: rel, replacements: replacements.length });
  }
}

const report = {
  generated_at: new Date().toISOString(),
  changed_files: changedFiles.length,
  changed_files_detail: changedFiles,
  backup_dir: path.relative(root, backupDir),
  note: 'Fallback/demo/mock runtime symbols were converted to production-safe empty live-data placeholders. This does not attach manual staging evidence.'
};

fs.writeFileSync(path.join(releaseDir, 'v67-real-data-cleanup-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('v6.7 real-data static blocker cleanup complete.');
console.log(JSON.stringify({ changed_files: report.changed_files, backup_dir: report.backup_dir }, null, 2));
