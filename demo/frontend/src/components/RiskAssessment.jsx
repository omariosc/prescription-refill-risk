import { useState, useRef, useEffect, useCallback } from 'react';
import { predict, downloadTemplate, searchNdc } from '../utils/api';
import { parseCSV } from '../utils/csv';

const DEMO_SINGLE = {
  patient_id: 'P-10003',
  drug_name: 'Atorvastatin',
  drug_ndc: '00093-5057-01',
  drug_dose: '20',
  drug_unit: 'mg',
  last_fill_date: '2026-02-05',
  days_supply: '30',
  quantity_dispensed: '30',
  patient_pay_amt: '35.00',
  total_drug_cost: '55.00',
  refill_count: '2',
  age: '82',
  chronic_conditions: 'Hyperlipidemia, CHF, Diabetes',
};

export default function RiskAssessment({ onStartProcessing }) {
  const [activeTab, setActiveTab] = useState('single');
  const [form, setForm] = useState({
    patient_id: '',
    drug_name: '',
    drug_ndc: '',
    drug_dose: '',
    drug_unit: 'mg',
    last_fill_date: '2026-03-01',
    days_supply: '30',
    quantity_dispensed: '',
    patient_pay_amt: '',
    total_drug_cost: '',
    refill_count: '',
    age: '',
    chronic_conditions: '',
  });
  const [errors, setErrors] = useState({});
  const [ndcResults, setNdcResults] = useState([]);
  const [showNdc, setShowNdc] = useState(false);
  const ndcTimer = useRef(null);

  // Batch state
  const [batchPatients, setBatchPatients] = useState([]);
  const [batchHeaders, setBatchHeaders] = useState([]);
  const [fileName, setFileName] = useState('');

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // NDC search
  const handleDrugInput = useCallback((value) => {
    updateField('drug_name', value);
    clearTimeout(ndcTimer.current);
    if (value.trim().length < 2) {
      setShowNdc(false);
      return;
    }
    ndcTimer.current = setTimeout(async () => {
      try {
        const results = await searchNdc(value.trim());
        setNdcResults(results);
        setShowNdc(results.length > 0);
      } catch {
        setShowNdc(false);
      }
    }, 350);
  }, []);

  const selectNdc = (d) => {
    setForm((prev) => {
      const updated = { ...prev, drug_name: d.brand_name || d.generic_name, drug_ndc: d.ndc };
      if (d.strength) {
        const m = d.strength.match(/([\d.]+)\s*(\w+)/);
        if (m) {
          updated.drug_dose = m[1];
          const unit = m[2].toLowerCase();
          if (['mg', 'mcg', 'ml', 'g', 'units', 'puffs'].includes(unit)) {
            updated.drug_unit = unit;
          }
        }
      }
      return updated;
    });
    setShowNdc(false);
  };

  // Validation
  const validate = () => {
    const errs = {};
    if (!form.drug_name.trim()) errs.drug_name = 'Drug name is required';
    if (!form.last_fill_date) errs.last_fill_date = 'Last fill date is required';
    const s = parseInt(form.days_supply);
    if (!s || s < 1 || s > 365) errs.days_supply = 'Must be 1-365';
    const pay = parseFloat(form.patient_pay_amt);
    if (form.patient_pay_amt && (isNaN(pay) || pay < 0)) errs.patient_pay_amt = 'Must be non-negative';
    const cost = parseFloat(form.total_drug_cost);
    if (form.total_drug_cost && (isNaN(cost) || cost < 0)) errs.total_drug_cost = 'Must be non-negative';
    const age = parseInt(form.age);
    if (form.age && (isNaN(age) || age < 18 || age > 120)) errs.age = 'Must be 18-120';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitSingle = async () => {
    if (!validate()) return;
    const patient = {
      patient_id: form.patient_id || 'P-UNKNOWN',
      drug_name: form.drug_name,
      drug_ndc: form.drug_ndc,
      drug_dose: form.drug_dose,
      drug_unit: form.drug_unit,
      last_fill_date: form.last_fill_date,
      days_supply: form.days_supply,
      quantity_dispensed: form.quantity_dispensed,
      patient_pay_amt: form.patient_pay_amt,
      total_drug_cost: form.total_drug_cost,
      refill_count: form.refill_count,
      age: form.age,
      chronic_conditions: form.chronic_conditions,
    };
    try {
      const stream = await predict([patient]);
      onStartProcessing(stream);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const submitBatch = async () => {
    if (batchPatients.length === 0) return;
    try {
      const stream = await predict(batchPatients);
      onStartProcessing(stream);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, patients } = parseCSV(e.target.result);
      setBatchHeaders(headers);
      setBatchPatients(patients);
    };
    reader.readAsText(file);
  };

  const loadDemoBatch = async () => {
    try {
      const res = await fetch('/api/template');
      const text = await res.text();
      const { headers, patients } = parseCSV(text);
      setBatchHeaders(headers);
      setBatchPatients(patients);
      setFileName('sample_data.csv');
    } catch (err) {
      alert('Failed to load sample data');
    }
  };

  const loadDemoSingle = () => {
    setForm(DEMO_SINGLE);
    setErrors({});
  };

  // Detect PDE format
  const isPDE = batchHeaders.some((h) => h.trim() === 'DESYNPUF_ID');
  const previewCols = isPDE
    ? ['DESYNPUF_ID', 'PROD_SRVC_ID', 'SRVC_DT', 'DAYS_SUPLY_NUM', 'PTNT_PAY_AMT']
    : ['patient_id', 'drug_name', 'last_fill_date', 'days_supply', 'patient_pay_amt', 'refill_count'];

  return (
    <section className="section" id="input-section">
      <div className="container">
        <h2 className="sec-title">Patient Risk Assessment</h2>
        <p className="sec-sub">Enter patient prescription data to generate adherence risk predictions with explainable insights.</p>

        <div className="tab-bar">
          <button
            className={`tab-btn ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => setActiveTab('single')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person</span> Single Patient
          </button>
          <button
            className={`tab-btn ${activeTab === 'batch' ? 'active' : ''}`}
            onClick={() => setActiveTab('batch')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>groups</span> Batch Upload
          </button>
        </div>

        {/* Single Patient Tab */}
        {activeTab === 'single' && (
          <div className="card">
            <div className="form-grid">
              <FormField label="Patient ID">
                <input type="text" value={form.patient_id} onChange={(e) => updateField('patient_id', e.target.value)} placeholder="e.g. P-10001" maxLength={50} />
              </FormField>

              <div className="fg" style={{ position: 'relative' }}>
                <label>Drug Name / NDC Search</label>
                <input
                  type="text"
                  value={form.drug_name}
                  onChange={(e) => handleDrugInput(e.target.value)}
                  onBlur={() => setTimeout(() => setShowNdc(false), 200)}
                  placeholder="Type drug name to search..."
                  autoComplete="off"
                  maxLength={100}
                  className={errors.drug_name ? 'invalid' : ''}
                />
                {errors.drug_name && <div className="err">{errors.drug_name}</div>}
                {showNdc && (
                  <div className="ndc-results show">
                    {ndcResults.map((d, i) => (
                      <div key={i} className="ndc-item" onMouseDown={() => selectNdc(d)}>
                        <div className="ndc-brand">{(d.brand_name || d.generic_name)} — {d.dosage_form}</div>
                        <div className="ndc-generic">{d.generic_name}{d.strength ? ` (${d.strength})` : ''}{d.route ? ` — ${d.route}` : ''}</div>
                        <div className="ndc-code">NDC: {d.ndc}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <FormField label="NDC Code" opt="(auto-filled or manual)" error={errors.drug_ndc}>
                <input type="text" value={form.drug_ndc} onChange={(e) => updateField('drug_ndc', e.target.value)} placeholder="e.g. 00093-7212-01" maxLength={20} />
              </FormField>

              <div className="fg">
                <label>Drug Dose &amp; Unit <span className="opt">(optional)</span></label>
                <div className="form-row">
                  <input type="number" value={form.drug_dose} onChange={(e) => updateField('drug_dose', e.target.value)} placeholder="e.g. 500" min="0" step="any" />
                  <select value={form.drug_unit} onChange={(e) => updateField('drug_unit', e.target.value)}>
                    <option value="mg">mg</option>
                    <option value="mcg">mcg</option>
                    <option value="ml">ml</option>
                    <option value="g">g</option>
                    <option value="units">units</option>
                    <option value="puffs">puffs</option>
                  </select>
                </div>
              </div>

              <FormField label="Last Fill Date" error={errors.last_fill_date}>
                <input type="date" value={form.last_fill_date} onChange={(e) => updateField('last_fill_date', e.target.value)} required className={errors.last_fill_date ? 'invalid' : ''} />
              </FormField>

              <FormField label="Days Supply" error={errors.days_supply}>
                <input type="number" value={form.days_supply} onChange={(e) => updateField('days_supply', e.target.value)} min="1" max="365" required className={errors.days_supply ? 'invalid' : ''} />
              </FormField>

              <FormField label="Quantity Dispensed" opt="(optional)">
                <input type="number" value={form.quantity_dispensed} onChange={(e) => updateField('quantity_dispensed', e.target.value)} placeholder="e.g. 60" min="0" />
              </FormField>

              <FormField label="Patient Pay Amount ($)" opt="(optional)" error={errors.patient_pay_amt}>
                <input type="number" value={form.patient_pay_amt} onChange={(e) => updateField('patient_pay_amt', e.target.value)} step="0.01" placeholder="e.g. 12.50" min="0" className={errors.patient_pay_amt ? 'invalid' : ''} />
              </FormField>

              <FormField label="Total Drug Cost ($)" opt="(optional)" error={errors.total_drug_cost}>
                <input type="number" value={form.total_drug_cost} onChange={(e) => updateField('total_drug_cost', e.target.value)} step="0.01" placeholder="e.g. 45.00" min="0" className={errors.total_drug_cost ? 'invalid' : ''} />
              </FormField>

              <FormField label="Prior Refill Count" opt="(optional)">
                <input type="number" value={form.refill_count} onChange={(e) => updateField('refill_count', e.target.value)} placeholder="e.g. 8" min="0" max="999" />
              </FormField>

              <FormField label="Age" opt="(optional)" error={errors.age}>
                <input type="number" value={form.age} onChange={(e) => updateField('age', e.target.value)} placeholder="e.g. 72" min="18" max="120" className={errors.age ? 'invalid' : ''} />
              </FormField>

              <div className="fg form-full">
                <label>Chronic Conditions <span className="opt">(optional, comma-separated)</span></label>
                <input type="text" value={form.chronic_conditions} onChange={(e) => updateField('chronic_conditions', e.target.value)} placeholder="e.g. Diabetes, Hypertension, CHF" maxLength={500} />
              </div>
            </div>

            <div className="btn-group">
              <button className="btn btn-p" onClick={submitSingle}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>speed</span> Analyse Risk
              </button>
              <button className="btn btn-s" onClick={loadDemoSingle}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>science</span> Load Demo Data
              </button>
            </div>
          </div>
        )}

        {/* Batch Upload Tab */}
        {activeTab === 'batch' && (
          <div className="card">
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-s btn-sm" onClick={downloadTemplate}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span> Download Template CSV
              </button>
              <button className="btn btn-s btn-sm" onClick={loadDemoBatch}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>science</span> Load Sample Data (3 patients)
              </button>
            </div>
            <div className="format-note">
              <strong>Supported formats:</strong> Our template format or raw CMS PDE columns (DESYNPUF_ID, SRVC_DT, PROD_SRVC_ID, etc.)
            </div>
            <UploadZone onFile={handleFile} fileName={fileName} />

            {batchPatients.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle' }}>table_chart</span>
                  {' '}{batchPatients.length} patients loaded
                </p>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--sm)', maxHeight: 200, overflowY: 'auto' }}>
                  <table className="rt" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>{previewCols.map((c) => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {batchPatients.map((p, i) => (
                        <tr key={i}>{previewCols.map((c) => <td key={c}>{p[c] || '\u2014'}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="btn-group">
              <button className="btn btn-p" onClick={submitBatch} disabled={batchPatients.length === 0}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>speed</span> Analyse Batch
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FormField({ label, opt, error, children }) {
  return (
    <div className="fg">
      <label>{label}{opt && <span className="opt"> {opt}</span>}</label>
      {children}
      {error && <div className="err">{error}</div>}
    </div>
  );
}

function UploadZone({ onFile, fileName }) {
  const [dragover, setDragover] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      onFile(file);
    }
  };

  return (
    <div
      className={`upload-zone${dragover ? ' dragover' : ''}`}
      style={{ marginTop: 16 }}
      onDragEnter={(e) => { e.preventDefault(); setDragover(true); }}
      onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragover(false); }}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".csv"
        onChange={(e) => onFile(e.target.files[0])}
      />
      <span className="material-symbols-outlined">cloud_upload</span>
      <p><strong>Drop your CSV file here</strong> or click to browse</p>
      <p style={{ fontSize: 12, marginTop: 6, color: '#9ca3af' }}>Accepts .csv files — auto-detects column format</p>
      {fileName && (
        <div style={{ marginTop: 12, fontWeight: 600, color: 'var(--navy)' }}>{fileName}</div>
      )}
    </div>
  );
}
