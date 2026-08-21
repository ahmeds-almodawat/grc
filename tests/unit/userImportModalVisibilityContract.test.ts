import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const ui = readFileSync(
  path.join(root, 'src/pages/UserManagementCenter.tsx'),
  'utf8',
).replace(/\r\n/g, '\n');
const i18n = readFileSync(
  path.join(root, 'src/i18n/I18nContext.tsx'),
  'utf8',
).replace(/\r\n/g, '\n');

function section(start: string, end: string): string {
  const startIndex = ui.indexOf(start);
  const endIndex = ui.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return ui.slice(startIndex, endIndex);
}

describe('Patch 83T User Import modal visibility contract', () => {
  it('uses only the four explicit deployment compatibility states', () => {
    const stateType = section('type ImportCompatibilityStatus =', 'const emptySummary');
    for (const state of ['disabled', 'checking', 'incompatible', 'compatible']) {
      expect(stateType).toContain(`"${state}"`);
    }
    expect(stateType).not.toContain('"idle"');
  });

  it('always mounts the uploader before compatibility feedback', () => {
    const modal = section(
      '<Modal\n        open={importOpen}',
      '</Modal>\n    </section>',
    );
    const uploaderIndex = modal.indexOf('className="user-workbook-upload"');
    const compatibilityIndex = modal.indexOf('importCompatibilityStatus === "disabled"');

    expect(uploaderIndex).toBeGreaterThanOrEqual(0);
    expect(compatibilityIndex).toBeGreaterThan(uploaderIndex);
    expect(modal).not.toContain('importCompatibilityStatus === "compatible" || importFile');
    expect(modal).toContain("t('userManagement.chooseWorkbook')");
    expect(i18n).toContain("en: 'Choose .xlsx workbook'");
    expect(modal).toContain('className="visually-hidden"');
    expect(modal).toContain('aria-disabled={importUploadDisabled}');
    expect(modal).toContain('aria-describedby={importUploadDescribedBy}');
  });

  it('renders visible, described feedback for disabled, checking, and incompatible states', () => {
    const modal = section(
      '<Modal\n        open={importOpen}',
      '</Modal>\n    </section>',
    );

    expect(modal).toContain('importCompatibilityStatus === "disabled"');
    expect(modal).toContain('PATCH83T_USER_IMPORT_FEATURE_DISABLED_MESSAGE');
    expect(modal).toContain('importCompatibilityStatus === "checking"');
    expect(modal).toContain("t('userManagement.checkingCompatibility')");
    expect(i18n).toContain("en: 'Checking User Excel Import backend compatibility...'");
    expect(modal).toContain('importCompatibilityStatus === "incompatible"');
    expect(modal).toContain('PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE');
    expect(modal).toContain("t('userManagement.retryCompatibility')");
    expect(i18n).toContain("en: 'Retry compatibility check'");
    expect(modal.match(/>\s*Close\s*</g)).toBeNull();
  });

  it('opens the disabled modal without a capability request and gates selection until compatible', () => {
    const openImport = section('const openImport = () => {', 'const handleImportFile');
    const handleImportFile = section('const handleImportFile = async', 'const applyImport');

    expect(openImport.indexOf('setImportOpen(true)')).toBeLessThan(
      openImport.indexOf('if (!userImportFeatureEnabled)'),
    );
    expect(openImport).toMatch(/if \(!userImportFeatureEnabled\)[\s\S]*setImportCompatibilityStatus\("disabled"\)[\s\S]*return;/);
    expect(handleImportFile).toMatch(/importCompatibilityStatus !== "compatible"[\s\S]*return;[\s\S]*processImportFile/);
    expect(ui).toContain('disabled={writeDisabled}');
  });

  it('retains the File during incompatibility and revalidates it after a successful Retry', () => {
    const incompatible = section('const markImportIncompatible = () => {', 'const resetImportFile');
    const compatibilityCheck = section('const checkImportCompatibility = async', 'const openImport');

    expect(incompatible).toContain('importSelectionId.current += 1');
    expect(incompatible).not.toContain('importSelectedFileRef.current = null');
    expect(incompatible).not.toContain('setImportFile(null)');
    expect(incompatible).not.toContain('setImportValidation(null)');
    expect(compatibilityCheck).toContain('const selectedFile = importSelectedFileRef.current');
    expect(compatibilityCheck).toContain('await processImportFile(selectedFile, capabilities)');
    expect(ui).not.toContain('Unsupported privileged action:');
    expect(ui).not.toContain('patch83t_user_import_identity_references');
  });
});
