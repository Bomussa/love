import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useQueue(clinicId: string) {
  const [number, setNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    supabase
      .from('queue_numbers')
      .select('queue_number')
      .eq('clinic_id', clinicId)
      .eq('queue_date', new Date().toISOString().slice(0,10))
      .single()
      .then(({ data }) => {
        if (data?.queue_number) setNumber(data.queue_number);
      });
  }, [clinicId]);

  return number;
}
