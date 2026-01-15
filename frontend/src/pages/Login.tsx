import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    nav('/');
  }

  return (
    <div style={{maxWidth: '400px', margin: '100px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px'}}>
      <h2 style={{textAlign: 'center'}}>تسجيل الدخول</h2>
      <form onSubmit={submit} style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="البريد الإلكتروني" required style={{padding: '8px'}} />
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="كلمة المرور" required style={{padding: '8px'}} />
        <button disabled={loading} style={{padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>
          {loading ? 'جاري الدخول...' : 'دخول'}
        </button>
        {error && <div style={{color: 'red', textAlign: 'center'}}>{error}</div>}
      </form>
    </div>
  );
}
