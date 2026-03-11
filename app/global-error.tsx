'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ background: '#0c0a09', color: '#fafaf9', fontFamily: 'monospace', padding: 40 }}>
        <h2>Something went wrong</h2>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#f59e0b', fontSize: 14, lineHeight: 1.6 }}>
          {error.message}
        </pre>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#78716c', fontSize: 12, lineHeight: 1.4, marginTop: 16 }}>
          {error.stack}
        </pre>
        <button
          onClick={() => reset()}
          style={{ marginTop: 24, padding: '8px 16px', background: '#f59e0b', color: '#0c0a09', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
