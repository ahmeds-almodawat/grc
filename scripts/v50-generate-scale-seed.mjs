import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const outDir = path.resolve('release', 'v50-scale-seed');
fs.mkdirSync(outDir, { recursive: true });

const departments = Array.from({ length: 50 }, (_, i) => ({
  code: `D${String(i + 1).padStart(3, '0')}`,
  name_en: `Department ${i + 1}`,
  name_ar: `القسم ${i + 1}`,
  division_code: `DIV${String((i % 5) + 1).padStart(2, '0')}`
}));

const users = Array.from({ length: 1000 }, (_, i) => {
  const dept = departments[i % departments.length];
  return {
    employee_no: `EMP${String(i + 1).padStart(5, '0')}`,
    full_name_en: `Pilot User ${i + 1}`,
    full_name_ar: `مستخدم تجريبي ${i + 1}`,
    email: `emp${String(i + 1).padStart(5, '0')}@almodawat.sa`,
    department_code: dept.code,
    role: i < 5 ? 'executive' : i < 30 ? 'department_manager' : 'employee',
    scope: i < 5 ? 'global' : i < 30 ? 'department' : 'assigned_only'
  };
});

const projects = Array.from({ length: 120 }, (_, i) => {
  const dept = departments[i % departments.length];
  return {
    title: `Scale Project ${i + 1}`,
    department_code: dept.code,
    priority: i % 10 === 0 ? 'critical' : i % 3 === 0 ? 'high' : 'medium',
    risk_level: i % 8 === 0 ? 'critical' : i % 4 === 0 ? 'high' : 'medium',
    status: i % 9 === 0 ? 'delayed' : 'active'
  };
});

const manifest = {
  generated_at: new Date().toISOString(),
  dry_run: dryRun,
  counts: {
    departments: departments.length,
    users: users.length,
    projects: projects.length,
    estimated_tasks: 1500,
    estimated_ovrs: 500,
    estimated_risks: 300
  },
  files: {
    departments: 'departments.seed.json',
    users: 'users.seed.json',
    projects: 'projects.seed.json'
  }
};

fs.writeFileSync(path.join(outDir, 'departments.seed.json'), JSON.stringify(departments, null, 2));
fs.writeFileSync(path.join(outDir, 'users.seed.json'), JSON.stringify(users, null, 2));
fs.writeFileSync(path.join(outDir, 'projects.seed.json'), JSON.stringify(projects, null, 2));
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log('v5.0 scale seed files generated:');
console.log(`- ${path.relative(process.cwd(), outDir)}`);
console.log(JSON.stringify(manifest.counts, null, 2));
if (dryRun) console.log('Dry-run only. Import manually through the Import/Export Center after review.');
