/**
 * مسارات التطبيق (App Routes) — مثال تنظيمي
 */
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/app/dashboard',
  CLINICS: '/app/clinics',
  SETTINGS: '/app/settings',
};

export const NAV = [
  { path: ROUTES.HOME, label: 'Home' },
  { path: ROUTES.DASHBOARD, label: 'Dashboard' },
  { path: ROUTES.CLINICS, label: 'Clinics' },
  { path: ROUTES.SETTINGS, label: 'Settings' },
];
