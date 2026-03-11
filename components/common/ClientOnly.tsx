'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Defers rendering children until after hydration.
 * Prevents server/client mismatch for components using browser APIs or framer-motion.
 */
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return fallback ?? null;
  return <>{children}</>;
}
