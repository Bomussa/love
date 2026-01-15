import { supabase } from '../lib/supabase';

export async function takeQueueNumber(clinic_id: string) {
  const { data, error } = await supabase.rpc('take_queue_number', { clinic_id });
  if (error) throw error;
  return data as number;
}
