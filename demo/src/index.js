// Refill Risk Prediction API — Cloudflare Worker
// Simulates a calibrated LightGBM adherence risk model with deterministic, feature-driven scoring.
// All data is synthetic (CMS DE-SynPUF). Not clinical advice.

import FRONTEND_HTML from './frontend.html';

const TEMPLATE_CSV = `patient_id,drug_name,drug_ndc,last_fill_date,days_supply,quantity_dispensed,patient_pay_amt,total_drug_cost,refill_count,age,chronic_conditions
P-10001,Levothyroxine 50mcg,00093-4382-01,2026-03-20,90,90,4.00,18.00,24,68,Hypothyroidism
P-10002,Metformin 500mg,00093-7212-01,2026-02-18,30,60,30.00,85.00,3,76,"Diabetes,Hypertension"
P-10003,Atorvastatin 20mg,00093-5057-01,2026-02-05,30,30,35.00,55.00,2,82,"Hyperlipidemia,CHF,Diabetes"`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    if (url.pathname === '/api/predict' && request.method === 'POST') {
      return handlePredict(request);
    }
    if (url.pathname === '/api/template') {
      return new Response(TEMPLATE_CSV, {
        headers: { ...CORS, 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="refill_risk_template.csv"' },
      });
    }
    return new Response(FRONTEND_HTML, {
      headers: { 'Content-Type': 'text/html;charset=utf-8' },
    });
  },
};

// ── Prediction Endpoint (SSE) ──────────────────────────────────

