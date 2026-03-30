import { useState } from "react";

const STEPS = [
  {
    num: 1, color: "#003052", icon: "database",
    title: "Data Collection", tech: "CMS DE-SynPUF",
    desc: "We start with eight linked datasets covering three years of anonymised prescription records, hospital admissions, outpatient visits, and physician encounters, joined together for each patient.",
    stats: [
      { icon: "description", text: "5.5 million prescription fills" },
      { icon: "groups", text: "99,538 patients" },
      { icon: "calendar_month", text: "2008 to 2010" },
    ],
    detail: {
      title: "Data Collection: What Goes In",
      sections: [
        { heading: "Eight source files", body: "The CMS DE-SynPUF (Data Entrepreneurs' Synthetic Public Use File) is a fully synthetic recreation of three years of Medicare Part D claims. It contains prescription drug events, beneficiary demographics, inpatient hospitalisations, outpatient visits, and physician (carrier) claims. All files link on a pseudonymised patient identifier." },
        { heading: "Why multiple files matter", body: "A prescription fill alone tells us what was dispensed and when. But to predict whether someone will refill on time, we also need to know: are they hospitalised (which disrupts routines)? Do they have chronic conditions (which affect adherence patterns)? How often do they see a doctor (a proxy for healthcare engagement)? Each file adds a different dimension of context." },
        { heading: "Key numbers", list: ["5,552,421 raw prescription events before cleaning", "116,352 unique beneficiaries across all years", "66,773 inpatient claims (hospital admissions)", "790,790 outpatient claims (clinic visits)", "4,741,335 carrier claims (physician encounters, loaded in memory-safe chunks)"] },
        { heading: "Synthetic data caveat", body: "This dataset was designed for software development and training, not clinical research. All variables have been imputed, suppressed, or coarsened as part of disclosure treatment. Correlations between variables are deliberately altered. We acknowledge this throughout and present all outputs as a modelling exercise." },
      ],
    },
  },
  {
    num: 2, color: "#004d64", icon: "cleaning_services",
    title: "Cleaning & Validation", tech: null,
    desc: "Records with missing supply durations or cancelled prescriptions are removed. Clinical codes are standardised, date formats are unified, and patients who passed away are appropriately handled so their data doesn\u2019t distort the model.",
    stats: [
      { icon: "filter_alt", text: "117,749 invalid records removed" },
      { icon: "sync_alt", text: "11 condition flags remapped" },
      { icon: "person_off", text: "2,301 death-censored fills" },
    ],
    detail: {
      title: "Data Cleaning: Making It Reliable",
      sections: [
        { heading: "What we removed", list: ["117,726 records with zero days supply: these break the refill calculation because the expected run-out date equals the fill date itself", "23 records with PROD_SRVC_ID = 'OTHER' (a literal string instead of a drug code)", "3,188 triple-zero records (zero days, zero quantity, zero cost) indicating void or cancelled prescriptions"] },
        { heading: "What we fixed", list: ["Chronic condition flags (SP_*) use 1=Yes, 2=No instead of the standard 0/1. We remapped all 11 conditions.", "BENE_ESRD_IND (end-stage renal disease) uses '0'/'Y' strings instead of numbers. Remapped to 0/1.", "Race codes use {1, 2, 3, 5} with no code 4. We handle this explicitly.", "All dates stored as YYYYMMDD integers, parsed to proper datetime objects."] },
        { heading: "Death censoring", body: "If a patient passed away before their prescription was expected to run out, we cannot label that fill as 'late': the patient didn't fail to refill, they died. We identified 2,301 such fills using death dates from the beneficiary summary and excluded them from the training labels. Death dates in this dataset are month-granularity only (always the 1st of the month)." },
        { heading: "Chronic condition instability", body: "We discovered that chronic conditions in the synthetic data are re-randomised each year: diabetes 'resolves' in 20.5% of patients between 2009 and 2010, which is clinically impossible. We mitigated this by creating 'ever had' flags (maximum of each condition across all three years), giving a more stable picture." },
      ],
    },
  },
  {
    num: 3, color: "#006b75", icon: "label",
    title: "Defining \u201CLate\u201D", tech: "Label Construction",
    desc: "For each prescription, we calculate when the supply should run out. If the patient\u2019s next refill arrives more than seven days after that date, we mark it as late. This gives us a clear yes-or-no outcome the model can learn from.",
    stats: [
      { icon: "assignment", text: "1.47 million labelled fills" },
      { icon: "timer", text: "7-day grace window" },
    ],
    detail: {
      title: "Label Construction: What Counts as Late?",
      sections: [
        { heading: "The formula", body: "Expected run-out = fill date + days of supply. A refill is 'late' if the next fill of the same drug group arrives more than 7 days after this run-out date. The 7-day grace window accounts for small timing variations in pharmacy processing and mail-order delivery." },
        { heading: "The NDC-5 challenge", body: "In real pharmacy data, each prescription has a consistent drug code (NDC-11). But in this synthetic dataset, drug codes are randomised per event: 99.9% of patient-drug pairs at the NDC-11 level have only one fill, making refill tracking impossible. We solved this by grouping drugs at the NDC-5 level (the first 5 digits, representing the manufacturer/labeler). This recovered 717,647 trackable patient-drug pairs with 2+ fills." },
        { heading: "Exclusions", list: ["Last fill per patient-drug group: no next fill is observable, so we can't label it", "Death-censored fills: patient died before run-out", "Single-fill patient-drug pairs: only one fill means no refill to predict"] },
        { heading: "Class balance", body: "76.2% of labelled fills are 'late'. This means late refills are the majority class, not the minority. Our evaluation uses Precision-Recall AUC rather than accuracy to properly handle this imbalance. The balance also shifts over time: 80.1% late in training data (2008 to mid-2009), dropping to 59.0% in the test set (2010)." },
      ],
    },
  },
  {
    num: 4, color: "#008887", icon: "construction",
    title: "Building the Signals", tech: "Feature Engineering",
    desc: "We extract 67 measurable signals from each patient\u2019s history, including how regular their past refills have been, their age, chronic conditions, hospital visits, and prescription costs. Each signal only uses information available before the prediction point.",
    chart: [
      { label: "Refill regularity", pct: 78, value: "35%", color: "var(--navy)" },
      { label: "Supply duration", pct: 47, value: "21%", color: "#0088b3" },
      { label: "Average refill gap", pct: 36, value: "16%", color: "#00a89e" },
      { label: "Fill history length", pct: 16, value: "7%", color: "var(--accent)" },
      { label: "Past late refills", pct: 11, value: "5%", color: "#6ec6c6" },
      { label: "Other 62 signals", pct: 36, value: "16%", color: "#9ca3af" },
    ],
    detail: {
      title: "Feature Engineering: 67 Signals From 5 Sources",
      sections: [
        { heading: "Temporal integrity", body: "Every feature for a fill at time T is computed using only data from strictly before T. This prevents 'data leakage' where the model could see the future. In practice, this means: if we're predicting whether a March 2009 fill will be late, we only use data from before March 2009." },
        { heading: "Prescription behaviour (15 features)", list: ["How many times this patient has filled this drug before", "Mean and standard deviation of gaps between consecutive fills (cadence stability)", "Whether the previous refill was late, and what fraction of all past refills were late", "Current days of supply (30 vs 90 day scripts behave differently)", "Early refill count (stockpiling behaviour)", "Polypharmacy: how many different drugs the patient is currently taking", "Cost patterns: average copay and total drug cost"] },
        { heading: "Patient profile (36 features)", list: ["Age, sex, race (from year-matched beneficiary summary)", "11 individual chronic condition flags plus an 'ever had' version of each", "Total chronic condition count", "Part D coverage months, HMO months", "Annual reimbursement totals for inpatient, outpatient, and carrier claims"] },
        { heading: "Healthcare disruptions (6 inpatient features)", list: ["Hospitalisation count in the 30, 90, and 365 days before the fill", "Whether any hospitalisation occurred in the past 30 days (binary flag)", "Total hospital days in the past year", "Days since last discharge"] },
        { heading: "Healthcare engagement (5 outpatient + 5 carrier features)", list: ["Outpatient visit count in 30/90/365 day windows", "Whether the patient has a V58 'long-term drug use' diagnosis code", "Physician visit count from carrier claims (aggregated monthly to handle 4.7M rows)", "Unique diagnoses and providers seen in past year", "Whether the patient had an office visit in the past 30 days"] },
      ],
    },
  },
  {
    num: 5, color: "#00a599", icon: "model_training",
    title: "Training the Model", tech: "LightGBM",
    desc: "A gradient-boosted decision tree model learns which combinations of signals best predict late refills. Training uses only historical data and is tested on a separate future time period, just as it would work in practice.",
    metrics: [
      { value: "0.856", label: "Validation PR-AUC", color: "var(--navy)" },
      { value: "0.737", label: "Test PR-AUC", color: "var(--heading)" },
      { value: "141", label: "Decision trees", color: "var(--accent)" },
    ],
    prauc: true,
    detail: {
      title: "Model Training: How We Validate Performance",
      sections: [
        { heading: "Time-based evaluation", body: "We split data by time, not randomly. Training data covers January 2008 to June 2009 (1,045,574 fills). The validation set covers July to December 2009 (247,863 fills). The held-out test set is all of 2010 (180,158 fills). This mirrors real deployment: the model only ever sees the past and is asked to predict the future." },
        { heading: "Why PR-AUC instead of accuracy", body: "With 76% of fills being late, a model that always predicts 'late' would be 76% accurate but completely useless. PR-AUC (Precision-Recall Area Under Curve) measures how well the model distinguishes genuinely high-risk fills from low-risk ones across all possible thresholds. A perfect model scores 1.0; a random model scores equal to the prevalence rate (0.72 on validation, 0.59 on test)." },
        { heading: "Performance breakdown", list: ["Validation PR-AUC: 0.856 (19% above the 0.722 random baseline)", "Test PR-AUC: 0.737 (25% above the 0.590 random baseline)", "ROC-AUC: 0.729 (validation), 0.688 (test)", "At 70% recall: 70.0% precision (test), meaning 7 out of 10 flagged patients are genuinely late", "At 90% recall: 64.8% precision (test), catching nearly everyone but with more false positives"] },
        { heading: "Why the test score drops", body: "The test set (2010) has a different class balance (59% late vs 72% in validation) due to data truncation and temporal shift. This is expected and realistic: models always perform somewhat worse on future data than on the period they were validated against. The fact that our model still significantly outperforms the baseline on the test set demonstrates genuine predictive signal." },
        { heading: "Model configuration", body: "LightGBM with 141 boosted trees (stopped early from a maximum of 1,000), max depth 7, 63 leaves per tree, learning rate 0.05, with is_unbalance=True to handle class imbalance. Bagging and feature subsampling (80% each) are used for regularisation." },
      ],
    },
  },
  {
    num: 6, color: "#00c3aa", icon: "tune",
    title: "Calibration & Uncertainty", tech: null,
    desc: "Raw model scores are mapped to real-world risk tiers based on actual observed late rates in our test population. Each prediction includes a confidence range so clinicians can see when the model is unsure.",
    tiers: [
      { value: "76%", label: "HIGH actual late rate", sub: "score \u2265 0.55", cls: "high" },
      { value: "61%", label: "MODERATE actual late rate", sub: "score 0.30 to 0.55", cls: "mod" },
      { value: "40%", label: "LOW actual late rate", sub: "score < 0.30", cls: "low" },
    ],
    detail: {
      title: "Calibration: Turning Scores Into Trustworthy Tiers",
      sections: [
        { heading: "The calibration problem", body: "Raw model probabilities are systematically over-confident. When the model outputs 30%, the actual late rate is closer to 54%. This is a known effect of class-imbalanced training. Rather than reporting misleading raw probabilities, we define risk tiers based on actual observed outcomes." },
        { heading: "How tiers were derived", body: "We swept threshold values across our 180,158-fill test set and found boundaries that create three roughly equal-sized groups with clearly separated actual late rates. These boundaries (0.30 and 0.55) were chosen because they produce the best separation between tiers while maintaining balanced group sizes." },
        { heading: "Confidence intervals", body: "Each prediction comes with a 90% conformal prediction interval (inspired by MAPIE). When this interval is narrow (e.g., 60% to 72%), the model is confident. When it's wide (e.g., 25% to 68%), the model is uncertain and the tier assignment should be reviewed by a clinician. We flag predictions as 'uncertain' whenever the interval spans multiple tiers." },
        { heading: "Operational trade-offs", body: "Setting thresholds too aggressively (flagging too many as HIGH) overwhelms pharmacists with calls to patients who would have refilled anyway. Setting them too conservatively (flagging too few) misses vulnerable patients who need help. Our 0.30/0.55 boundaries flag about one third of patients as HIGH risk: of those, 76% actually do refill late." },
      ],
    },
  },
  {
    num: 7, color: "#00e0bc", numColor: "var(--navy)", icon: "dashboard",
    title: "Actionable Risk Report", tech: null,
    desc: "The final output for each patient: a risk tier with a plain-language explanation, the top factors driving their score, a confidence range the clinician can see at a glance, and a recommended next step.",
    highlight: true,
    stats: [
      { icon: "analytics", text: "SHAP-explained drivers" },
      { icon: "medication", text: "Real drug names via RxNorm" },
      { icon: "shield", text: "90% confidence intervals" },
    ],
    detail: {
      title: "The Final Report: What Clinicians See",
      sections: [
        { heading: "Risk tier with context", body: "Each patient receives a colour-coded tier (HIGH / MODERATE / LOW) alongside the actual late rate observed in that tier during validation. This means clinicians see 'HIGH risk: 76% of similar patients refilled late' rather than an opaque number." },
        { heading: "SHAP-explained drivers", body: "For every prediction, we show which factors pushed the score up (risk factors) and which pulled it down (protective factors), ranked by magnitude. For example: 'Patient is 42 days past expected run-out (+18% risk)' or '90-day supply, strong adherence signal (-12% risk)'. This uses SHAP (SHapley Additive exPlanations), the gold standard for model interpretability." },
        { heading: "Drug name enrichment", body: "Raw drug codes (NDC) are mapped to human-readable names via the RxNorm API. So instead of 'NDC5-67544', the clinician sees 'Cozaar (losartan)'. We resolved 32% of the drug groups in our synthetic data. With real pharmacy data, this would approach 100%." },
        { heading: "Recommended actions", body: "Each tier comes with a suggested clinical response: LOW = standard monitoring, MODERATE = automated SMS/email reminder before run-out, HIGH = proactive pharmacist outreach. Recommendations include reasoning ('Risk score of 68% places this patient in the HIGH tier. Top driver: 35 days past expected run-out')." },
        { heading: "Patient timeline", body: "A visual history of the patient's fills for the selected drug: when they filled, when each supply was expected to run out, whether the next fill was on time or late, and the predicted risk score at each point. This gives clinicians a narrative rather than just a number." },
      ],
    },
  },
];

