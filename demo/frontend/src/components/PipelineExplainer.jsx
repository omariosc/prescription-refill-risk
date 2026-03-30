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

/* ── Real PR-AUC and ROC curves from model output ──────────────── */

// SVG polyline points extracted from sklearn precision_recall_curve and roc_curve
// 50 points each, viewBox 0 0 320 195
const CURVE_DATA = {
  pr_val: "310.0,55.0 308.7,53.0 306.4,51.3 303.5,49.9 300.1,48.7 296.5,47.6 292.7,46.5 288.5,45.5 284.4,44.5 280.1,43.4 275.7,42.5 271.2,41.5 266.4,40.7 261.5,39.8 256.6,39.0 251.5,38.2 246.4,37.4 241.1,36.6 235.9,35.9 230.4,35.1 225.0,34.3 219.4,33.7 213.7,32.9 208.1,32.2 202.4,31.4 196.7,30.6 190.6,30.0 184.4,29.5 178.2,29.1 171.8,28.7 165.3,28.5 158.8,28.2 152.4,27.8 145.8,27.5 139.1,27.3 132.5,27.0 126.0,26.7 119.4,26.3 112.7,26.0 106.0,25.6 99.2,25.3 92.6,24.7 85.9,24.3 79.1,23.8 72.3,23.4 65.3,22.9 58.4,21.5 51.5,19.8 44.6,17.5 37.5,16.0 30.2,12.3",
  pr_test: "310.0,78.8 309.1,77.0 307.4,75.4 304.8,74.1 301.6,73.0 298.1,72.0 294.3,71.1 290.4,70.2 286.4,69.2 282.1,68.4 277.8,67.5 273.5,66.6 269.1,65.7 264.5,64.8 259.8,64.0 254.7,63.2 249.7,62.5 244.6,61.7 239.4,60.9 234.1,60.2 228.8,59.4 223.4,58.6 218.1,57.7 212.7,56.8 207.3,55.8 201.7,54.9 195.7,54.2 189.8,53.4 183.8,52.6 178.0,51.5 171.9,50.7 165.4,50.1 158.8,49.6 152.2,49.0 145.2,48.7 138.4,48.4 131.6,47.8 124.6,47.5 117.7,47.0 110.8,46.4 103.8,45.8 96.7,45.2 89.7,44.4 82.6,43.5 75.5,42.3 68.4,40.9 61.0,39.7 53.7,36.9 46.4,32.4 38.6,27.8 30.3,31.1",
  roc_val: "30.0,185.0 33.7,173.8 37.5,166.6 41.2,160.0 45.0,153.2 48.9,146.7 52.9,140.5 56.8,134.3 60.7,128.2 64.7,122.4 68.8,116.5 72.9,110.7 77.0,105.3 81.1,100.1 85.2,94.7 89.3,89.9 93.6,85.3 98.0,81.1 102.4,77.4 107.1,73.9 111.8,70.8 116.7,67.6 121.3,64.5 126.2,61.3 130.8,58.3 135.7,55.6 140.5,52.7 145.8,50.0 150.9,47.2 156.2,44.6 161.3,42.0 166.5,39.6 172.1,37.1 177.4,34.9 183.0,32.5 188.8,30.3 194.6,28.2 200.5,26.1 206.7,24.1 213.1,22.2 219.6,20.3 225.9,18.5 232.3,16.7 239.0,15.0 245.8,13.3 253.1,11.7 260.8,10.1 268.9,8.7 278.0,7.4 289.3,6.2 306.0,5.1",
  roc_test: "30.0,185.0 33.5,175.9 37.2,169.9 41.0,164.5 44.7,158.9 48.7,154.0 52.5,148.6 56.3,143.7 60.3,138.7 64.2,133.7 68.2,128.9 72.2,124.1 76.1,119.1 80.2,114.5 84.2,109.8 88.1,105.2 92.3,100.8 96.6,96.4 101.0,92.2 105.8,88.7 110.6,85.4 115.1,81.9 120.0,78.3 124.6,74.8 129.5,71.6 134.4,68.5 139.6,65.4 145.1,62.4 150.3,59.3 155.4,56.3 160.7,53.3 165.9,50.3 171.1,47.5 176.4,44.7 182.0,42.0 187.4,39.2 193.0,36.5 198.8,33.9 204.9,31.3 211.3,28.8 217.7,26.5 224.1,24.1 230.8,21.7 237.5,19.3 244.3,17.1 251.6,14.9 258.8,12.7 266.7,10.6 275.4,8.5 285.9,6.7 305.7,5.2",
};

