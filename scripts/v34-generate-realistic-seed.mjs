#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const outDir = 'release/v34-seed-samples';
fs.mkdirSync(outDir, { recursive: true });

const departments = Array.from({ length: 50 }, (_, i) => ({
  code: `D${String(i + 1).padStart(3, '0')}`,
  name_en: `Department ${i + 1}`,
  name_ar: `القسم ${i + 1}`,
  division: i < 20 ? 'Medical' : i < 35 ? 'Operations' : 'Administration'
}));

const users = Array.from({ length: 1000 }, (_, i) => {
  const dept = departments[i % departments.length];
  return {
    employee_no: `EMP${String(i + 1).padStart(5, '0')}`,
    email: `EMP${String(i + 1).padStart(5, '0')}@almodawat.sa`,
    full_name_en: `Pilot User ${i + 1}`,
    full_name_ar: `مستخدم تجريبي ${i + 1}`,
    department_code: dept.code,
    role: i < 10 ? 'department_manager' : 'employee',
    scope: i < 10 ? 'department' : 'assigned_only'
  };
});

function toCsv(rows) {
  const keys = Object.keys(rows[0]);
  return [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
}

fs.writeFileSync(path.join(outDir, 'departments_50_sample.csv'), toCsv(departments));
fs.writeFileSync(path.join(outDir, 'employees_1000_sample.csv'), toCsv(users));
fs.writeFileSync(path.join(outDir, 'seed_manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), departments: departments.length, users: users.length }, null, 2));
console.log(`Generated v3.4 seed samples in ${outDir}`);
