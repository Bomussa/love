'use client'
import { useRouter } from 'next/navigation'
export default function Home(){
  const r = useRouter();
  return (<main style={{padding:24}}><h1>مرحبًا</h1><button onClick={()=>r.push('/clinics')}>دخول العيادات</button></main>);
}
