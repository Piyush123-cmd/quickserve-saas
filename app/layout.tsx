import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'QuickServe - QR Order System',
  description: 'Smart QR Ordering for Cafes & Restaurants',
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