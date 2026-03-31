import { useState, useEffect, useRef, useCallback } from 'react';

const STEP_DURATION = 3500; // ms between auto-advances

const NOTEBOOKS = [
  {
    id: 'nb1',
    badge: 'NB 1',
    title: 'Data Cleaning',
    subtitle: 'Preparing raw CMS prescription data',
    icon: 'cleaning_services',
    accent: '#003052',
    nbviewerUrl:
      'https://nbviewer.org/github/omariosc/prescription-refill-risk/blob/main/notebooks/data_cleaning_clean.ipynb',
    steps: [
      {
        num: 0,
        icon: 'settings',
        title: 'Setup',
        desc: 'Configure environment, import libraries, and define global parameters for the cleaning pipeline.',
      },
      {
        num: 1,
        icon: 'cloud_download',
        title: 'Load Raw Data',
        desc: 'Import the 5.5M-row prescription drug events file and beneficiary summary files for 2008–2010.',
      },
      {
        num: 2,
        icon: 'filter_alt',
        title: 'Clean PDE',
        desc: 'Remove zero-supply records, void prescriptions, and invalid drug codes. Remap chronic condition flags from 1/2 to 0/1.',
      },
      {
        num: 3,
        icon: 'merge',
        title: 'Merge PDE + Beneficiary',
        desc: 'Year-match each fill to the corresponding beneficiary demographics and chronic condition flags.',
      },
      {
        num: 4,
        icon: 'construction',
        title: 'Feature Engineering',
        desc: 'Derive refill gap metrics, cadence stability scores, polypharmacy counts, and rolling late-fill fractions.',
      },
      {
        num: 5,
        icon: 'medication',
        title: 'NDC Drug Metadata',
        desc: 'Join NDC-5 drug group codes to human-readable names, enriching the dataset with interpretable drug labels.',
      },
      {
        num: 6,
        icon: 'monitor_heart',
        title: 'PDC Scores',
        desc: 'Calculate Proportion of Days Covered (PDC) per patient-drug — a standard pharmacy adherence metric.',
      },
      {
        num: 7,
        icon: 'save',
        title: 'Final Export',
        desc: 'Write the cleaned, merged, feature-rich dataset to a single Parquet file ready for EDA and modelling.',
      },
    ],
  },
  {
    id: 'nb2',
    badge: 'NB 2',
    title: 'Exploratory Analysis',
    subtitle: 'Understanding patterns in late refillers',
    icon: 'bar_chart',
    accent: '#006b75',
    nbviewerUrl:
      'https://nbviewer.org/github/omariosc/prescription-refill-risk/blob/main/notebooks/eda_with_late_refillers.ipynb',
    steps: [
      {
        num: 1,
        icon: 'label',
        title: 'Load & Label',
        desc: 'Load the cleaned dataset and construct the binary late refill label using a 7-day grace window.',
      },
      {
        num: 2,
        icon: 'fact_check',
        title: 'Data Quality',
        desc: 'Audit the dataset for missing values, class imbalance, and distribution anomalies before analysis.',
      },
      {
        num: 3,
        icon: 'calendar_month',
        title: 'Temporal Patterns',
        desc: 'Examine refill timing across years and months, revealing the 2010 volume truncation artifact.',
      },
      {
        num: 4,
        icon: 'groups',
        title: 'Demographics',
        desc: 'Explore how age, sex, race, and chronic condition burden relate to late refill behaviour.',
      },
      {
        num: 5,
        icon: 'medication',
        title: 'Drug & Dispensing',
        desc: 'Analyse late rates by drug group, days of supply (30 vs 90-day), and dispensing quantity.',
      },
      {
        num: 6,
        icon: 'medical_information',
        title: 'Comorbidity Landscape',
        desc: 'Map chronic condition prevalence and co-occurrence patterns among patients who refill late.',
      },
      {
        num: 7,
        icon: 'payments',
        title: 'Financial Signals',
        desc: 'Investigate how copay amounts and total drug costs correlate with adherence behaviour.',
      },
      {
        num: 8,
        icon: 'engineering',
        title: 'Engineered Flags',
        desc: 'Validate derived features — cadence stability, early-refill flags, PDC scores — for predictive signal.',
      },
      {
        num: 9,
        icon: 'person_search',
        title: 'Late Refiller Analysis',
        desc: 'Deep-dive into the profiles of chronic late refillers: demographic patterns, top drugs, and risk factors.',
      },
      {
        num: 10,
        icon: 'hub',
        title: 'Correlation',
        desc: 'Compute feature-target correlations and identify multicollinearity to guide feature selection.',
      },
      {
        num: 11,
        icon: 'summarize',
        title: 'EDA Summary',
        desc: 'Synthesise key findings and surface the most actionable signals for the modelling phase.',
      },
    ],
  },
  {
    id: 'nb3',
    badge: 'NB 3',
    title: 'Predictive Model',
    subtitle: 'LightGBM risk scoring with SHAP',
    icon: 'model_training',
    accent: '#00a599',
    nbviewerUrl:
      'https://nbviewer.org/github/omariosc/prescription-refill-risk/blob/main/notebooks/challenge_a_model.ipynb',
    steps: [
      {
        num: 0,
        icon: 'settings',
        title: 'Setup',
        desc: 'Configure environment, define the 7-day grace window, and initialise LightGBM and SHAP dependencies.',
      },
      {
        num: 1,
        icon: 'cloud_download',
        title: 'Load Data',
        desc: 'Import the cleaned prescription dataset and beneficiary files ready for label construction.',
      },
      {
        num: 2,
        icon: 'label',
        title: 'Build Target Variable',
        desc: 'Compute run-out dates, identify next fills, apply the grace window, and assign is_late labels. Exclude death-censored and last fills.',
      },
      {
        num: 3,
        icon: 'construction',
        title: 'Feature Engineering',
        desc: 'Build 67 predictive signals from fill history, demographics, inpatient events, outpatient visits, and carrier claims.',
      },
      {
        num: 4,
        icon: 'call_split',
        title: 'Train / Test Split',
        desc: 'Time-based split: 2008–mid-2009 for training, late 2009 for validation, 2010 as the held-out test set.',
      },
      {
        num: 5,
        icon: 'trending_flat',
        title: 'Baseline Model',
        desc: 'Fit a Logistic Regression baseline to establish a PR-AUC floor before moving to gradient boosting.',
      },
      {
        num: 6,
        icon: 'auto_awesome',
        title: 'LightGBM Model',
        desc: 'Train a gradient-boosted ensemble with class balancing, early stopping, and hyperparameter tuning.',
      },
      {
        num: 7,
        icon: 'analytics',
        title: 'Evaluation',
        desc: 'Compute PR-AUC (0.856 val, 0.737 test), ROC-AUC, calibration curves, and per-threshold precision/recall.',
      },
      {
        num: 8,
        icon: 'lightbulb',
        title: 'SHAP Explainability',
        desc: 'Generate SHAP values to rank feature importance and produce per-patient waterfall explanation charts.',
      },
      {
        num: 9,
        icon: 'person_search',
        title: 'Patient Risk Demo',
        desc: 'Score individual patients, surface top risk drivers, and render a refill timeline for clinical review.',
      },
      {
        num: 10,
        icon: 'save',
        title: 'Save Outputs',
        desc: 'Export metrics to outputs/metrics.json, save feature importance plots, and persist the trained model.',
      },
    ],
  },
];

