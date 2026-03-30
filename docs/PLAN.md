# Implementation Plan: Late Refill Risk Prediction

Comprehensive pipeline plan based on data profiling of all 8 source files.

---

## Phase 0: Data Cleaning & Temporal Split (DO THIS FIRST)

**Why first:** The temporal split must happen before ANY feature engineering or modelling to prevent data leakage. Features are computed relative to each fill's date, and only using data from before that date.

### Step 0.1: Load and clean PDE
1. Load `DE1_0_2008_to_2010_Prescription_Drug_Events_Sample_1.csv`
2. Parse `SRVC_DT` from YYYYMMDD integer to datetime
3. Create `NDC5 = PROD_SRVC_ID.str[:5]` column
4. **Drop rows:**
   - `PROD_SRVC_ID == "OTHER"` (23 rows)
   - `DAYS_SUPLY_NUM == 0` (117,726 rows, 2.1%) — breaks label logic
   - Triple-zero rows (days=0, qty=0, cost=0) — 3,188 void/cancelled records
5. Verify: no nulls, no duplicate PDE_IDs

### Step 0.2: Load and clean Beneficiary data
1. Load all 3 beneficiary summary files (2008, 2009, 2010)
2. Parse `BENE_BIRTH_DT` and `BENE_DEATH_DT` from YYYYMMDD integers to datetime
3. **Remap chronic condition flags:** all `SP_*` columns from {1=Yes, 2=No} to {1, 0}
4. **Remap `BENE_ESRD_IND`:** "Y" -> 1, "0" -> 0
5. Compute `age` = fill_year - birth_year (will be joined per-fill later)
6. **Create "ever had" chronic condition flags** across all 3 years (max of each SP_* per patient) — addresses the year-to-year re-randomisation artifact
7. Stack/index by (DESYNPUF_ID, year) for year-matched joins

### Step 0.3: Load and prepare Claims data
1. **Inpatient:** Load full file (16MB, fits in memory). Parse dates. Keep: DESYNPUF_ID, CLM_ADMSN_DT, NCH_BENE_DSCHRG_DT, CLM_UTLZTN_DAY_CNT, ICD9_DGNS_CD_1-4, CLM_PMT_AMT.
2. **Outpatient:** Load full file (154MB, fits). Parse dates. Keep: DESYNPUF_ID, CLM_FROM_DT, CLM_THRU_DT, ICD9_DGNS_CD_1-2, NCH_BENE_PTB_COINSRNC_AMT. Flag V58 codes.
3. **Carrier:** Load in chunks (chunksize=200K). For each chunk, extract: DESYNPUF_ID, CLM_FROM_DT, ICD9_DGNS_CD_1, HCPCS_CD_1, LINE_NCH_PMT_AMT_1. Aggregate to patient-date level. Discard raw wide columns.

### Step 0.4: Temporal split
- **Train set:** PDE fills where `SRVC_DT` is in **2008-01-01 to 2009-06-30**
- **Validation set:** PDE fills where `SRVC_DT` is in **2009-07-01 to 2009-12-31**
- **Test set:** PDE fills where `SRVC_DT` is in **2010-01-01 to 2010-12-31**

Rationale: A clean 3-way split gives us a validation set for hyperparameter tuning and a held-out test set for final evaluation. Using mid-2009 as the val cutoff avoids making the test set too small (2010 is already truncated).

**Important:** Features for fills in any split are computed using ALL historical data before that fill's date — including data from other splits. The split is on the TARGET fill date, not on the feature data.

---

## Phase 1: Label Construction

### Step 1.1: Build refill sequences
1. Sort PDE by (DESYNPUF_ID, NDC5, SRVC_DT)
2. For each (patient, NDC5) group, compute:
   - `expected_runout = SRVC_DT + timedelta(days=DAYS_SUPLY_NUM)`
   - `next_fill_date = SRVC_DT.shift(-1)` within the group
   - `gap_days = (next_fill_date - SRVC_DT).days`
   - `excess_gap = gap_days - DAYS_SUPLY_NUM`
3. Last fill per group: `next_fill_date` is NaT — mark as censored

### Step 1.2: Apply labels
- `late = 1` if `excess_gap > 7` (7-day grace window)
- `late = 0` if `excess_gap <= 7`
- `late = NaN` (exclude) if:
  - Censored (last fill in group, no next fill observed)
  - Patient died before `expected_runout` (check `BENE_DEATH_DT`)
  - Next fill date is after 2010-12-31 (unobservable)

