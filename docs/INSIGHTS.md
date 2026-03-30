# Data Insights & Findings

Living document capturing key insights from data exploration, feature engineering, and modelling.
Use for the final pitch to show the panel what we investigated and why our decisions matter.

---

## 1. Data Overview

**Dataset:** CMS DE-SynPUF Prescription Drug Events (PDE), Sample 1, 2008-2010.
Fully synthetic Medicare Part D-style data. Outputs must not be interpreted as clinical advice.

| File | Rows | Unique Patients | Size |
|------|------|-----------------|------|
| Prescription Drug Events | 5,552,421 | 99,538 | 405MB |
| Beneficiary Summary 2008 | 116,352 | 116,352 | 14MB |
| Beneficiary Summary 2009 | 114,538 | 114,538 | 14MB |
| Beneficiary Summary 2010 | 112,754 | 112,754 | 13MB |
| Inpatient Claims | 66,773 | 37,780 | 16MB |
| Outpatient Claims | 790,790 | 85,272 | 154MB |
| Carrier Claims 1A + 1B | ~19M combined | TBD | 2.4GB |

---

## 2. Key Data Quality Findings

### Synthetic Data Caveats (from documentation)
- All variables were imputed/suppressed/coarsened during synthesis
- **Date perturbation was applied** — claim dates altered and intervals proportionally adjusted. Refill gaps are synthetic artifacts, not real adherence patterns. This is fine for our exercise but must be acknowledged.
- **DAYS_SUPLY_NUM was coarsened** — expected run-out dates have built-in noise
- **Chronic condition prevalence is inflated ~2x** vs reality (e.g., diabetes 38% vs 23% actual)
- **Fewer PDE events per person than reality** — 10th percentile is 3 fills vs 14 in real data. Shorter, sparser refill sequences.
- **Multivariate relationships are unreliable** — correlations between variables were deliberately altered during synthesis

### Data Anomalies (documented, no cleaning was performed by CMS)
- **DAYS_SUPLY_NUM can be zero** — breaks label construction since `run-out = SRVC_DT + 0 = SRVC_DT`, making every subsequent fill appear infinitely late. Must filter or impute.
- **Negative reimbursement values** exist (adjustments/refunds) — small counts, can clip to zero
- **Zero drug costs** exist in PDE

### Encoding Quirks
- **Chronic conditions (`SP_*`): 1 = Yes, 2 = No** — counter-intuitive, must remap to 0/1
- **`BENE_ESRD_IND`: "0" / "Y"** — string type, not numeric. Remap to 0/1.
- **`BENE_RACE_CD`: codes {1, 2, 3, 5}** — no code 4 (Asian absent from sample). 1=White, 2=Black, 3=Other, 5=Hispanic.
- **All dates stored as YYYYMMDD integers** — must parse to datetime

---

## 3. Beneficiary Insights

### Cohort Structure
- Cohort is perfectly nested: 2010 patients are a subset of 2009, which is a subset of 2008
- Attrition is 100% explained by death — zero unexplained dropouts
- Death rate: ~1.6% per year (1,814 in 2008, 1,784 in 2009, 1,863 in 2010)
- **Death dates are month-granularity only** (always day=01) — censoring must use month-level precision

### Demographics
- Age: mean ~72, range 24-101. 15-21% under 65 (disability/ESRD eligible)
- Sex: 44.7% male / 55.3% female, stable across years
- Race: 82.8% White, 10.6% Black, 4.2% Other, 2.4% Hispanic

### Chronic Conditions (IMPORTANT)
- **Conditions are re-randomized year-to-year** (synthetic artifact). Diabetes "resolves" in 20.5% of patients between 2009-2010. Not realistic.
- **Mitigation:** Use "ever had" approach (flag=1 if condition appeared in ANY year), or use single-year snapshot
- Most prevalent: Ischemic heart disease (42%), Diabetes (38%), CHF (28%), Depression (21%)

