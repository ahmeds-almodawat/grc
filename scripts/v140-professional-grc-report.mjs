import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v140');
fs.mkdirSync(releaseDir, { recursive: true });

const modelPath = path.join(root, 'src/lib/v140ProfessionalGrcModel.ts');
const modelExists = fs.existsSync(modelPath);

const report = `# v14.0 Professional GRC Workflow Maturity Pack

- Generated: ${new Date().toISOString()}
- Production readiness: **not asserted**
- Controlled pilot status: **professional workflow maturity layer added**
- Database migration: **none**
- Approval evidence: **unchanged**

## Purpose

This release strengthens the platform around a professional GRC operating chain:

**Risk → Control → Test → Evidence → Issue → CAPA → Audit / Compliance Reporting**

The goal is to make the platform feel like a real risk, compliance and internal audit program rather than separate dashboards.

## Professional basis

- ISO 31000-style risk identification, analysis, evaluation, treatment, monitoring and communication.
- COSO ERM-style enterprise risk, strategy, performance and reporting alignment.
- IIA-style audit planning, engagement work, findings and follow-up.
- ISO 37301-style compliance obligations, regulatory change, testing, policy linkage and evidence.

## Must-have professional modules represented

1. Enterprise Risk Register
2. Risk Assessment and Scoring
3. Risk Appetite / KRI Monitoring
4. Controls Library
5. Control Testing
6. Evidence Management
7. CAPA / Corrective Action Management
8. Audit Universe
9. Audit Planning
10. Audit Engagements / Workpapers
11. Audit Findings and Follow-up
12. Compliance Obligations Register
13. Policy and Document Control
14. Issue / Finding Register
15. Executive GRC Dashboard

## Page enhancements

| Page | v14 maturity layer |
|---|---|
| Risks | Enterprise risk register, scoring, appetite/KRI, control mapping and treatment linkage. |
| Compliance | Obligations register, regulatory change, testing, policy/attestation and non-compliance issue creation. |
| Audit | Audit universe, annual plan, engagement workpapers, findings and follow-up. |
| Governance | Executive dashboard, assurance map, board reporting and cross-module traceability. |

## Validation

Run:

\`\`\`powershell
npm ci
npm run typecheck
npm run build
npm run pilot:v140-professional-grc
npm run proof:all
\`\`\`

Expected:

- v14 professional GRC proof passes.
- Existing proof:all remains 17/0.
- GitHub Actions CI passes after including \`npm run pilot:v140-professional-grc\`.

## Safety boundaries

- No new database migration.
- No approval JSON changes.
- No fake UAT or fake production evidence.
- No proof gate bypass.
- No broad production claim.

## Static model

- Model file present: ${modelExists ? 'yes' : 'no'}
`;

fs.writeFileSync(path.join(releaseDir, 'v140-professional-grc-report.md'), report);
console.log('v14.0 professional GRC report generated.');
console.log({ report: 'release/v140/v140-professional-grc-report.md' });