### Step 1.3: Verify class distribution
- Expected: ~80% late / ~20% on-time at NDC-5 level
- If heavily imbalanced, consider:
  - Using the raw `excess_gap` as a regression target instead of binary
  - Adjusting grace window (try 14 days)
  - Evaluating with PR-AUC for the minority class (on-time)

---

## Phase 2: Feature Engineering

All features are computed using only data strictly BEFORE each fill's `SRVC_DT`.

### Feature Group A: PDE-derived (per fill)
For each fill, look at the patient's prior fills (same NDC5 and across all drugs):

**Same-drug history (same NDC5):**
- `n_prior_fills_same_drug` — count of prior fills for this NDC5
- `mean_gap_same_drug` — mean gap between prior consecutive fills
- `std_gap_same_drug` — gap variability (cadence stability)
- `last_gap_same_drug` — most recent gap
- `was_last_late_same_drug` — binary, was the previous refill late?
- `n_late_history_same_drug` — count of prior late refills
- `pct_late_history_same_drug` — proportion of prior refills that were late
- `mean_days_supply_same_drug` — average days supply dispensed
- `mean_excess_gap_same_drug` — average excess gap (gap - days_supply)
- `early_refill_count` — fills where gap < days_supply (stockpiling signal)

**Cross-drug (all NDC5 groups for this patient):**
- `n_unique_drugs` — polypharmacy count (unique NDC5s filled before this date)
- `n_total_fills_all_drugs` — total fill count to date
- `mean_cost` — average TOT_RX_CST_AMT across prior fills
- `max_cost` — max single fill cost
- `mean_patient_pay` — average PTNT_PAY_AMT
- `days_since_last_any_fill` — recency of any prescription activity
- `fill_frequency_30d` — fills in last 30 days (any drug)
- `fill_frequency_90d` — fills in last 90 days

### Feature Group B: Beneficiary-derived (per patient-year)
Join on (DESYNPUF_ID, year of SRVC_DT):

- `age` — age at time of fill
- `sex` — binary (remap 1=male, 2=female to 0/1)
- `race` — categorical {1,2,3,5} (one-hot or leave as integer for tree models)
- `esrd` — binary (end-stage renal disease)
- `n_chronic_conditions` — sum of all 11 SP_* flags (remapped to 0/1)
- Individual chronic flags: `has_diabetes`, `has_depression`, `has_chf`, `has_copd`, `has_ckd`, `has_cancer`, `has_ischemic_heart`, `has_alzheimers`, `has_osteoporosis`, `has_ra_oa`, `has_stroke`
- `plan_coverage_months` — PLAN_CVRG_MOS_NUM (Part D coverage)
- `hmo_months` — BENE_HMO_CVRAGE_TOT_MONS
- `total_ip_reimbursement` — MEDREIMB_IP (annual healthcare spend proxy)
- `total_op_reimbursement` — MEDREIMB_OP
- `total_carrier_reimbursement` — MEDREIMB_CAR
- Also create "ever had" versions of chronic conditions (max across all years up to fill date)

### Feature Group C: Inpatient Claims-derived (temporal, per fill)
For each fill at time T, aggregate inpatient claims before T:

- `n_hospitalisations_365d` — count of admissions in past year
- `n_hospitalisations_90d` — count in past 90 days
- `n_hospitalisations_30d` — count in past 30 days
- `any_hospitalisation_30d` — binary flag
- `total_hospital_days_365d` — sum of CLM_UTLZTN_DAY_CNT in past year
- `days_since_last_discharge` — recency of last hospital stay
- `was_hospitalised_during_supply` — was patient in hospital between fill date and expected runout? (strong disruption signal)

### Feature Group D: Outpatient Claims-derived (temporal, per fill)
- `n_outpatient_visits_365d` — healthcare engagement proxy
- `n_outpatient_visits_90d`
- `n_outpatient_visits_30d`
- `days_since_last_outpatient` — recency
- `has_v58_code` — ever had a V58 "long-term drug use" diagnosis in outpatient records before T

