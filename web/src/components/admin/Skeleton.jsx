export function Skeleton({ className = '', width = '100%', height = '14px', count = 1 }) {
  const lines = Array.from({ length: count });
  return (
    <>
      {lines.map((_, i) => (
        <div
          key={i}
          className={`skeleton ${className}`}
          style={{ width, height, marginBottom: i < count - 1 ? '8px' : 0 }}
        />
      ))}
    </>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton skeleton-header-cell" style={{ height: '16px', width: '80%' }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-table-row">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton skeleton-cell" style={{ height: '14px', width: c === 0 ? '60%' : '80%' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="skeleton-stat-card">
      <div className="skeleton skeleton-stat-value" style={{ height: '32px', width: '60%', marginBottom: '8px' }} />
      <div className="skeleton skeleton-stat-label" style={{ height: '14px', width: '80%' }} />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="skeleton-chart">
      <div className="skeleton-chart-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div className="skeleton" style={{ height: '16px', width: '120px' }} />
        <div className="skeleton" style={{ height: '16px', width: '80px' }} />
      </div>
      <div className="skeleton-chart-bars" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '200px' }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ width: '40px', height: `${60 + (i * 10) % 80}%`, minHeight: '20px' }} />
        ))}
      </div>
    </div>
  );
}

export default Skeleton;