import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8').replace(/\r\n/g, '\n');

describe('UI-9 platform reconciliation contract', () => {
  const layout = source('src/components/Layout.tsx');
  const foundation = source('src/styles/platform-foundation.css');
  const risks = source('src/pages/Risks.tsx');
  const compliance = source('src/pages/Compliance.tsx');
  const audit = source('src/pages/Audit.tsx');
  const capa = source('src/pages/Capa.tsx');
  const training = source('src/pages/TrainingGovernanceCenter.tsx');
  const ovr = source('src/pages/OVR.tsx');
  const evidence = source('src/pages/EvidenceCenter.tsx');
  const myWork = source('src/pages/MyWork.tsx');
  const employeeArabic = source('tests/e2e/employee-arabic-localization.spec.ts');
  const crossRole = source('tests/e2e/v14j-cross-role-uat-readiness.spec.ts');

  it('provides a keyboard skip path and exposes current shell navigation state', () => {
    expect(layout).toContain('className="platform-skip-link"');
    expect(layout).toContain('href="#platform-main-content"');
    expect(layout).toContain('id="platform-main-content"');
    expect(layout).toContain('tabIndex={-1}');
    expect(layout.match(/aria-current=/g)?.length).toBeGreaterThanOrEqual(4);
    expect(layout).toContain('aria-controls={`nav-group-${group.id}`}');
    expect(layout).toContain('id={`nav-group-${group.id}`}');
  });

  it('uses stateful native-button semantics for representative module view controls', () => {
    expect(risks).toContain('role="group" aria-label={text(\'Risk views\'');
    expect(risks).toContain("aria-pressed={view === 'register'}");
    expect(compliance).toContain('role="group" aria-label={text(\'Compliance views\'');
    expect(compliance).toContain("aria-pressed={view === 'dashboard'}");
    expect(audit).toContain("aria-current={screen === item.id ? 'page' : undefined}");
    expect(capa).toContain("aria-current={screen === item.id ? 'page' : undefined}");
    expect(training).toContain("aria-current={activeTab === tab.id ? 'page' : undefined}");
    expect(ovr).toContain("aria-current={workspaceView === tab.id ? 'page' : undefined}");
  });

  it('extends reduced-motion behavior across the accepted shared shell and overlays', () => {
    expect(foundation).toContain('@media (prefers-reduced-motion: reduce)');
    expect(foundation).toContain(':where(.modern-app-shell, .modal-backdrop, .platform-drawer) *');
    expect(foundation).toContain('animation-iteration-count: 1 !important');
    expect(foundation).toContain('.platform-skip-link:focus');
  });

  it('adjudicates both known UI-7 failures as stale expectations', () => {
    expect(employeeArabic).toContain("myWork: 'أعمالي المحكومة'");
    expect(employeeArabic).toContain("getByText('My governed work', { exact: true })");
    expect(employeeArabic).not.toContain('My assigned milestones, tasks, due dates and evidence requirements');
    expect(crossRole).toContain("getByText('No approvals in scope')");
    expect(crossRole).not.toContain("getByText('No approvals match the selected filter')");
  });

  it('keeps partial governed reads and Arabic work enums render-safe', () => {
    expect(compliance).toContain('total + finiteCount(item.open_finding_count)');
    expect(compliance).toContain('finiteCount(item.open_finding_count)}</span>');
    expect(evidence).toContain('if (!id) continue;');
    expect(evidence).toContain('key="evidence-header"');
    expect(myWork).toContain('const arabicWorkLabels: Record<string, string>');
    expect(myWork).toContain('{workLabel(item.sourceModule)}');
    expect(myWork).toContain('workLabel(item.requiredAction)');
  });
});
