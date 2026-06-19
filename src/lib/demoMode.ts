export function isDemoDataAllowed(): boolean {
  const env = import.meta.env;
  return env.DEV === true && env.VITE_ALLOW_DEMO_DATA === 'true' && env.MODE !== 'production';
}

export function assertDemoDataAllowed(feature: string): void {
  if (!isDemoDataAllowed()) {
    throw new Error(`Demo data is disabled for ${feature}. Set VITE_ALLOW_DEMO_DATA=true only in local development.`);
  }
}

export function getDemoModeBanner(language: 'ar' | 'en' = 'en'): string {
  if (language === 'ar') {
    return 'وضع البيانات التجريبية مفعل للتطوير المحلي فقط. لا تستخدم هذه البيانات للإنتاج.';
  }
  return 'Demo data mode is enabled for local development only. Do not use this data in production.';
}
