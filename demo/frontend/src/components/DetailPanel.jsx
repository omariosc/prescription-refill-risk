import { useEffect, useRef } from 'react';
import InterventionPanel from './InterventionPanel';

const STATUS_LABELS = {
  on_time: 'On Time',
  early: 'Early',
  slightly_late: 'Slight Delay',
  late: 'Late',
  current: 'Current',
};

const REC_ICONS = {
  urgent: 'error',
  high: 'warning',
  medium: 'info',
  low: 'check_circle',
};

const COLORS = { high: '#e8423a', mod: '#e89c0d', low: '#10b981' };

function catClass(category) {
  return category === 'MODERATE' ? 'mod' : category.toLowerCase();
}

export default function DetailPanel({ patient: p, onClose, onConfirmIntervention }) {
  const fillArcRef = useRef(null);
  const cat = catClass(p.risk_category);
  const pct = (p.risk_score * 100).toFixed(1);
  const arcLen = 157.08;
  const offset = arcLen * (1 - p.risk_score);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => {
      if (fillArcRef.current) {
        fillArcRef.current.setAttribute('stroke-dashoffset', String(offset));
      }
    }, 50);

    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEsc);
      clearTimeout(timer);
    };
  }, [onClose, offset]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Patient summary items
  const infoItems = [
    ['Last Fill', p.last_fill_date || '\u2014'],
    ['Days Supply', p.days_supply + ' days'],
    ['Next Expected Refill', p.next_expected_refill],
    ['Days Overdue', p.days_overdue > 0 ? p.days_overdue + ' days' : 'On track'],
    ['Patient Copay', '$' + p.patient_pay_amt.toFixed(2)],
    ['Total Drug Cost', '$' + p.total_drug_cost.toFixed(2)],
  ];
  if (p.age) infoItems.push(['Age', p.age + 'y']);
  if (p.chronic_conditions && p.chronic_conditions.length) {
    infoItems.push(['Conditions', p.chronic_conditions.join(', ')]);
  }

  // Tier info colors keyed by risk category
  const TIER_COLORS = {
    high: { bg: '#fef2f2', border: '#fecaca', title: '#991b1b', body: '#dc2626' },
    mod:  { bg: '#fffbeb', border: '#fde68a', title: '#92400e', body: '#b45309' },
    low:  { bg: '#f0fdf4', border: '#bbf7d0', title: '#166534', body: '#15803d' },
  };
  const tc = TIER_COLORS[cat] || TIER_COLORS.low;

  // SHAP max
  const maxImp = Math.max(...p.drivers.map((d) => Math.abs(d.impact)), 0.01);

  return (
    <div className="overlay active" onClick={handleOverlayClick}>
      <div className="panel">
        <div className="panel-hdr">
          <div className="panel-hdr-top">
            <div>
              <div className="panel-pid">{p.patient_id}</div>
              <div className="panel-drug">{p.drug_name}</div>
            </div>
            <button className="panel-close" onClick={onClose}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="panel-body">
          {/* SVG Gauge */}
          <div className="gauge-sec">
            <svg viewBox="0 0 120 75" width="220" className="gauge-svg">
              <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#f0f0f0" strokeWidth="12" strokeLinecap="round" />
              <path
                ref={fillArcRef}
                d="M 10 65 A 50 50 0 0 1 110 65"
                fill="none"
                stroke={COLORS[cat]}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={String(arcLen)}
                strokeDashoffset={String(arcLen)}
                style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
              />
              <text x="60" y="58" textAnchor="middle" fontSize="20" fontWeight="800" fontFamily="Nunito,sans-serif" fill={COLORS[cat]}>
                {pct}%
              </text>
            </svg>
            <div>
              <span className={`risk-badge ${cat}`} style={{ fontSize: 13, padding: '6px 18px' }}>{p.risk_category} RISK</span>
            </div>
            <div className="gauge-lbl">Late Refill Risk Score</div>

            {p.prediction_interval && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                90% interval: {(p.prediction_interval.lower * 100).toFixed(1)}% &ndash; {(p.prediction_interval.upper * 100).toFixed(1)}%
              </div>
            )}

            <div className="conf-badge">Model confidence: {(p.confidence * 100).toFixed(1)}%</div>

            {p.uncertain && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--sm)', padding: '8px 12px', fontSize: 12, color: '#92400e', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#d97706' }}>warning</span>
                Uncertain: prediction interval spans multiple risk tiers. Consider clinical review before acting on tier alone.
              </div>
            )}

            {p.tier_info && (
              <div style={{ background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: 'var(--sm)', padding: '12px 16px', marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tc.title, marginBottom: 4 }}>What {p.risk_category} risk means</div>
                <div style={{ fontSize: 12, color: tc.body, lineHeight: 1.5 }}>{p.tier_info.description}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                  Based on calibration analysis of 180,158 test fills. {p.tier_info.population_share} of patients fall in this tier.
                </div>
              </div>
            )}
          </div>

          {/* Patient Summary */}
          <div className="d-sec">
            <h3>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>info</span> Patient Summary
            </h3>
            <div className="info-grid">
              {infoItems.map(([label, val]) => (
                <div key={label} className="info-item">
                  <div className="info-lbl">{label}</div>
                  <div
                    className="info-val"
                    style={label === 'Days Overdue' ? { color: p.days_overdue > 0 ? 'var(--coral)' : '#059669' } : undefined}
                  >
                    {val}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          {p.timeline && p.timeline.length > 0 && (
            <div className="d-sec">
              <h3>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>timeline</span> Prescription Timeline
              </h3>
              <div className="timeline">
                {p.timeline.map((ev, i) => {
                  const gapText = ev.gap_days !== null
                    ? ev.gap_days > 0
                      ? `+${ev.gap_days} day${ev.gap_days !== 1 ? 's' : ''} gap after run-out`
                      : ev.gap_days < 0
                        ? `${Math.abs(ev.gap_days)} day${Math.abs(ev.gap_days) !== 1 ? 's' : ''} early refill`
                        : 'Refilled on run-out date'
                    : null;
                  const gapClass = ev.gap_days > 0 ? 'positive' : ev.gap_days < 0 ? 'negative' : 'zero';

                  return (
                    <div key={i} className="tl-event">
                      <div className={`tl-dot ${ev.status}`} />
                      <div className="tl-card">
                        <div className="tl-header">
                          <span className="tl-fill-label">Fill #{ev.fill_number} — {ev.fill_date}</span>
                          <span className={`tl-status ${ev.status}`}>{STATUS_LABELS[ev.status] || ev.status}</span>
                        </div>
                        <div className="tl-details">
                          <span>Supply: {p.days_supply} days</span>
                          <span>Run-out: {ev.run_out_date}</span>
                          {ev.next_fill_date ? (
                            <span>Next fill: {ev.next_fill_date}</span>
                          ) : (
                            <span style={{ color: p.days_overdue > 0 ? 'var(--coral)' : 'var(--navy)', fontWeight: 600 }}>
                              {p.days_overdue > 0 ? 'Overdue \u2014 awaiting refill' : 'Awaiting next fill'}
                            </span>
                          )}
                        </div>
                        {gapText && (
                          <div className={`tl-gap ${gapClass}`}>{gapText}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SHAP Drivers */}
          <div className="d-sec">
            <h3>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>analytics</span> Risk Drivers (SHAP)
            </h3>
            {p.drivers.map((d, i) => {
              const bw = (Math.abs(d.impact) / maxImp) * 45;
              return (
                <div key={i} className="driver-row">
                  <div className="driver-label">{d.feature}</div>
                  <div className="driver-bar-wrap">
                    <div className="driver-center" />
                    <div
                      className={`driver-bar ${d.direction}`}
                      style={{ width: `${bw}%` }}
                    />
                  </div>
                  <div className={`driver-val ${d.direction}`}>
                    {d.direction === 'risk' ? '+' : ''}{(d.impact * 100).toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommendations */}
          <div className="d-sec">
            <h3>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>checklist</span> Recommended Actions
            </h3>
            {p.recommendations.map((r, i) => (
              <div key={i} className={`rec-item ${r.priority}`}>
                <span className="material-symbols-outlined rec-icon" style={{ fontSize: 20 }}>{REC_ICONS[r.priority]}</span>
                <div>
                  <div className="rec-text">{r.text}</div>
                  {r.reason && <div className="rec-reason">{r.reason}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Clinician Intervention */}
          <InterventionPanel patient={p} onConfirm={(interventionId, patientId) => {
            if (onConfirmIntervention) onConfirmIntervention(interventionId, patientId);
          }} />

          {/* Disclaimer */}
          <div style={{ background: '#fffbeb', borderRadius: 'var(--sm)', padding: '12px 16px', fontSize: 12, color: '#92400e', marginTop: 8 }}>
            <strong>Disclaimer: </strong>
            Risk scores generated from synthetic CMS DE-SynPUF data. Not clinical advice. For demonstration purposes only.
          </div>
        </div>
      </div>
    </div>
  );
}