### Feature Group E: Carrier Claims-derived (temporal, per fill)
Pre-aggregate carrier claims to patient-month level first (to manage 4.7M rows):
- `n_physician_visits_365d` — total carrier claims in past year
- `n_physician_visits_90d`
- `n_physician_visits_30d`
- `n_unique_diagnoses_365d` — clinical complexity proxy
- `n_unique_providers_365d` — provider continuity signal
- `total_carrier_spend_365d` — spending proxy
- `has_office_visit_30d` — binary, had HCPCS 99211-99215 in past 30 days

---

## Phase 3: Feature Merge & Final Dataset

### Step 3.1: Merge all feature groups
1. Start with PDE fills (with labels from Phase 1)
2. Left join Feature Group B on (DESYNPUF_ID, year)
3. Left join pre-computed Feature Groups C/D/E on DESYNPUF_ID (filtered by date)
4. Feature Group A is computed inline from PDE

### Step 3.2: Handle missing features
- Patients with no inpatient/outpatient/carrier claims: fill count features with 0, recency features with a large sentinel (e.g., 9999 days)
- First fill for a patient-drug pair: prior-fill features are 0/NaN — use 0 for counts, NaN for means (tree models handle this)

### Step 3.3: Save
- Save train/val/test feature matrices to `data/processed/` as parquet files
- Save feature names and metadata

---

## Phase 4: Modelling

### Step 4.1: Baseline
- LightGBM (fast, handles NaN natively, good with imbalanced data)
- No hyperparameter tuning yet — just default params with `is_unbalance=True`
- Evaluate on validation set: PR-AUC, ROC-AUC, precision/recall at various thresholds

### Step 4.2: Iterate
- Feature importance analysis (gain-based) — drop low-importance features
- Hyperparameter tuning on validation set (learning rate, max depth, num leaves, min child samples)
- Try `scale_pos_weight` if class imbalance is extreme
- Consider XGBoost as an alternative

### Step 4.3: Calibration
- Plot reliability diagram on validation set
- If poorly calibrated, apply Platt scaling or isotonic regression
- Re-evaluate calibration on test set

### Step 4.4: Final evaluation (test set)
- PR-AUC (primary metric)
- ROC-AUC (secondary)
- Precision/Recall at chosen threshold
- Calibration plot
- Save all metrics to `outputs/metrics.json`

---

## Phase 5: Explainability & Demo

### Step 5.1: SHAP analysis
- Compute SHAP values on test set (or sample if too large)
- Global feature importance bar plot → `outputs/shap_importance.png`
- SHAP summary (beeswarm) plot → `outputs/shap_summary.png`

### Step 5.2: Patient timeline demo
- Pick 1-2 patients with interesting refill patterns (mix of late and on-time)
- Plot: fill dates, expected run-out dates, actual next fill dates, risk score per fill
- Annotate with top SHAP drivers for each prediction
- Save to `outputs/` or generate interactively

### Step 5.3: Presentation materials
- Update `docs/INSIGHTS.md` with final results
- Generate 3-5 slides covering: framing, data, method, results, caveats
- Ensure `README.md` has clear reproduction instructions

---

## File Dependency Graph

```
Phase 0: data_loading.py → clean PDE, beneficiary, claims
                         → temporal_split.py (train/val/test indices)

Phase 1: labels.py → uses clean PDE + death dates
                   → outputs labelled fill table

Phase 2: features_pde.py → PDE-derived features
         features_bene.py → beneficiary features
         features_claims.py → inpatient + outpatient + carrier features

Phase 3: merge.py → joins all feature groups + labels
                  → outputs train/val/test feature matrices

Phase 4: model.py → trains LightGBM, evaluates, calibrates
                  → outputs metrics.json + model artifact

Phase 5: explain.py → SHAP analysis + patient timeline demo
```

---

## Estimated Complexity by Phase

| Phase | Complexity | Notes |
|-------|-----------|-------|
| 0 - Cleaning & Split | Medium | Carrier chunks need care; rest straightforward |
| 1 - Labels | Low | Simple groupby + shift operations at NDC-5 level |
| 2 - Feature Engineering | High | Temporal aggregation across 4 data sources is the bulk of the work |
| 3 - Merge | Low | Left joins + missing value handling |
| 4 - Modelling | Medium | LightGBM is fast; tuning takes time |
| 5 - Explainability | Medium | SHAP is compute-intensive on large datasets; may need to sample |
