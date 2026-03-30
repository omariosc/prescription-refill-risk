export default function AnalyticsDashboard({ onBack }) {
  const stats = [
    { label: 'Active Patients', value: '12,847', icon: 'group', color: '#005c8f' },
    { label: 'Avg Adherence Rate', value: '74.2%', icon: 'trending_up', color: '#10b981' },
    { label: 'Interventions This Month', value: '342', icon: 'support_agent', color: '#e89c0d' },
    { label: 'Cost Savings (Est.)', value: '$128,400', icon: 'savings', color: '#8b5cf6' },
  ];

  return (
    <div className="section">
      <div className="container">
        {/* Back button */}
        <button
          onClick={onBack}
          className="btn btn-s btn-sm"
          style={{ marginBottom: 24 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Back to Risk Tool
        </button>

        {/* Title */}
        <div style={{ marginBottom: 32 }}>
          <h2 className="sec-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--accent)' }}>analytics</span>
            Analytics Dashboard
          </h2>
          <p className="sec-sub" style={{ marginBottom: 0 }}>
            Population-level adherence insights (coming soon)
          </p>
        </div>

        {/* Stat cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                background: '#fff',
                borderRadius: 'var(--card)',
                boxShadow: 'var(--shadow)',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 32,
                  color: s.color,
                  background: `${s.color}12`,
                  borderRadius: '12px',
                  width: 52,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </span>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Nunito', sans-serif", color: 'var(--navy)', lineHeight: 1.1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, marginTop: 2 }}>
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Placeholder chart area */}
        <div style={{
          background: '#f9fafb',
          borderRadius: 'var(--card)',
          border: '2px dashed var(--border)',
          padding: '64px 32px',
          textAlign: 'center',
          marginBottom: 32,
        }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 48, color: '#d1d5db', marginBottom: 12, display: 'block' }}
          >
            bar_chart
          </span>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#9ca3af' }}>
            Adherence trend chart — coming soon
          </div>
          <div style={{ fontSize: 13, color: '#d1d5db', marginTop: 6 }}>
            Interactive charts with filtering by cohort, drug class, and time period
          </div>
        </div>

        {/* Coming soon notice */}
        <div style={{
          background: '#fff',
          borderRadius: 'var(--card)',
          boxShadow: 'var(--shadow)',
          padding: '24px 28px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 24, color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}
          >
            info
          </span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
              Coming Soon
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
              Full analytics with real-time dashboards, cohort analysis, and intervention effectiveness tracking will be available in the next release.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
