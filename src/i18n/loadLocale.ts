export async function loadLocale(lang: 'ar' | 'en') {
  const r = await fetch(`/locales/${lang}.json`, { credentials: 'include' });
  return r.json();
}