function CurveChart({ type }) {
  const isPR = type === "pr";
  const valLine = isPR ? CURVE_DATA.pr_val : CURVE_DATA.roc_val;
  const testLine = isPR ? CURVE_DATA.pr_test : CURVE_DATA.roc_test;
  const title = isPR ? "Precision-Recall Curve" : "ROC Curve";
  const xLabel = isPR ? "Recall" : "False Positive Rate";
  const yLabel = isPR ? "Precision" : "True Positive Rate";
  const aucVal = isPR ? "0.856 / 0.737" : "0.729 / 0.688";
  // Diagonal reference line
  const diagPoints = isPR ? null : "30,185 310,5";
  // Baseline for PR = horizontal line at prevalence
  const baselineVal72 = isPR ? 5 + (1 - 0.722) * 180 : null; // val baseline
  const baselineVal59 = isPR ? 5 + (1 - 0.590) * 180 : null; // test baseline

  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", flex: 1, minWidth: 260 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>{title}</div>
      <svg viewBox="0 0 320 210" style={{ width: "100%", maxHeight: 200 }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => {
          const y = 5 + (1 - v) * 180;
          const x = 30 + v * 280;
          return (
            <g key={v}>
              <line x1="30" y1={y} x2="310" y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <line x1={x} y1="5" x2={x} y2="185" stroke="#f3f4f6" strokeWidth="1" />
              <text x="26" y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{(v * 100).toFixed(0)}%</text>
              <text x={x} y="198" textAnchor="middle" fontSize="9" fill="#9ca3af">{(v * 100).toFixed(0)}%</text>
            </g>
          );
        })}
        {/* Axes */}
        <line x1="30" y1="5" x2="30" y2="185" stroke="#d1d5db" strokeWidth="1" />
        <line x1="30" y1="185" x2="310" y2="185" stroke="#d1d5db" strokeWidth="1" />
        {/* Diagonal (ROC) or baseline (PR) */}
        {diagPoints && <polyline points={diagPoints} fill="none" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4,4" />}
        {baselineVal72 != null && <line x1="30" y1={baselineVal72} x2="310" y2={baselineVal72} stroke="#d1d5db" strokeWidth="1" strokeDasharray="4,4" />}
        {baselineVal59 != null && <line x1="30" y1={baselineVal59} x2="310" y2={baselineVal59} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2,3" />}
        {/* Curves */}
        <polyline points={valLine} fill="none" stroke="#003052" strokeWidth="2.5" strokeLinejoin="round" />
        <polyline points={testLine} fill="none" stroke="#00e0bc" strokeWidth="2.5" strokeLinejoin="round" />
        {/* Labels */}
        <text x="170" y="207" textAnchor="middle" fontSize="10" fill="#6b7280">{xLabel}</text>
        <text x="12" y="95" textAnchor="middle" fontSize="10" fill="#6b7280" transform="rotate(-90 12 95)">{yLabel}</text>
      </svg>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 6, fontSize: 11 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 16, height: 3, background: "#003052", display: "inline-block", borderRadius: 2 }} />
          <span style={{ color: "#374151" }}>Validation</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 16, height: 3, background: "#00e0bc", display: "inline-block", borderRadius: 2 }} />
          <span style={{ color: "#374151" }}>Test</span>
        </span>
        {isPR && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 16, height: 1, borderTop: "2px dashed #d1d5db", display: "inline-block" }} />
            <span style={{ color: "#9ca3af" }}>Baseline</span>
          </span>
        )}
        {!isPR && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 16, height: 1, borderTop: "2px dashed #d1d5db", display: "inline-block" }} />
            <span style={{ color: "#9ca3af" }}>Random</span>
          </span>
        )}
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
        AUC: {aucVal} (val / test)
      </div>
    </div>
  );
}

function ModelCharts() {
  return (
    <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
      <CurveChart type="pr" />
      <CurveChart type="roc" />
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

        {step.prauc && <ModelCharts />}

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
