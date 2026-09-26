import Link from 'next/link';

export default function RootHomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
        QuickServe SaaS Platform
      </h1>
      <p className="text-slate-400 text-sm max-w-sm mb-6">
        Multi-Tenant Digital Menu & QR Ordering System
      </p>
      <Link
        href="/cafegirl-man"
        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-sm transition"
      >
        View Demo Menu →
      </Link>
    </div>
  );
}