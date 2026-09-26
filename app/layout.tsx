import './globals.css';

export const metadata = {
  title: 'QuickServe SaaS',
  description: 'Smart Multi-Tenant QR Ordering System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}