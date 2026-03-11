'use client';

import dynamic from 'next/dynamic';

const ResultsContent = dynamic(() => import('@/components/ResultsContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-stone-950">
      <div className="text-stone-500 text-sm">Loading…</div>
    </div>
  ),
});

export default function ResultsPage() {
  return <ResultsContent />;
}
