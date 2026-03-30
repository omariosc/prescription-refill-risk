# CLAUDE.md — Prescription Refill Risk

Hackathon project for Challenge A: Late Refill Risk Prediction.
Repo: https://github.com/omariosc/prescription-refill-risk
Submission deadline: **13:00, Tuesday 31 March 2026** (repo must be public).

## Team
- Xin Ci Wong
- Arpita Saggar
- Omar Choudhry

---

## Project Goal

Predict which (patient, drug) pairs are likely to refill late next time and produce a calibrated risk score, using only prescription order event data enriched with claims and beneficiary data.

**Label:** `late = 1` if the next fill occurs after `SRVC_DT + DAYS_SUPLY_NUM + grace_window` (use 7 days as default, 14 as sensitivity check).
**Metric:** PR-AUC (primary) + calibration check.
**Demo:** patient timeline for 1–2 drugs + risk score + top feature drivers (SHAP).

---

## Data

All files live in `data/raw/` (gitignored). Never commit data files.

| File | Description |
|------|-------------|
| `DE1_0_2008_to_2010_Prescription_Drug_Events_Sample_1.csv` | PRIMARY — 5.5M fill events |
| `DE1_0_2008_Beneficiary_Summary_File_Sample_1.csv` | Patient demographics + chronic conditions (2008) |
| `DE1_0_2009_Beneficiary_Summary_File_Sample_1.csv` | Patient demographics + chronic conditions (2009) |
| `DE1_0_2010_Beneficiary_Summary_File_Sample_1.csv` | Patient demographics + chronic conditions (2010) |
| `DE1_0_2008_to_2010_Inpatient_Claims_Sample_1.csv` | Hospital admissions (16MB) |
| `DE1_0_2008_to_2010_Outpatient_Claims_Sample_1.csv` | Outpatient visits (154MB) |
| `DE1_0_2008_to_2010_Carrier_Claims_Sample_1A.csv` | Physician/professional claims part 1 (1.2GB) |
| `DE1_0_2008_to_2010_Carrier_Claims_Sample_1B.csv` | Physician/professional claims part 2 (1.2GB) |

All datasets join on `DESYNPUF_ID`. Beneficiary files are joined year-matched to the fill's `SRVC_DT` year.

### Key columns (PDE)
- `DESYNPUF_ID` — pseudonymised patient ID
- `SRVC_DT` — fill date (format: YYYYMMDD integer)
- `PROD_SRVC_ID` — NDC-11 drug code. **Use first 5 digits (NDC-5) for drug grouping** — NDC-11 is unusable because the synthetic data randomised NDC codes per event (99.9% of NDC-11 pairs have only 1 fill).
- `DAYS_SUPLY_NUM` — days of supply dispensed. **2.1% are zero — must filter.**
- `QTY_DSPNSD_NUM` — quantity dispensed
- `PTNT_PAY_AMT` / `TOT_RX_CST_AMT` — cost signals (coarsely binned, multiples of $10)

### Critical data notes
- **NDC-5 grouping gives 717K multi-fill pairs (2.2M rows)** — this is our working dataset
- **~80% of refills are "late"** at NDC-5 level — late is the majority class
- Chronic condition flags: **1=Yes, 2=No** — must remap to 0/1
- `BENE_ESRD_IND`: **"0"/"Y"** string — remap to 0/1
- `BENE_RACE_CD`: codes {1,2,3,5} only — no code 4
- Death dates are **month-granularity** (always day=01)
- 2010 volume drops significantly (truncation artifact)

---

## Code Structure

```
src/
  data_loading.py       # Load and parse raw CSVs
  labels.py             # Construct late-refill labels (time-based)
  features_pde.py       # Features from PDE only (refill gaps, cadence, cost)
  features_bene.py      # Features from beneficiary summary (demographics, chronic conditions)
  features_claims.py    # Aggregated features from inpatient/outpatient/carrier claims
  merge.py              # Join all feature tables into model-ready dataset
  model.py              # Train/evaluate model (time-based split)
  explain.py            # SHAP-based feature importance + patient timeline demo
  utils.py              # Shared helpers (date parsing, etc.)
scripts/
  run_pipeline.py       # End-to-end: load → features → train → evaluate → demo
outputs/                # Figures, metrics, saved model (gitignored for large files)
```

---

## Development Rules

### Language & style
- Python only — no Jupyter notebooks. Use `.py` scripts.
- Use `pandas` for data manipulation, `scikit-learn` for modelling, `shap` for explanations.
- Type hints on all function signatures.
- Keep functions small and single-purpose.

### Data handling
- **Never load the full carrier claims (2.4GB) into memory at once.** Use chunked reading (`pd.read_csv(..., chunksize=...)`) and aggregate before collecting.
- Always parse `SRVC_DT` and date columns as integers then convert to `pd.Timestamp`.
- Use `DESYNPUF_ID` as the join key everywhere — never drop it until the final feature matrix.

### Temporal integrity (critical)
- **No data leakage.** Every feature for a fill at time T must be computed using only data with dates strictly before T.
- Train/validation split must be time-based (e.g., train on 2008–2009 fills, validate on 2010 fills).
- The last fill per (patient, drug) has no observed next fill — exclude from training labels but handle correctly in inference.
- **Death censoring:** if `BENE_DEATH_DT` falls before the expected run-out date of a fill, that fill must not be labelled as "late" — exclude it.

### Modelling
- Start with LightGBM or XGBoost as the primary model.
- Always evaluate PR-AUC, not just ROC-AUC (class imbalance expected).
- Run a calibration check (reliability diagram) before claiming the model is production-ready.

### Outputs
- Save metrics to `outputs/metrics.json`.
- Save feature importance plots to `outputs/`.
- The demo script (`explain.py`) should accept a `DESYNPUF_ID` and print a readable patient timeline + risk score.

---

## Submission Checklist
- [ ] Repo is public on GitHub
- [ ] README has clear instructions to reproduce results (dependencies, data setup, run command)
- [ ] `scripts/run_pipeline.py` runs end-to-end without errors
- [ ] PR-AUC + calibration results saved to `outputs/metrics.json`
- [ ] Demo works: input patient ID → timeline + risk score
- [ ] Caveats stated: synthetic data, not clinical advice
