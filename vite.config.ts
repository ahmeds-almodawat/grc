import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

function normalizeId(id: string) {
  return id.split(path.sep).join('/');
}

function pageChunk(id: string) {
  const n = normalizeId(id);

  if (!n.includes('/src/pages/')) return null;

  if (
    /WorkspaceHome|Dashboard|Analytics|ExecutiveCommandCenter|BoardPackCenter|ExecutiveMobileCommand|ScenarioPlanningCenter/.test(n)
  ) {
    return 'pages-executive';
  }

  if (
    /Projects|Departments|MyWork|OperationsCenter|Escalations|Approvals|Evidence|DepartmentScorecards|PilotOperationsCenter|V35ConsolidationPilotFixKit/.test(n)
  ) {
    return 'pages-workflow';
  }

  if (
    /Risks|Compliance|Audit|Governance|RiskAppetiteKriCenter|CommitteeActionAutomationCenter|AutomationIntelligenceCenter|SmartReviewCalendar/.test(n)
  ) {
    return 'pages-grc';
  }

  if (/OVR|OvrRiskIndicators|EvidenceVault|RelationshipMap/.test(n)) {
    return 'pages-quality-ovr';
  }

  if (/ImportExport|AdvancedReportBuilder|CustomReports|PolicyDocumentCenter|GlobalSearch|Backup|Restore|Report/.test(n)) {
    return 'pages-reports-data';
  }

  if (
    /Admin|AccessControl|SetupCenter|UserGuide|TestingCenter|PerformanceCenter|SecurityAuditCenter|Release|Migration|Staging|Rls|Translation|LoadSeed|Production|Final|Finish|Dictionary/.test(n)
  ) {
    return 'pages-admin-release';
  }

  return 'pages-other';
}

export default defineConfig({
  plugins: [react()],
  build: {
    // The app is intentionally broad. The target is to reduce the main bundle,
    // not hide warnings blindly. Keep the warning reasonably strict.
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = normalizeId(id);

          if (normalized.includes('/node_modules/react/') || normalized.includes('/node_modules/react-dom/')) {
            return 'vendor-react';
          }

          if (normalized.includes('/node_modules/@supabase/')) {
            return 'vendor-supabase';
          }

          if (normalized.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }

          if (normalized.includes('/src/i18n/')) {
            return 'app-i18n';
          }

          if (normalized.includes('/src/lib/')) {
            return 'app-api';
          }

          if (normalized.includes('/src/components/')) {
            return 'app-components';
          }

          const byPage = pageChunk(normalized);
          if (byPage) return byPage;

          if (normalized.includes('/node_modules/')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
});
