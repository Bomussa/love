import { supabase } from '../lib/supabase';

export async function exportTodayCSV() {
  const { data } = await supabase
    .from('queue_numbers')
    .select('*')
    .eq('queue_date', new Date().toISOString().slice(0,10));

  if (!data || data.length === 0) return;

  const csv = [
    Object.keys(data[0]).join(','),
    ...data.map(r => Object.values(r).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'today.csv';
  a.click();
}
