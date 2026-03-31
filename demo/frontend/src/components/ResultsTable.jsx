function catClass(category) {
  return category === 'MODERATE' ? 'mod' : category.toLowerCase();
}

function CompositeSection({ composites }) {
  if (!composites || composites.length === 0) return null;
  // Only show if there's at least one patient with multiple drugs
  const multi = composites.filter((c) => c.n_drugs >= 2);
  if (multi.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--accent)' }}>person_search</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Nunito', sans-serif" }}>Patient Composite Risk</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Overall risk across all medications per patient</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {composites.map((c) => {
          const cat = catClass(c.composite_category);
          const pct = (c.composite_score * 100).toFixed(1);
          return (
            <div key={c.patient_id} style={{
              background: '#fff', borderRadius: 'var(--card)', boxShadow: 'var(--shadow)',
              padding: '18px 22px', border: c.composite_category === 'HIGH' ? '1px solid #fecaca' : '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>{c.patient_id}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{c.n_drugs} medication{c.n_drugs !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Nunito', sans-serif", color: cat === 'high' ? 'var(--coral)' : cat === 'mod' ? '#d97706' : '#059669' }}>{pct}%</div>
                  <span className={`risk-badge ${cat}`} style={{ fontSize: 11 }}>{c.composite_category}</span>
                </div>
              </div>
              {/* Formula explanation */}
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, background: 'var(--grey)', borderRadius: 6, padding: '6px 10px' }}>
                Probability of at least one late refill across all {c.n_drugs} drugs
              </div>
              {/* Per-drug breakdown */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {c.drug_scores.map((d, i) => {
                  const dCat = catClass(d.risk_category);
                  return (
                    <span key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, padding: '3px 8px', borderRadius: 6,
                      background: dCat === 'high' ? '#fef2f2' : dCat === 'mod' ? '#fffbeb' : '#f0fdf4',
                      color: dCat === 'high' ? 'var(--coral)' : dCat === 'mod' ? '#92400e' : '#166534',
                      border: `1px solid ${dCat === 'high' ? '#fecaca' : dCat === 'mod' ? '#fde68a' : '#bbf7d0'}`,
                    }}>
                      <span className={`risk-dot ${dCat}`} style={{ width: 6, height: 6 }} />
                      {d.drug_name.length > 20 ? d.drug_name.slice(0, 20) + '...' : d.drug_name}: {(d.risk_score * 100).toFixed(0)}%
                    </span>
                  );
                })}
              </div>
              {/* Composite recommendations */}
              {c.recommendations.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  {c.recommendations.map((r, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6,
                      fontSize: 12, color: '#4b5563', lineHeight: 1.5,
                    }}>
                      <span className="material-symbols-outlined" style={{
                        fontSize: 16, flexShrink: 0, marginTop: 2,
                        color: r.priority === 'urgent' ? 'var(--coral)' : r.priority === 'high' ? '#d97706' : 'var(--accent)',
                      }}>
                        {r.priority === 'urgent' ? 'error' : r.priority === 'high' ? 'warning' : 'info'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{r.text}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{r.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResultsTable({ data, onViewDetail, onReset }) {
  const { summary, model_version, processing_time_ms, sorted, patient_composites } = data;
  const s = summary;

  const summaryCards = [
    { cls: 'total', val: s.total_patients, label: 'Total Patients' },
    { cls: 'high', val: s.high_risk, label: 'High Risk' },
    { cls: 'mod', val: s.moderate_risk, label: 'Moderate Risk' },
    { cls: 'low', val: s.low_risk, label: 'Low Risk' },
    { cls: 'avg', val: (s.avg_risk_score * 100).toFixed(1) + '%', label: 'Avg Risk Score' },
  ];

  return (
    <section className="results active">
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <h2 className="sec-title">Risk Assessment Results</h2>
            <p className="sec-sub" style={{ marginBottom: 0 }}>
              Model: <strong>{model_version}</strong> | Processed in <strong>{processing_time_ms.toLocaleString()}</strong>ms
            </p>
          </div>
          <button className="btn btn-s btn-sm" onClick={onReset}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span> New Assessment
          </button>
        </div>

        <div className="sum-cards">
          {summaryCards.map((c) => (
            <div key={c.cls} className={`sum-card ${c.cls}`}>
              <div className="val">{c.val}</div>
              <div className="lbl">{c.label}</div>
            </div>
          ))}
        </div>

        <CompositeSection composites={patient_composites} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--accent)' }}>medication</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Nunito', sans-serif" }}>Per-Drug Risk Scores</div>
        </div>
        <div className="rt-wrap">
          <table className="rt">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Drug</th>
                <th>Risk Score</th>
                <th>Category</th>
                <th>Days Overdue</th>
                <th>Intervention</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, idx) => {
                const cat = catClass(p.risk_category);
                const pct = (p.risk_score * 100).toFixed(1);
                return (
                  <tr key={idx} onClick={() => onViewDetail(idx)}>
                    <td><strong>{p.patient_id}</strong></td>
                    <td>{p.drug_name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`risk-dot ${cat}`} />
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{pct}%</span>
                        {p.prediction_interval && (
                          <span style={{ fontSize: 11, color: '#6b7280' }}>
                            [{(p.prediction_interval.lower * 100).toFixed(0)}&ndash;{(p.prediction_interval.upper * 100).toFixed(0)}%]
                          </span>
                        )}
                      </div>
                      <div className="score-track">
                        <div className={`score-fill ${cat}`} style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td>
                      <span className={`risk-badge ${cat}`}>{p.risk_category}</span>
                      {p.uncertain && (
                        <span style={{ fontSize: 10, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '1px 6px', marginLeft: 4 }}>uncertain</span>
                      )}
                    </td>
                    <td>{p.days_overdue > 0 ? p.days_overdue + ' days' : '\u2014'}</td>
                    <td style={{ fontSize: 13 }}>{p.intervention_window}</td>
                    <td>
                      <button
                        className="view-btn"
                        onClick={(e) => { e.stopPropagation(); onViewDetail(idx); }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
