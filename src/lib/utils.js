export const examTypes = [
  { id: 'general', name: 'General', nameAr: 'عام' },
  { id: 'special', name: 'Special', nameAr: 'خاص' },
];

export function formatTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
