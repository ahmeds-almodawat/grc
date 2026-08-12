export const APP_NAME = 'Almodawat Assurance Control Center';
export const APP_PACKAGE_VERSION = '1.0.0';
export const APP_BASELINE_VERSION = 'v6.1.1';
export const APP_BASELINE_NAME = 'Live Hospital Operating Baseline';
export const APP_PRODUCTION_READINESS_LABEL = 'live-hospital-operating';

export const appVersion = {
  name: APP_NAME,
  packageVersion: APP_PACKAGE_VERSION,
  baselineVersion: APP_BASELINE_VERSION,
  baselineName: APP_BASELINE_NAME,
  productionReadinessLabel: APP_PRODUCTION_READINESS_LABEL
} as const;
