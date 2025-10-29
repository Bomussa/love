'use client'
import { useRouter } from 'next/navigation'
export default function Clinics(){
  const r = useRouter();
  return (<main style={{padding:24}}><h2>دخول العيادات</h2><button onClick={()=>r.push('/visitor')}>متابعة إلى شاشة المراجع</button></main>);
}
