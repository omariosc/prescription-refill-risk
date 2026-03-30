const STEPS = [
  {
    num: 1,
    color: 'var(--navy)',
    icon: 'database',
    title: 'Data Collection',
    tech: 'CMS DE-SynPUF',
    desc: 'We start with eight linked datasets covering three years of anonymised prescription records, hospital admissions, outpatient visits, and physician encounters \u2014 joined together for each patient.',
    stats: [
      { icon: 'description', text: '5.5 million prescription fills' },
      { icon: 'groups', text: '99,538 patients' },
      { icon: 'calendar_month', text: '2008\u20132010' },
    ],
  },
  {
    num: 2,
    color: '#0088b3',
    icon: 'cleaning_services',
    title: 'Cleaning & Validation',
    desc: 'Records with missing supply durations or cancelled prescriptions are removed. Clinical codes are standardised, date formats are unified, and patients who passed away are appropriately handled so their data doesn\u2019t distort the model.',
    stats: [
      { icon: 'filter_alt', text: '117,749 invalid records removed' },
      { icon: 'sync_alt', text: '11 condition flags remapped' },
      { icon: 'person_off', text: '2,301 death-censored fills' },
    ],
  },
  {
    num: 3,
    color: '#00a89e',
    icon: 'label',
    title: 'Defining \u201CLate\u201D',
    tech: 'Label Construction',
    desc: 'For each prescription, we calculate when the supply should run out. If the patient\u2019s next refill arrives more than seven days after that date, we mark it as late. This gives us a clear yes-or-no target the model can learn from.',
    stats: [
      { icon: 'assignment', text: '1.47 million labelled fills' },
      { icon: 'timer', text: '7-day grace window' },
    ],
  },
  {
    num: 4,
    color: 'var(--accent)',
    icon: 'construction',
    title: 'Building the Signals',
    tech: 'Feature Engineering',
    desc: 'We extract 67 measurable signals from each patient\u2019s history \u2014 including how regular their past refills have been, their age, chronic conditions, hospital visits, and prescription costs. Each signal only uses information available before the prediction point, preventing the model from \u201Cseeing the future\u201D.',
    chart: [
      { label: 'Refill regularity', pct: 78, value: '35%', color: 'var(--navy)' },
      { label: 'Supply duration', pct: 47, value: '21%', color: '#0088b3' },
      { label: 'Average refill gap', pct: 36, value: '16%', color: '#00a89e' },
      { label: 'Fill history length', pct: 16, value: '7%', color: 'var(--accent)' },
      { label: 'Past late refills', pct: 11, value: '5%', color: '#6ec6c6' },
      { label: 'Other 62 signals', pct: 36, value: '16%', color: '#9ca3af' },
    ],
  },
  {
    num: 5,
    color: '#005c8f',
    icon: 'model_training',
    title: 'Training the Model',
    tech: 'LightGBM',
    desc: 'A gradient-boosted decision tree model learns which combinations of signals best predict late refills. Crucially, training uses only historical data and is tested on a separate future time period \u2014 just as it would work in practice.',
    metrics: [
      { value: '0.856', label: 'Validation PR-AUC', color: 'var(--navy)' },
      { value: '0.737', label: 'Test PR-AUC', color: 'var(--heading)' },
      { value: '141', label: 'Decision trees', color: 'var(--accent)' },
    ],
  },
  {
    num: 6,
    color: '#003052',
    icon: 'tune',
    title: 'Calibration & Uncertainty',
    desc: 'Raw model scores are mapped to real-world risk tiers based on actual observed late rates in our test population. Each prediction also includes a confidence range \u2014 when the model is unsure, it says so, so clinicians can apply their own judgement.',
    tiers: [
      { value: '76%', label: 'HIGH actual late rate', sub: 'score \u2265 0.55', cls: 'high' },
      { value: '61%', label: 'MODERATE actual late rate', sub: 'score 0.30\u20130.55', cls: 'mod' },
      { value: '40%', label: 'LOW actual late rate', sub: 'score < 0.30', cls: 'low' },
    ],
  },
  {
    num: 7,
    color: 'var(--accent)',
    numColor: 'var(--navy)',
    icon: 'dashboard',
    title: 'Actionable Risk Report',
    desc: 'The final output for each patient: a risk tier with a plain-language explanation, the top factors driving their score, a confidence range the clinician can see at a glance, and a recommended next step \u2014 from passive monitoring to immediate pharmacist outreach.',
    highlight: true,
    stats: [
      { icon: 'analytics', text: 'SHAP-explained drivers' },
      { icon: 'medication', text: 'Real drug names via RxNorm' },
      { icon: 'shield', text: '90% confidence intervals' },
    ],
  },
];

function PipelineStep({ step, isLast }) {
  return (
    <div className="pipe-step">
      <div>
        <div className="pipe-num" style={{ background: step.color, color: step.numColor || '#fff' }}>
          {step.num}
        </div>
        {!isLast && <div className="pipe-line" />}
      </div>
      <div
        className="pipe-card"
        style={step.highlight ? { borderColor: 'var(--accent)', background: 'linear-gradient(135deg, rgba(0,224,188,.04), rgba(0,224,188,.08))' } : undefined}
      >
        <h3>
          <span className="material-symbols-outlined">{step.icon}</span>
          {' '}{step.title}
          {step.tech && <span className="pipe-tech">({step.tech})</span>}
        </h3>
        <p>{step.desc}</p>

        {step.stats && (
          <div style={{ marginTop: 10 }}>
            {step.stats.map((s, i) => (
              <span className="pipe-stat" key={i}>
                <span className="material-symbols-outlined">{s.icon}</span>
                {s.text}
              </span>
            ))}
          </div>
        )}

        {step.chart && (
          <div className="pipe-graph">
            <div className="pipe-graph-title">Top features by predictive importance</div>
            {step.chart.map((bar, i) => (
              <div className="pipe-bar-row" key={i}>
                <span className="pipe-bar-label">{bar.label}</span>
                <div className="pipe-bar-track">
                  <div className="pipe-bar-fill" style={{ width: bar.pct + '%', background: bar.color }}>
                    {bar.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {step.metrics && (
          <div className="pipe-mini">
            {step.metrics.map((m, i) => (
              <div className="pipe-mini-card" key={i}>
                <div className="mini-val" style={{ color: m.color }}>{m.value}</div>
                <div className="mini-lbl">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {step.tiers && (
          <div className="pipe-mini">
            {step.tiers.map((t, i) => (
              <div className="pipe-mini-card" key={i}>
                <div className={`mini-val ${t.cls}`}>{t.value}</div>
                <div className="mini-lbl">{t.label}<br />{t.sub}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelineExplainer() {
  return (
    <section className="pipeline" id="how-it-works">
      <div className="container">
        <h2 className="sec-title">How It Works</h2>
        <p className="sec-sub">
          From raw prescription records to an actionable risk score &mdash; a seven-stage
          pipeline built for transparency.
        </p>
        <div className="pipe-steps">
          {STEPS.map((step, i) => (
            <PipelineStep key={step.num} step={step} isLast={i === STEPS.length - 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