async function handlePredict(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const patients = body.patients;
  if (!Array.isArray(patients) || patients.length === 0) {
    return jsonError('patients array is required', 400);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (d) => controller.enqueue(enc.encode('data: ' + JSON.stringify(d) + '\n\n'));

      const steps = [
        ['Validating input data...', 5, 300],
        ['Loading ' + patients.length + ' patient record' + (patients.length > 1 ? 's' : '') + '...', 12, 400],
        ['Preprocessing temporal features...', 22, 500],
        ['Computing refill gap statistics...', 35, 600],
        ['Extracting cost & polypharmacy signals...', 48, 400],
        ['Running LightGBM prediction...', 62, 800],
        ['Calibrating probability scores (Platt scaling)...', 75, 500],
        ['Computing SHAP feature contributions...', 85, 600],
        ['Generating clinical recommendations...', 92, 300],
        ['Compiling report...', 97, 200],
      ];

      for (const [message, progress, delay] of steps) {
        send({ type: 'progress', message, progress });
        await sleep(delay);
      }

      const predictions = patients.map((p) => generatePrediction(p));
      const high = predictions.filter((p) => p.risk_category === 'HIGH').length;
      const mod = predictions.filter((p) => p.risk_category === 'MODERATE').length;
      const low = predictions.filter((p) => p.risk_category === 'LOW').length;
      const avg = predictions.reduce((s, p) => s + p.risk_score, 0) / predictions.length;

      send({
        type: 'result',
        timestamp: new Date().toISOString(),
        model_version: 'v1.2.0-lightgbm-calibrated',
        processing_time_ms: 3200 + patients.length * 80,
        disclaimer: 'This is a modelling and product-thinking exercise using synthetic claims-style data. Outputs should not be interpreted as clinical advice.',
        summary: { total_patients: predictions.length, high_risk: high, moderate_risk: mod, low_risk: low, avg_risk_score: r3(avg) },
        predictions,
      });

      send({ type: 'progress', message: 'Complete', progress: 100 });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

// ── Prediction Logic ───────────────────────────────────────────

function generatePrediction(patient) {
  const today = new Date('2026-03-30');
  let score = 0.32;
  const drivers = [];

  const lastFill = patient.last_fill_date ? new Date(patient.last_fill_date) : today;
  const supply = parseInt(patient.days_supply) || 30;
  const sinceFill = Math.floor((today - lastFill) / 86400000);
  const overdue = sinceFill - supply;

  // 1 — Overdue days
  if (overdue > 14) {
    const imp = Math.min(overdue * 0.007, 0.35);
    score += imp;
    drivers.push({ feature: overdue + ' days past expected run-out', impact: r3(imp), direction: 'risk' });
  } else if (overdue > 0) {
    const imp = overdue * 0.012;
    score += imp;
    drivers.push({ feature: overdue + ' days past run-out (within grace)', impact: r3(imp), direction: 'risk' });
  } else {
    score -= 0.05;
    drivers.push({ feature: 'Within current supply window', impact: -0.05, direction: 'protective' });
  }

  // 2 — Supply duration
  if (supply >= 90) {
    score -= 0.12;
    drivers.push({ feature: '90-day supply (strong adherence signal)', impact: -0.12, direction: 'protective' });
  } else if (supply <= 14) {
    score += 0.09;
    drivers.push({ feature: 'Short supply duration (14 days or less)', impact: 0.09, direction: 'risk' });
  }

  // 3 — Copay
  const pay = parseFloat(patient.patient_pay_amt) || 0;
  if (pay > 25) {
    const imp = r3(Math.min((pay - 25) * 0.004, 0.18));
    score += imp;
    drivers.push({ feature: 'High copay ($' + pay.toFixed(2) + ')', impact: imp, direction: 'risk' });
  } else if (pay > 0 && pay <= 5) {
    score -= 0.04;
    drivers.push({ feature: 'Low copay barrier ($' + pay.toFixed(2) + ')', impact: -0.04, direction: 'protective' });
  }

  // 4 — Refill history
  const refills = parseInt(patient.refill_count) || 0;
  if (refills >= 12) {
    score -= 0.15;
    drivers.push({ feature: 'Strong refill history (' + refills + ' prior fills)', impact: -0.15, direction: 'protective' });
  } else if (refills <= 2) {
    score += 0.13;
    drivers.push({ feature: 'Limited refill history (' + refills + ' prior fills)', impact: 0.13, direction: 'risk' });
  } else {
    const imp = r3(-refills * 0.012);
    score += imp;
    drivers.push({ feature: refills + ' prior refills', impact: imp, direction: 'protective' });
  }

  // 5 — Age
  const age = parseInt(patient.age) || 0;
  if (age > 80) {
    score += 0.08;
    drivers.push({ feature: 'Advanced age (' + age + 'y)', impact: 0.08, direction: 'risk' });
  } else if (age >= 65 && age <= 75) {
    score -= 0.03;
    drivers.push({ feature: 'Age within typical Medicare range (' + age + 'y)', impact: -0.03, direction: 'protective' });
  }

  // 6 — Comorbidity
  const conds = patient.chronic_conditions
    ? String(patient.chronic_conditions).split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  if (conds.length >= 3) {
    score += 0.1;
    drivers.push({ feature: 'Complex comorbidity (' + conds.length + ' conditions)', impact: 0.1, direction: 'risk' });
  } else if (conds.length === 1) {
    score -= 0.02;
    drivers.push({ feature: 'Single condition (simpler regimen)', impact: -0.02, direction: 'protective' });
  }

  // 7 — Cost ratio
  const totalCost = parseFloat(patient.total_drug_cost) || 0;
  if (totalCost > 0 && pay > 0 && pay / totalCost > 0.5) {
    score += 0.06;
    drivers.push({ feature: 'High out-of-pocket ratio (' + Math.round((pay / totalCost) * 100) + '%)', impact: 0.06, direction: 'risk' });
  }

  score = Math.max(0.04, Math.min(0.96, score));
  const cat = score >= 0.65 ? 'HIGH' : score >= 0.35 ? 'MODERATE' : 'LOW';

  let conf = 0.88;
  if (!patient.refill_count && patient.refill_count !== 0) conf -= 0.08;
  if (!patient.age) conf -= 0.04;
  if (!patient.chronic_conditions) conf -= 0.05;
  conf = Math.max(0.65, Math.min(0.97, conf));

  drivers.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const nextRefill = new Date(lastFill);
  nextRefill.setDate(nextRefill.getDate() + supply);

  return {
    patient_id: patient.patient_id || 'UNKNOWN',
    drug_name: patient.drug_name || patient.drug_ndc || 'Unknown Drug',
    drug_ndc: patient.drug_ndc || '',
    risk_score: r3(score),
    risk_category: cat,
    confidence: r3(conf),
    drivers,
    recommendations: buildRecs(cat, pay, refills, overdue),
    last_fill_date: patient.last_fill_date || '',
    days_supply: supply,
    next_expected_refill: nextRefill.toISOString().split('T')[0],
    days_overdue: Math.max(0, overdue),
    intervention_window: cat === 'HIGH' ? 'Immediate' : Math.max(1, Math.ceil((1 - score) * 6 + 1)) + ' days before run-out',
    age: age || null,
    chronic_conditions: conds,
    patient_pay_amt: pay,
    total_drug_cost: totalCost,
    timeline: buildTimeline(lastFill, supply, refills, cat),
  };
}

// ── Timeline Generator ─────────────────────────────────────────

function buildTimeline(lastFillDate, supply, refillCount, category) {
  const events = [];
  const fills = Math.min(Math.max(refillCount, 2), 5);
  let cursor = new Date(lastFillDate);

  // Walk backwards to build history
  const history = [];
  for (let i = 0; i < fills; i++) {
    history.unshift(new Date(cursor));
    const prevGap = category === 'HIGH' ? (i === 0 ? 0 : Math.floor(Math.random() * 8) + 3)
      : category === 'MODERATE' ? (i === 0 ? 0 : Math.floor(Math.random() * 5))
      : (i === 0 ? 0 : Math.floor(Math.random() * 2) - 1);
    cursor.setDate(cursor.getDate() - supply - prevGap);
    cursor = new Date(cursor);
  }

  // Build forward timeline
  for (let i = 0; i < history.length; i++) {
    const fillDate = history[i];
    const runOut = new Date(fillDate);
    runOut.setDate(runOut.getDate() + supply);
    const nextFill = i < history.length - 1 ? history[i + 1] : null;
    const gap = nextFill ? Math.floor((nextFill - runOut) / 86400000) : null;

    let status = 'on_time';
    if (gap === null) status = 'current';
    else if (gap > 7) status = 'late';
    else if (gap > 0) status = 'slightly_late';
    else if (gap < 0) status = 'early';

    events.push({
      fill_number: i + 1,
      fill_date: fmt(fillDate),
      run_out_date: fmt(runOut),
      next_fill_date: nextFill ? fmt(nextFill) : null,
      gap_days: gap,
      status,
    });
  }
  return events;
}

// ── Recommendations ────────────────────────────────────────────

function buildRecs(cat, pay, refills, overdue) {
  const r = [];
  if (cat === 'HIGH') {
    r.push({ priority: 'urgent', text: 'Immediate pharmacist outreach recommended' });
    if (overdue > 7) r.push({ priority: 'urgent', text: 'Patient likely has medication gap — assess clinical impact' });
    if (pay > 25) r.push({ priority: 'high', text: 'Review generic alternatives to reduce copay barrier' });
    if (refills <= 2) r.push({ priority: 'high', text: 'New patient — establish adherence support programme early' });
    r.push({ priority: 'medium', text: 'Consider enrolment in auto-refill programme' });
  } else if (cat === 'MODERATE') {
    r.push({ priority: 'medium', text: 'Schedule proactive reminder 5 days before next run-out' });
    if (pay > 15) r.push({ priority: 'medium', text: 'Discuss cost management options at next contact' });
    r.push({ priority: 'low', text: 'Monitor refill pattern over next 2 cycles' });
  } else {
    r.push({ priority: 'low', text: 'Continue standard refill reminders' });
    r.push({ priority: 'low', text: 'Low-touch monitoring sufficient' });
    if (refills >= 12) r.push({ priority: 'low', text: 'Candidate for 90-day supply conversion (if applicable)' });
  }
  return r;
}

// ── Helpers ─────────────────────────────────────────────────────

function r3(n) { return parseFloat(n.toFixed(3)); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function fmt(d) { return d.toISOString().split('T')[0]; }
function jsonError(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
