import Link from 'next/link';
export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>تطبيق اللجنة الطبية العسكرية – العطار</h1>
      <p style={{ marginBottom: 24 }}>ابدأ من هنا.</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/clinics">دخول العيادات</Link>
        <Link href="/visitor">واجهة المراجع</Link>
      </div>
    </main>
  );
}