/* ── PR-AUC comparison mini-chart ───────────────────────────────── */
function PrAucChart() {
  const bars = [
    { label: "Random baseline", val: 0.722, vLabel: "0.722", w: 72.2, color: "#d1d5db" },
    { label: "Our model (val)", val: 0.856, vLabel: "0.856", w: 85.6, color: "var(--navy)" },
    { label: "Random baseline", val: 0.590, vLabel: "0.590", w: 59.0, color: "#d1d5db" },
    { label: "Our model (test)", val: 0.737, vLabel: "0.737", w: 73.7, color: "var(--accent)" },
  ];
  return (
    <div className="pipe-graph" style={{ marginTop: 14 }}>
      <div className="pipe-graph-title">PR-AUC: model vs random baseline</div>
      {bars.map((b, i) => (
        <div className="pipe-bar-row" key={i}>
          <span className="pipe-bar-label" style={{ width: 130, fontSize: 11 }}>{b.label}</span>
          <div className="pipe-bar-track">
            <div className="pipe-bar-fill" style={{ width: `${b.w}%`, background: b.color, color: b.color === "#d1d5db" ? "#6b7280" : "#fff" }}>{b.vLabel}</div>
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Higher is better. A model that guesses randomly scores equal to the late rate prevalence.</div>
    </div>
  );
}

/* ── Detail Modal ───────────────────────────────────────────────── */
function DetailModal({ step, onClose }) {
  if (!step || !step.detail) return null;
  const d = step.detail;
  return (
    <div className="pipe-modal-overlay" onClick={onClose}>
      <div className="pipe-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pipe-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="pipe-num" style={{ background: step.color, color: step.numColor || "#fff", width: 36, height: 36, fontSize: 15 }}>{step.num}</div>
            <h3 style={{ fontSize: 18, color: "var(--navy)", margin: 0 }}>{d.title}</h3>
          </div>
          <button className="pipe-modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="pipe-modal-body">
          {d.sections.map((s, i) => (
            <div key={i} className="pipe-modal-section">
              <h4>{s.heading}</h4>
              {s.body && <p>{s.body}</p>}
              {s.list && (
                <ul>
                  {s.list.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Pipeline Step Card ─────────────────────────────────────────── */
function PipelineStep({ step, isLast, onInfoClick }) {
  return (
    <div className="pipe-step">
      <div>
        <div className="pipe-num" style={{ background: step.color, color: step.numColor || "#fff" }}>{step.num}</div>
        {!isLast && <div className="pipe-line" />}
      </div>
      <div className="pipe-card" style={step.highlight ? { borderColor: "var(--accent)", background: "linear-gradient(135deg, rgba(0,224,188,.04), rgba(0,224,188,.08))" } : undefined}>
        <h3>
          <span className="material-symbols-outlined">{step.icon}</span>
          {" "}{step.title}
          {step.tech && <span className="pipe-tech">({step.tech})</span>}
          {step.detail && (
            <button className="pipe-info-btn" onClick={() => onInfoClick(step)} title="Learn more">
              <span className="material-symbols-outlined">info</span>
            </button>
          )}
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
                  <div className="pipe-bar-fill" style={{ width: bar.pct + "%", background: bar.color }}>{bar.value}</div>
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

        {step.prauc && <PrAucChart />}

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

/* ── Main Component ─────────────────────────────────────────────── */
export default function PipelineExplainer() {
  const [modalStep, setModalStep] = useState(null);

  return (
    <section className="pipeline" id="how-it-works">
      <div className="container">
        <h2 className="sec-title">How It Works</h2>
        <p className="sec-sub">
          From raw prescription records to an actionable risk score: a seven-stage pipeline built for transparency.
        </p>
        <div className="pipe-steps">
          {STEPS.map((step, i) => (
            <PipelineStep key={step.num} step={step} isLast={i === STEPS.length - 1} onInfoClick={setModalStep} />
          ))}
        </div>
      </div>
      {modalStep && <DetailModal step={modalStep} onClose={() => setModalStep(null)} />}
    </section>
  );
}
