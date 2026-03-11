'use client';

import dynamic from 'next/dynamic';

const WelcomeContent = dynamic(() => import('@/components/WelcomeContent'), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-sm flex flex-col items-center gap-8 text-center">
      <div className="text-stone-600 text-sm">Loading…</div>
    </div>
  ),
});

export default function WelcomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-stone-950">
      <WelcomeContent />
    </main>
  );
}
