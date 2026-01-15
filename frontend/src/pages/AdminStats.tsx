import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminStats() {
  const [stats, setStats] = useState({ today: 0 });

  useEffect(() => {
    supabase
      .from('queue_numbers')
      .select('id', { count: 'exact', head: true })
      .eq('queue_date', new Date().toISOString().slice(0,10))
      .then(({ count }) => setStats({ today: count ?? 0 }));
  }, []);

  return <div>عدد المراجعين اليوم: {stats.today}</div>;
}
