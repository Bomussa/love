import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useSession() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from('admins')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [session?.user?.id]);

  return { session, isAdmin, ready };
}
