import type { ReactNode } from 'react';
import BackupHealthCheck from '../pages/BackupHealthCheck';
import CustomReports from '../pages/CustomReports';
import ModernExecutiveDashboard from '../pages/ModernExecutiveDashboard';

export type V13Route = {
  path: string;
  label_en: string;
  label_ar: string;
  element: ReactNode;
  group: 'executive' | 'admin' | 'reports';
};

export const v13Routes: V13Route[] = [
  {
    path: '/executive-control',
    label_en: 'Executive Control',
    label_ar: 'التحكم التنفيذي',
    element: <ModernExecutiveDashboard />,
    group: 'executive',
  },
  {
    path: '/backup-health-check',
    label_en: 'Backup Health Check',
    label_ar: 'فحص النسخ الاحتياطي',
    element: <BackupHealthCheck />,
    group: 'admin',
  },
  {
    path: '/custom-reports',
    label_en: 'Custom Reports',
    label_ar: 'التقارير المخصصة',
    element: <CustomReports />,
    group: 'reports',
  },
];
