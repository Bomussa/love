import { supabase } from './supabase';
import { notifyOnce } from './notifications';

export function subscribeWaitingCalls(userId: string, cb: () => void) {
  const ch = supabase
    .channel('waiting_calls')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'waiting_calls' },
      (p) => {
        if ((p.new as any)?.user_id === userId) {
          notifyOnce(() => cb());
        }
      }
    )
    .subscribe();
  return () => supabase.removeChannel(ch);
}
