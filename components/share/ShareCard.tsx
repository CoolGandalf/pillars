import type { Value } from '@/types/pillars';

interface ShareCardProps {
  value1: Value;
  value2: Value;
  top10?: Value[];
  displayName?: string;
}

// This component is rendered off-screen to a PNG via html-to-image.
// Uses inline styles only (not Tailwind) for reliable image export.
export function ShareCard({ value1, value2, top10, displayName }: ShareCardProps) {
  return (
    <div
      id="share-card"
      style={{
        width: 640,
        height: 640,
        background: 'linear-gradient(160deg, #1c1917 0%, #0f0d0c 100%)',
        borderRadius: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        gap: 32,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#78716c', fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
          Pillars
        </p>
        {displayName && (
          <p style={{ color: '#57534e', fontSize: 12, margin: '4px 0 0' }}>{displayName}</p>
        )}
      </div>

      {/* Hero values */}
      <div style={{ display: 'flex', gap: 16, width: '100%' }}>
        {[value1, value2].map((v, i) => (
          <div
            key={v.id}
            style={{
              flex: 1,
              background: '#1c1917',
              border: '1px solid #44403c',
              borderRadius: 16,
              padding: '24px 20px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: '#f59e0b', fontSize: 11, fontWeight: 600, margin: '0 0 8px', letterSpacing: '0.1em' }}>
              #{i + 1}
            </p>
            <h2 style={{ color: '#fafaf9', fontSize: 22, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.2 }}>
              {v.name}
            </h2>
            <p style={{ color: '#78716c', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
              {v.definition}
            </p>
          </div>
        ))}
      </div>

      {/* Top 10 preview */}
      {top10 && top10.length > 2 && (
        <div style={{ width: '100%' }}>
          <p style={{ color: '#57534e', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            Top 10
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {top10.slice(2).map((v, i) => (
              <span
                key={v.id}
                style={{
                  background: '#1c1917',
                  border: '1px solid #292524',
                  borderRadius: 20,
                  padding: '4px 12px',
                  color: '#a8a29e',
                  fontSize: 11,
                }}
              >
                {i + 3}. {v.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <p style={{ color: '#3d3732', fontSize: 11, margin: 0, textAlign: 'center' }}>
        Built from fast forced choices, not a personality quiz.
      </p>
    </div>
  );
}