### Coverage
- **`PLAN_CVRG_MOS_NUM` is critical** — patients with zero Part D coverage months won't generate PDE records. 40.6% zero in 2008, dropping to 11.8% in 2010.
- 100% of PDE patients have beneficiary records (clean join, no orphans)
- 14.5% of beneficiaries have NO PDE records (likely no Part D coverage)

---

## 4. Claims Insights

### Inpatient (Hospital Admissions)
- 37,780 unique patients with hospitalisations, most have 1-2 admissions
- Median stay: 4 days, mean 5.7, range 0-35
- **27.2% of stays are 7+ days** — prime candidates for disrupting refill schedules
- **29.6% of readmission gaps are within 30 days** — patients in rapid admission cycles can't manage pharmacy visits
- Top diagnoses: hypertension, CHF, diabetes, hyperlipidemia, atrial fibrillation — all conditions requiring ongoing medication

### Outpatient
- 85,272 unique patients, median 7 visits per patient
- **86.6% of visits are same-day** — mostly routine appointments
- **V58 codes ("long-term drug use") appear prominently** — directly flag patients on ongoing medication regimens. Useful as positive refill-schedule indicators.
- Top diagnoses heavily overlap with inpatient (hypertension, diabetes, hyperlipidemia)

### Patient Overlap with PDE
- **36.6% of PDE patients have inpatient claims** — hospitalisation features for ~1/3 of cohort
- **81.9% of PDE patients have outpatient claims** — healthcare engagement features for most patients
- **16.8% of PDE patients have zero facility claims** — low-utilisation cohort, may have carrier claims only

### 2010 Truncation
- **2010 claims volume is roughly half of 2008/2009** in both inpatient and outpatient
- This affects our time-based validation split — 2010 test set will have fewer claims-derived features, which is actually realistic (simulating prediction with less history available)

---

## 5. Carrier Claims Insights

*Awaiting analysis — 2.4GB combined files being profiled with chunked processing.*

---

## 6. PDE (Prescription Drug Events) Insights

*Awaiting detailed analysis — 5.5M row profiling in progress.*

---

## 7. Design Decisions

### Label Construction
- **Late refill = next fill occurs after `SRVC_DT + DAYS_SUPLY_NUM + 7 days`** (grace window)
- Filter out fills with `DAYS_SUPLY_NUM = 0` (breaks label logic)
- Exclude last fill per (patient, drug) pair — no observable next fill
- **Death censoring:** if `BENE_DEATH_DT` falls before expected run-out, exclude fill from labels
- Sensitivity check with 14-day grace window

### Temporal Split Strategy
- **Train:** fills with `SRVC_DT` in 2008-2009
- **Test:** fills with `SRVC_DT` in 2010
- All features for a fill at time T use only data from before T (no leakage)
- Note: 2010 test set has truncated claims data — this is acceptable and realistic

### Feature Groups
1. **PDE-derived:** refill gap history, cadence stability, early refills/stockpiling, cost patterns, days supply patterns, polypharmacy count
2. **Beneficiary-derived:** age, sex, race, chronic condition flags (remapped), coverage months, ESRD indicator
3. **Inpatient-derived:** hospitalisation count before fill, recent hospitalisation flag (30/60/90 days), length of stay in past year
4. **Outpatient-derived:** visit count (engagement proxy), recency of last visit, V58 long-term drug use flag
5. **Carrier-derived:** physician visit count, unique diagnoses seen, total spending (aggregated from chunks)

---

## 8. Modelling Notes

*To be filled during model building.*

---

## 9. Results & Evaluation

*To be filled after evaluation.*

---

## 10. Caveats for Presentation
1. Data is fully synthetic — outputs are for modelling/product-thinking purposes only
2. Date perturbation means refill gaps are synthetic artifacts, not real adherence patterns
3. Chronic condition prevalence is inflated ~2x vs reality
4. Fewer prescription events per person than reality — shorter sequences
5. **Not clinical advice** — this is a pipeline demonstration, not a prescribing tool
