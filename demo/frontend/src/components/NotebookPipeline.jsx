import { useState, useEffect, useRef, useCallback } from 'react';

const STEP_DURATION = 3200; // ms per step while hovering

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
      { num: 0, icon: 'settings',       title: 'Setup',                  desc: 'Configure environment, import libraries, and define global parameters for the cleaning pipeline.' },
      { num: 1, icon: 'cloud_download', title: 'Load Raw Data',           desc: 'Import the 5.5M-row prescription drug events file and beneficiary summary files for 2008–2010.' },
      { num: 2, icon: 'filter_alt',     title: 'Clean PDE',               desc: 'Remove zero-supply records, void prescriptions, and invalid drug codes. Remap chronic condition flags from 1/2 to 0/1.' },
      { num: 3, icon: 'merge',          title: 'Merge PDE + Beneficiary', desc: 'Year-match each fill to the corresponding beneficiary demographics and chronic condition flags.' },
      { num: 4, icon: 'construction',   title: 'Feature Engineering',     desc: 'Derive refill gap metrics, cadence stability scores, polypharmacy counts, and rolling late-fill fractions.' },
      { num: 5, icon: 'medication',     title: 'NDC Drug Metadata',       desc: 'Join NDC-5 drug group codes to human-readable names, enriching the dataset with interpretable drug labels.' },
      { num: 6, icon: 'monitor_heart',  title: 'PDC Scores',              desc: 'Calculate Proportion of Days Covered (PDC) per patient-drug — a standard pharmacy adherence metric.' },
      { num: 7, icon: 'save',           title: 'Final Export',            desc: 'Write the cleaned, merged, feature-rich dataset to a single Parquet file ready for EDA and modelling.' },
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
      { num: 1,  icon: 'label',              title: 'Load & Label',           desc: 'Load the cleaned dataset and construct the binary late refill label using a 14-day grace window.' },
      { num: 2,  icon: 'fact_check',         title: 'Data Quality',           desc: 'Audit the dataset for missing values and distribution anomalies before analysis.' },
      { num: 3,  icon: 'calendar_month',     title: 'Temporal Patterns',      desc: 'Examine refill timing across years and months, revealing the 2010 volume truncation artifact.' },
      { num: 4,  icon: 'groups',             title: 'Demographics',           desc: 'Explore how age, sex, race, and chronic condition burden relate to late refill behaviour.' },
      { num: 5,  icon: 'medication',         title: 'Drug & Dispensing',      desc: 'Analyse late rates by drug group, days of supply (30 vs 90-day), and dispensing quantity.' },
      { num: 6,  icon: 'medical_information',title: 'Comorbidity Landscape',  desc: 'Map chronic condition prevalence and co-occurrence patterns among patients who refill late.' },
      { num: 7,  icon: 'payments',           title: 'Financial Signals',      desc: 'Investigate how copay amounts and total drug costs correlate with adherence behaviour.' },
      { num: 8,  icon: 'engineering',        title: 'Engineered Flags',       desc: 'Validate derived features — cadence stability, early-refill flags, PDC scores — for predictive signal.' },
      { num: 9,  icon: 'person_search',      title: 'Late Refiller Analysis', desc: 'Deep-dive into the profiles of chronic late refillers: demographic patterns, top drugs, and risk factors.' },
      { num: 10, icon: 'hub',                title: 'Correlation',            desc: 'Compute feature-target correlations and identify multicollinearity to guide feature selection.' },
      { num: 11, icon: 'summarize',          title: 'EDA Summary',            desc: 'Synthesise key findings and surface the most actionable signals for the modelling phase.' },
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
      { num: 0,  icon: 'settings',       title: 'Setup',                  desc: 'Configure environment, define the 14-day grace window, and initialise LightGBM and SHAP dependencies.' },
      { num: 1,  icon: 'cloud_download', title: 'Load Data',              desc: 'Import the cleaned prescription dataset and beneficiary files ready for label construction.' },
      { num: 2,  icon: 'label',          title: 'Build Target Variable',  desc: 'Compute run-out dates, identify next fills, apply the grace window, and assign is_late labels. Exclude death-censored and last fills.' },
      { num: 3,  icon: 'construction',   title: 'Feature Engineering',    desc: 'Build 67 predictive signals from fill history, demographics, inpatient events, outpatient visits, and carrier claims.' },
      { num: 4,  icon: 'call_split',     title: 'Train / Test Split',     desc: 'Time-based split: 2008–mid-2009 for training, late 2009 for validation, 2010 as the held-out test set.' },
      { num: 5,  icon: 'trending_flat',  title: 'Baseline Model',         desc: 'Fit a Logistic Regression baseline to establish a PR-AUC floor before moving to gradient boosting.' },
      { num: 6,  icon: 'auto_awesome',   title: 'LightGBM Model',         desc: 'Train a gradient-boosted ensemble with class balancing, early stopping, and hyperparameter tuning.' },
      { num: 7,  icon: 'analytics',      title: 'Evaluation',             desc: 'Compute PR-AUC (0.856 val, 0.737 test), ROC-AUC, calibration curves, and per-threshold precision/recall.' },
      { num: 8,  icon: 'lightbulb',      title: 'SHAP Explainability',    desc: 'Generate SHAP values to rank feature importance and produce per-patient waterfall explanation charts.' },
      { num: 9,  icon: 'person_search',  title: 'Patient Risk Demo',      desc: 'Score individual patients, surface top risk drivers, and render a refill timeline for clinical review.' },
      { num: 10, icon: 'save',           title: 'Save Outputs',           desc: 'Export metrics to outputs/metrics.json, save feature importance plots, and persist the trained model.' },
    ],
  },
];

