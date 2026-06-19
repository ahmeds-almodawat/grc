import fs from 'fs';
import path from 'path';

const root = process.cwd();
const targets = [
  'src/lib/commandCenterApi.ts',
  'src/lib/grcApi.ts',
  'src/lib/operationsApi.ts',
  'src/lib/performanceApi.ts',
  'src/lib/releaseOpsApi.ts',
  'src/lib/securityApi.ts',
  'src/lib/testingApi.ts',
  'src/lib/v35ConsolidationApi.ts'
];

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let inString = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function addImportIfNeeded(text) {
  if (text.includes("emptyLiveObject")) return text;
  const importBlock = text.match(/^((?:import[\s\S]*?;\s*)+)/);
  if (!importBlock) {
    return "import { emptyLiveObject } from './noMockEmpty';\n" + text;
  }
  const insertAt = importBlock[0].length;
  return text.slice(0, insertAt) + "import { emptyLiveObject } from './noMockEmpty';\n" + text.slice(insertAt);
}

function transformFile(filePath) {
  const abs = path.join(root, filePath);
  if (!fs.existsSync(abs)) return { filePath, changed: false, reason: 'missing' };

  let text = fs.readFileSync(abs, 'utf8');
  const original = text;
  const matches = [];
  const functionRegex = /export\s+async\s+function\s+(\w+)\s*\([^)]*\)\s*:\s*Promise<([^>]+)>\s*\{/g;
  let match;

  while ((match = functionRegex.exec(text)) !== null) {
    const functionName = match[1];
    const returnType = match[2].trim();
    if (returnType.includes('[]') || /Array\s*</.test(returnType)) continue;

    const openBraceIndex = match.index + match[0].lastIndexOf('{');
    const closeBraceIndex = findMatchingBrace(text, openBraceIndex);
    if (closeBraceIndex < 0) continue;

    const body = text.slice(openBraceIndex + 1, closeBraceIndex);
    if (/return\s+\[\s*\]\s*;/.test(body)) {
      matches.push({ functionName, returnType, start: openBraceIndex + 1, end: closeBraceIndex });
    }
  }

  if (!matches.length) return { filePath, changed: false, replacements: 0 };

  for (const item of matches.reverse()) {
    const body = text.slice(item.start, item.end);
    const replacement = `return emptyLiveObject<${item.returnType}>('${item.functionName}');`;
    const newBody = body.replace(/return\s+\[\s*\]\s*;/g, replacement);
    text = text.slice(0, item.start) + newBody + text.slice(item.end);
  }
  text = addImportIfNeeded(text);

  if (text !== original) {
    const backupDir = path.join(root, 'release', 'v60', 'hotfix-backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const safeName = filePath.replace(/[\\/]/g, '__');
    fs.writeFileSync(path.join(backupDir, `${safeName}.bak`), original);
    fs.writeFileSync(abs, text);
    return { filePath, changed: true, replacements: matches.length };
  }
  return { filePath, changed: false, replacements: 0 };
}

const results = targets.map(transformFile);
const changed = results.filter(r => r.changed);
const reportDir = path.join(root, 'release', 'v60');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, 'v60-1-singleton-return-hotfix-report.json'), JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2));

console.log('v6.0.1 singleton empty-return hotfix complete.');
console.table(results.map(r => ({ file: r.filePath, changed: r.changed, replacements: r.replacements || 0, reason: r.reason || '' })));
if (!changed.length) {
  console.log('No changes were needed.');
}
