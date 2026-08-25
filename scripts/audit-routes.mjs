import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const REPORT_PATH = 'release/audits/route-audit.json';

function parseSource(fileName) {
  return ts.createSourceFile(
    fileName,
    readFileSync(fileName, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isAsExpression(current)
    || ts.isSatisfiesExpression(current)
    || ts.isParenthesizedExpression(current)
    || ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function stringValue(node) {
  const value = unwrapExpression(node);
  return ts.isStringLiteralLike(value) ? value.text : null;
}

function registryEntries(sourceFile) {
  let entries = [];
  sourceFile.forEachChild(node => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'PAGE_LOCATION_REGISTRY' || !declaration.initializer) continue;
      const initializer = unwrapExpression(declaration.initializer);
      if (!ts.isObjectLiteralExpression(initializer)) continue;
      entries = initializer.properties.flatMap(property => {
        if (!ts.isPropertyAssignment(property)) return [];
        const key = ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name) ? property.name.text : null;
        const value = stringValue(property.initializer);
        return key && value ? [[key, value]] : [];
      });
    }
  });
  return entries;
}

function switchCases(sourceFile) {
  const cases = [];
  const visit = node => {
    if (ts.isCaseClause(node)) {
      const value = stringValue(node.expression);
      if (value) cases.push(value);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return cases;
}

function navigationKeys(sourceFile) {
  const keys = [];
  const visit = node => {
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name) ? node.name.text : null;
      if (name === 'key') {
        const value = stringValue(node.initializer);
        if (value) keys.push(value);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return keys;
}

const routeEntries = registryEntries(parseSource('src/routes/pageLocation.ts'));
const routeSet = new Set(routeEntries.map(([key]) => key));
const switchSet = new Set(switchCases(parseSource('src/App.tsx')));
const navSet = new Set(navigationKeys(parseSource('src/components/Layout.tsx')));
const locationOwners = new Map();

for (const [key, location] of routeEntries) {
  locationOwners.set(location, [...(locationOwners.get(location) ?? []), key]);
}

const missingSwitch = [...routeSet].filter(key => !switchSet.has(key));
const navWithoutRoute = [...navSet].filter(key => !routeSet.has(key));
const unusedSwitch = [...switchSet].filter(key => !routeSet.has(key));
const duplicateLocations = [...locationOwners.entries()]
  .filter(([, keys]) => keys.length > 1)
  .map(([location, keys]) => ({ location, keys }));
const status = missingSwitch.length || navWithoutRoute.length || unusedSwitch.length || duplicateLocations.length ? 'warning' : 'pass';
const audit = {
  routeCount: routeSet.size,
  navCount: navSet.size,
  switchCount: switchSet.size,
  missingSwitch,
  navWithoutRoute,
  unusedSwitch,
  duplicateLocations,
  status,
};

let result = { generatedAt: new Date().toISOString(), ...audit };
if (existsSync(REPORT_PATH)) {
  const previous = JSON.parse(readFileSync(REPORT_PATH, 'utf8'));
  const { generatedAt: _previousGeneratedAt, ...previousAudit } = previous;
  if (JSON.stringify(previousAudit) === JSON.stringify(audit)) result = previous;
}

mkdirSync('release/audits', { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (status !== 'pass') process.exitCode = 1;
