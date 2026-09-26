'use client';

import { usePathname } from 'next/navigation';
import CustomerMenuPage from './[cafeId]/page';

export default function RootHomePage() {
  const pathname = usePathname();

  // Agar user exact root "/" par hai, tabhi SaaS Landing Page dikhao
  if (pathname === '/') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
          QuickServe SaaS Platform
        </h1>
        <p className="text-slate-400 text-sm max-w-sm">
          Multi-Tenant Digital Menu & QR Ordering System
        </p>
      </div>
    );
  }

  // Agar user slug branch par hai, toh dynamic menu handle karne do
  return null;
}