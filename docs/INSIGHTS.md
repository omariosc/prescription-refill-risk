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

### Overview
- **4,741,335 total claims** across both files (1A + 1B), 142 columns each
- **98,626 unique patients**, median **42 claims per patient** (range 1-261) — very data-rich
- Wide format: each claim has up to 13 service lines, but **58.4% use only 1 line**

### Patient Overlap
- **94.7% of PDE patients have carrier claims** — nearly universal enrichment
- Only 5,278 PDE patients (5.3%) have zero carrier claims
- Combined with IP/OP findings: only a tiny fraction of PDE patients have NO claims of any type

### Top Diagnoses (directly relevant to adherence)
| ICD9 Code | Count | Condition |
|-----------|-------|-----------|
| 4019 | 532,957 | Hypertension, unspecified |
| 4011 | 479,005 | Benign essential hypertension |
| 25000 | 454,892 | Type II diabetes |
| 2724 | 341,447 | Hyperlipidemia |
| 42731 | 261,186 | Atrial fibrillation |
| V5869 | 168,011 | Long-term drug use, other |

### Top HCPCS Procedures
| Code | Count | Meaning |
|------|-------|---------|
| 99213 | 600,006 | Office visit, established patient, low complexity |
| 99214 | 429,649 | Office visit, moderate complexity |
| 36415 | 369,023 | Venipuncture (blood draw) |
| 85025 | 174,739 | CBC with differential |
| 80053 | 147,680 | Comprehensive metabolic panel |

### Key Feature Ideas from Carrier Data
1. **Healthcare engagement:** unique visit dates, office visit frequency (99211-99215), visit regularity
2. **Clinical complexity:** unique ICD9 count, Charlson Comorbidity Index from ICD9 codes
3. **Provider continuity:** unique NPIs seen, concentration of visits to primary provider
4. **Service mix:** ratio of office visits vs labs vs hospital care
5. **Temporal signals:** visit frequency in 30/60/90 days before a fill, gap between last physician visit and expected refill date
6. **Spending trends:** total Medicare payment per period, average cost per claim

### 2010 Volume
- 2010 has 24.5% of carrier claims vs ~36-39% for 2008/2009 — same truncation pattern as IP/OP

---

## 6. PDE (Prescription Drug Events) Insights

### Overview
- **5,552,421 rows**, 8 columns, 869MB in memory, zero nulls, zero duplicates
- **99,538 unique patients**, median 44 fills per patient (range 1-256)
- Date range: 2008-01-01 to 2010-12-31

### CRITICAL FINDING: NDC Granularity Problem
At the natural **NDC-11 level, 99.9% of (patient, drug) pairs have only 1 fill** — making them unlabelable for refill prediction. The synthetic data randomized NDC codes per event rather than maintaining prescription continuity. This is the single biggest challenge.

| Grouping Level | Multi-fill pairs | Rows in multi-fill groups | % of total pairs |
|----------------|-----------------|---------------------------|-----------------|
| NDC-11 (full) | 3,263 | 6,533 | 0.06% |
| NDC-9 (product) | 28,526 | 58,191 | 0.5% |
| **NDC-5 (labeler)** | **717,647** | **2,232,682** | **17.8%** |

**Decision: Use NDC-5 (first 5 digits) as the drug grouping level.** This gives us 2.2M usable rows from 717K patient-drug pairs. This should be clearly explained in the presentation as a necessary adaptation to the synthetic data's limitations.

### Refill Gap Analysis (at NDC-5 level)
- 1,515,035 consecutive fill gaps computed
- Gap distribution: min=0, median=121, mean=190.5, max=1,090 days
- Compared to DAYS_SUPLY_NUM median of 30 days
- **79.7% of refills are "late"** by the gap > days_supply + grace_window measure
- This means "late" is the MAJORITY class — the minority class is "on-time" refills
- **Implication for modelling:** We may want to predict "on-time" as the positive class, or reframe the label. PR-AUC evaluation should be done carefully with respect to class balance.

### DAYS_SUPLY_NUM Distribution
- 30 days: 71.6%, 90 days: 10.7%, 10 days: 9.2%, 20 days: 4.2%, **0 days: 2.1%**
- 117,726 rows have zero days supply — must filter (breaks label construction)
- No negatives

### Cost Columns
- **PTNT_PAY_AMT:** 61.5% exactly zero, capped at $170, all multiples of $10
- **TOT_RX_CST_AMT:** 9.9% zero, capped at $570, all multiples of $10
- Coarsely binned — limited signal but usable as ordinal features

### 2010 Attrition
- 2010 volume drops 75% from January (172K) to December (43K)
- Right-censoring is severe for late-2010 fills
- Year distribution: 2008=1.99M, 2009=2.17M, 2010=1.39M

### Other Anomalies
- 23 rows have `PROD_SRVC_ID = "OTHER"` (literal string, not NDC) — drop
- 3,188 "triple-zero" rows (days=0, qty=0, cost=0) — likely void/cancelled, drop
- 233,238 rows (4.2%) have QTY_DSPNSD_NUM = 0

---

## 7. Design Decisions

### Label Construction
- **Drug grouping: NDC-5 (first 5 digits)** — NDC-11 is unusable (99.9% single-fill pairs due to synthetic data)
- **Late refill = next fill of the same NDC-5 group occurs after `SRVC_DT + DAYS_SUPLY_NUM + 7 days`**
- Filter out fills with `DAYS_SUPLY_NUM = 0` (breaks label logic) and `PROD_SRVC_ID = "OTHER"`
- Exclude last fill per (patient, NDC-5) pair — no observable next fill
- **Death censoring:** if `BENE_DEATH_DT` falls before expected run-out, exclude fill from labels
- Sensitivity check with 14-day grace window
- **Class balance note:** ~80% of refills are "late" at NDC-5 level — this is the MAJORITY class. Consider reframing or adjusting evaluation accordingly.

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
