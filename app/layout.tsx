export const metadata = {
  title: "MMC-MMS API Proxy",
  description: "Military Medical Center - Al-Attar API Proxy"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ 
        margin: 0, 
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        backgroundColor: "#f5f5f5"
      }}>
        {children}
      </body>
    </html>
  );
}