/* ── Step dots + connector track ──────────────────────────────────── */
function StepTrack({ steps, activeIndex }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
        margin: '0 0 18px',
      }}
    >
      {steps.map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? '1' : undefined }}>
          <div
            style={{
              width: i === activeIndex ? 12 : 7,
              height: i === activeIndex ? 12 : 7,
              borderRadius: '50%',
              background:
                i < activeIndex
                  ? 'var(--accent)'
                  : i === activeIndex
                  ? 'var(--navy)'
                  : '#d1d5db',
              transition: 'all 300ms cubic-bezier(0.34,1.56,0.64,1)',
              flexShrink: 0,
              boxShadow: i === activeIndex ? '0 0 0 3px rgba(0,48,82,.12)' : 'none',
            }}
          />
          {i < steps.length - 1 && (
            <div
              style={{
                flex: 1,
                height: 2,
                borderRadius: 1,
                background: i < activeIndex ? 'var(--accent)' : '#e5e7eb',
                transition: 'background 300ms ease',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Timer bar at card bottom ─────────────────────────────────────── */
function TimerBar({ running, duration, resetKey }) {
  const [width, setWidth] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    setWidth(0);
    if (!running) return;
    startRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startRef.current;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setWidth(pct);
      if (pct < 100) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, resetKey]);

  return (
    <div
      style={{
        height: 3,
        background: '#f3f4f6',
        borderRadius: '0 0 14px 14px',
        overflow: 'hidden',
        margin: '12px -24px -22px',
      }}
    >
      <div
        style={{
          width: width + '%',
          height: '100%',
          background: 'var(--accent)',
          transition: running ? 'none' : 'width 200ms ease',
        }}
      />
    </div>
  );
}

/* ── Individual notebook card ─────────────────────────────────────── */
function NotebookCard({ nb }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const timerRef = useRef(null);

  const goTo = useCallback(
    (idx) => {
      setActiveIndex(idx);
      setAnimKey((k) => k + 1);
      setTimerKey((k) => k + 1);
    },
    []
  );

  const advance = useCallback(() => {
    setActiveIndex((prev) => {
      const next = (prev + 1) % nb.steps.length;
      setAnimKey((k) => k + 1);
      setTimerKey((k) => k + 1);
      return next;
    });
  }, [nb.steps.length]);

  useEffect(() => {
    if (hovered) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(advance, STEP_DURATION);
    return () => clearInterval(timerRef.current);
  }, [hovered, advance]);

  const step = nb.steps[activeIndex];

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow)',
        transition: 'box-shadow 200ms, transform 200ms',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {/* Top accent strip */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: nb.accent,
          borderRadius: '14px 14px 0 0',
        }}
      />

      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 8, marginBottom: 14 }}>
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: nb.accent,
              color: '#fff',
              borderRadius: 6,
              padding: '2px 10px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              {nb.icon}
            </span>
            {nb.badge}
          </div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--navy)',
              marginBottom: 2,
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {nb.title}
          </h3>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{nb.subtitle}</p>
        </div>

        {/* Open in nbviewer button */}
        <a
          href={nb.nbviewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View full notebook"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--grey)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--navy)',
            textDecoration: 'none',
            transition: 'all 150ms',
            flexShrink: 0,
            marginLeft: 8,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-muted)';
            e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--grey)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
          View
        </a>
      </div>

      {/* Step track */}
      <StepTrack steps={nb.steps} activeIndex={activeIndex} />

      {/* Active step content */}
      <div
        key={animKey}
        style={{
          flex: 1,
          background: 'linear-gradient(135deg, var(--grey) 0%, #f0fdf9 100%)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '16px 18px',
          minHeight: 130,
          animation: 'nb-slide-in 300ms ease-out',
        }}
      >
        {/* Step icon + number */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: nb.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fff' }}>
              {step.icon}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Step {step.num}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', lineHeight: 1.2 }}>
              {step.title}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6, margin: 0 }}>
          {step.desc}
        </p>
      </div>

      {/* Step counter + dot navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
          Step {activeIndex + 1} of {nb.steps.length}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => goTo((activeIndex - 1 + nb.steps.length) % nb.steps.length)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 150ms',
            }}
            title="Previous step"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_left</span>
          </button>
          <button
            onClick={() => goTo((activeIndex + 1) % nb.steps.length)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 150ms',
            }}
            title="Next step"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
          </button>
        </div>
      </div>

      {/* Timer bar */}
      <TimerBar running={!hovered} duration={STEP_DURATION} resetKey={timerKey} />

      <style>{`
        @keyframes nb-slide-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── Main export ──────────────────────────────────────────────────── */
export default function NotebookPipeline() {
  return (
    <section className="pipeline" id="how-it-works">
      <div className="container">
        <h2 className="sec-title">How It Works</h2>
        <p className="sec-sub">
          Three notebooks take raw Medicare claims data all the way to a calibrated refill risk score.
          Each card auto-advances — hover to pause, or click the arrows to explore.
        </p>

        <div className="nb-grid">
          {NOTEBOOKS.map((nb) => (
            <NotebookCard key={nb.id} nb={nb} />
          ))}
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: '#9ca3af',
            marginTop: 20,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>
            open_in_new
          </span>
          Click <strong style={{ color: 'var(--navy)' }}>View</strong> on any card to open the fully rendered notebook on nbviewer.org
        </p>
      </div>

      <style>{`
        .nb-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 900px) {
          .nb-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 600px) {
          .nb-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
