function catClass(category) {
  return category === 'MODERATE' ? 'mod' : category.toLowerCase();
}

export default function ResultsTable({ data, onViewDetail, onReset }) {
  const { summary, model_version, processing_time_ms, sorted } = data;
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
