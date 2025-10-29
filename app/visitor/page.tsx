import Link from 'next/link';
export default function Visitor() {
  return (
    <main style={{ padding: 24 }}>
      <h2>واجهة المراجع</h2>
      <p>نسخة تشغيلية بسيطة لبدء العمل، ثم نكمّل المنطق الحقيقي.</p>
      <Link href="/">⬅ العودة</Link>
    </main>
  );
}
