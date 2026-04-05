export const examTypes = [
  { id: 'general', name: 'General Exam', nameAr: 'فحص عام' },
  { id: 'officer', name: 'Officer Exam', nameAr: 'فحص ضباط' },
];

export function formatTime(date) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
}