/* ── Horizontal step-dot track ────────────────────────────────────── */
function StepTrack({ steps, activeIndex, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 16px', padding: '0 2px' }}>
      {steps.map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : undefined }}>
          <div
            style={{
              width:  i === activeIndex ? 11 : 6,
              height: i === activeIndex ? 11 : 6,
              borderRadius: '50%',
              background: i < activeIndex ? 'var(--accent)' : i === activeIndex ? accent : '#d1d5db',
              transition: 'all 350ms cubic-bezier(0.34,1.56,0.64,1)',
              flexShrink: 0,
              boxShadow: i === activeIndex ? `0 0 0 3px ${accent}22` : 'none',
            }}
          />
          {i < steps.length - 1 && (
            <div style={{
              flex: 1,
              height: 2,
              borderRadius: 1,
              background: i < activeIndex ? 'var(--accent)' : '#e5e7eb',
              transition: 'background 350ms ease',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── CSS-animation timer bar ──────────────────────────────────────── */
function TimerBar({ running, resetKey, accent }) {
  return (
    <div style={{ height: 3, background: '#f0f2f5', borderRadius: '0 0 14px 14px', overflow: 'hidden', marginTop: 14 }}>
      <div
        key={resetKey}
        style={{
          height: '100%',
          background: accent,
          transformOrigin: 'left',
          transform: 'scaleX(0)',
          animation: running ? `nb-timer-fill ${STEP_DURATION}ms linear forwards` : 'none',
        }}
      />
    </div>
  );
}

/* ── Individual notebook card ─────────────────────────────────────── */
function NotebookCard({ nb, isActive, isLast, onComplete }) {
  const [activeIndex, setActiveIndex]   = useState(0);
  const [animKey,     setAnimKey]       = useState(0);
  const [timerKey,    setTimerKey]      = useState(0);
  const [hovered,     setHovered]       = useState(false);
  const [completed,   setCompleted]     = useState(false);
  const intervalRef = useRef(null);

  /* Reset when this card gains/loses focus as the active notebook */
  useEffect(() => {
    setActiveIndex(0);
    setAnimKey(k => k + 1);
    setTimerKey(k => k + 1);
    setCompleted(false);
    setHovered(false);
    clearInterval(intervalRef.current);
  }, [isActive]);

  /* When completed, wait briefly then signal parent to advance */
  useEffect(() => {
    if (!completed) return;
    clearInterval(intervalRef.current);
    const t = setTimeout(() => onComplete && onComplete(), 900);
    return () => clearTimeout(t);
  }, [completed, onComplete]);

  /* Auto-advance only while active + hovered + not done */
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!isActive || !hovered || completed) return;

    intervalRef.current = setInterval(() => {
      setActiveIndex(prev => {
        if (prev >= nb.steps.length - 1) {
          setCompleted(true);
          return prev;
        }
        const next = prev + 1;
        setAnimKey(k => k + 1);
        setTimerKey(k => k + 1);
        return next;
      });
    }, STEP_DURATION);

    return () => clearInterval(intervalRef.current);
  }, [isActive, hovered, completed, nb.steps.length]);

  const goToStep = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(nb.steps.length - 1, idx));
    if (clamped === activeIndex) return;
    setActiveIndex(clamped);
    setAnimKey(k => k + 1);
    setTimerKey(k => k + 1);
    if (completed) setCompleted(false);
  }, [nb.steps.length, activeIndex, completed]);

  const step = nb.steps[activeIndex];
  const timerRunning = isActive && hovered && !completed;

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${isActive ? '#d1d5db' : 'var(--border)'}`,
        borderRadius: 14,
        padding: '22px 22px 14px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxShadow: isActive ? '0 8px 32px rgba(0,0,0,.14)' : 'var(--shadow)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow 400ms ease',
        userSelect: 'none',
      }}
      onMouseEnter={() => { if (isActive) setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: nb.accent, borderRadius: '14px 14px 0 0' }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 8, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: nb.accent, color: '#fff',
            borderRadius: 6, padding: '2px 9px',
            fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
            marginBottom: 7,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{nb.icon}</span>
            {nb.badge}
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', margin: '0 0 2px', fontFamily: "'Nunito', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nb.title}
          </h3>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nb.subtitle}</p>
        </div>

        <a
          href={nb.nbviewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'var(--grey)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '5px 9px',
            fontSize: 11, fontWeight: 600, color: 'var(--navy)', textDecoration: 'none',
            flexShrink: 0, marginLeft: 10,
            transition: 'background 150ms, border-color 150ms',
          }}
          onClick={e => e.stopPropagation()}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-muted)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--grey)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
          View
        </a>
      </div>

      {/* Step track */}
      <StepTrack steps={nb.steps} activeIndex={activeIndex} accent={nb.accent} />

      {/* Active step content */}
      <div
        key={animKey}
        style={{
          flex: 1,
          background: completed
            ? 'linear-gradient(135deg, #f0fdf9 0%, #ecfdf5 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #f0fdf9 100%)',
          border: `1px solid ${completed ? '#a7f3d0' : 'var(--border)'}`,
          borderRadius: 10,
          padding: '14px 16px',
          minHeight: 128,
          animation: 'nb-step-in 280ms ease-out',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {completed ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#10b981', display: 'block', marginBottom: 6 }}>check_circle</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>All steps complete</div>
            {!isLast && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Advancing to next notebook…</div>}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: nb.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#fff' }}>{step.icon}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Step {step.num}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {step.title}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        {/* Hover hint / step counter */}
        {isActive && !hovered && !completed ? (
          <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4, animation: 'nb-pulse 2s ease-in-out infinite' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>touch_app</span>
            Hover to step through
          </span>
        ) : (
          <span style={{ fontSize: 11, color: completed ? '#059669' : '#9ca3af', fontWeight: 500 }}>
            {completed ? '' : `${activeIndex + 1} / ${nb.steps.length}`}
          </span>
        )}

        {/* Prev / next step buttons */}
        {!completed && (
          <div style={{ display: 'flex', gap: 3 }}>
            <button
              onClick={e => { e.stopPropagation(); goToStep(activeIndex - 1); }}
              disabled={activeIndex === 0}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', cursor: activeIndex === 0 ? 'not-allowed' : 'pointer', opacity: activeIndex === 0 ? 0.35 : 1, color: '#6b7280', display: 'flex', alignItems: 'center', transition: 'all 150ms' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>chevron_left</span>
            </button>
            <button
              onClick={e => { e.stopPropagation(); goToStep(activeIndex + 1); }}
              disabled={activeIndex === nb.steps.length - 1}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', cursor: activeIndex === nb.steps.length - 1 ? 'not-allowed' : 'pointer', opacity: activeIndex === nb.steps.length - 1 ? 0.35 : 1, color: '#6b7280', display: 'flex', alignItems: 'center', transition: 'all 150ms' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>chevron_right</span>
            </button>
          </div>
        )}
      </div>

      <TimerBar running={timerRunning} resetKey={timerKey} accent={nb.accent} />
    </div>
  );
}

/* ── Carousel / main export ───────────────────────────────────────── */
export default function NotebookPipeline() {
  const [activeNb, setActiveNb] = useState(0);

  const goTo = useCallback((idx) => {
    setActiveNb(Math.max(0, Math.min(NOTEBOOKS.length - 1, idx)));
  }, []);

  /* Stable callback so NotebookCard's useEffect doesn't churn */
  const handleComplete = useCallback(() => {
    setActiveNb(prev => Math.min(prev + 1, NOTEBOOKS.length - 1));
  }, []);

  /* Keyboard left / right */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') setActiveNb(n => Math.min(n + 1, NOTEBOOKS.length - 1));
      else if (e.key === 'ArrowLeft') setActiveNb(n => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section className="pipeline" id="how-it-works">
      <div className="container">
        <h2 className="sec-title">How It Works</h2>
        <p className="sec-sub" style={{ maxWidth: 580 }}>
          Three notebooks take raw Medicare data all the way to a calibrated refill risk score.
          Hover the centred card to step through — when all steps finish it advances automatically.
        </p>

        {/* ── Spotlight carousel ── */}
        <div
          style={{
            position: 'relative',
            height: 440,
            overflow: 'hidden',
            margin: '0 -16px',
          }}
        >
          {NOTEBOOKS.map((nb, i) => {
            const pos = i - activeNb;
            const visible = Math.abs(pos) <= 1;
            return (
              <div
                key={nb.id}
                onClick={pos !== 0 && visible ? () => goTo(i) : undefined}
                style={{
                  position: 'absolute',
                  /* horizontally centre a 460px card */
                  left: 'calc(50% - 230px)',
                  width: 460,
                  height: '100%',
                  /* offset by 620px per position; scale side cards down */
                  transform: `translateX(${pos * 624}px) scale(${pos === 0 ? 1 : 0.87})`,
                  transformOrigin: 'top center',
                  opacity: pos === 0 ? 1 : visible ? 0.36 : 0,
                  filter: pos !== 0 ? 'blur(1.5px) saturate(0.6)' : 'none',
                  transition: 'transform 560ms cubic-bezier(0.4,0,0.2,1), opacity 450ms ease, filter 450ms ease',
                  zIndex: pos === 0 ? 10 : 5,
                  pointerEvents: visible ? 'auto' : 'none',
                  cursor: pos !== 0 ? 'pointer' : 'default',
                }}
                title={pos !== 0 ? `Switch to ${nb.badge} — ${nb.title}` : undefined}
              >
                <NotebookCard nb={nb} isActive={pos === 0} isLast={i === NOTEBOOKS.length - 1} onComplete={handleComplete} />
              </div>
            );
          })}

          {/* Left / right edge fade to blend peeking cards into background */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20,
              background: 'linear-gradient(to right, #fff 0%, transparent 11%, transparent 89%, #fff 100%)',
            }}
          />
        </div>

        {/* ── Notebook selector tabs ── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 26 }}>
          {NOTEBOOKS.map((nb, i) => (
            <button
              key={nb.id}
              onClick={() => goTo(i)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 24,
                border: `1.5px solid ${i === activeNb ? nb.accent : 'var(--border)'}`,
                background: i === activeNb ? nb.accent : 'transparent',
                color: i === activeNb ? '#fff' : '#6b7280',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 250ms ease',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{nb.icon}</span>
              {nb.badge} · {nb.title}
            </button>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, verticalAlign: 'middle', marginRight: 3 }}>keyboard</span>
          ← → arrow keys or click the side cards to switch
          &ensp;·&ensp;
          <span className="material-symbols-outlined" style={{ fontSize: 13, verticalAlign: 'middle', marginRight: 3 }}>open_in_new</span>
          <strong style={{ color: 'var(--navy)' }}>View</strong> opens the full notebook on nbviewer.org
        </p>
      </div>

      <style>{`
        @keyframes nb-step-in {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes nb-timer-fill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes nb-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </section>
  );
}
