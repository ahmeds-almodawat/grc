import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const layout = readFileSync('src/components/Layout.tsx', 'utf8');
const routeMatches = [...layout.matchAll(/\| '([^']+)'/g)].map(match => match[1]);
const navMatches = [...layout.matchAll(/key: '([^']+)'/g)].map(match => match[1]);
const switchMatches = [...app.matchAll(/case '([^']+)'/g)].map(match => match[1]);

const routeSet = new Set(routeMatches);
const switchSet = new Set(switchMatches);
const missingSwitch = [...routeSet].filter(key => !switchSet.has(key));
const navWithoutRoute = navMatches.filter(key => !routeSet.has(key));
const unusedSwitch = [...switchSet].filter(key => !routeSet.has(key));

const result = {
  generatedAt: new Date().toISOString(),
  routeCount: routeSet.size,
  navCount: new Set(navMatches).size,
  switchCount: switchSet.size,
  missingSwitch,
  navWithoutRoute,
  unusedSwitch,
  status: missingSwitch.length || navWithoutRoute.length ? 'warning' : 'pass'
};

mkdirSync('release/audits', { recursive: true });
writeFileSync('release/audits/route-audit.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (missingSwitch.length || navWithoutRoute.length) process.exitCode = 1;
