import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

export default function AdminUsers() {
  const [admins, setAdmins] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('admins').select('*').then(r => setAdmins(r.data ?? []));
  }, []);

  async function add(user_id: string) {
    await supabase.from('admins').insert({ user_id });
    // Refresh list
    supabase.from('admins').select('*').then(r => setAdmins(r.data ?? []));
  }

  async function remove(user_id: string) {
    await supabase.from('admins').delete().eq('user_id', user_id);
    // Refresh list
    setAdmins(admins.filter(a => a.user_id !== user_id));
  }

  return (
    <div>
      {admins.map(a => (
        <div key={a.user_id}>
          {a.user_id}
          <button onClick={() => remove(a.user_id)}>حذف</button>
        </div>
      ))}
    </div>
  );
}
