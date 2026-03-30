# Risk Calibration & Uncertainty Quantification

How the model's raw scores translate to clinically meaningful risk tiers, what the trade-offs are, and why uncertainty estimates matter.

---

## 1. The Calibration Problem

Our model outputs a raw probability (0–1) for each fill. **These probabilities are systematically over-confident** — when the model says 30%, the actual late rate is ~54%. This is a known effect of `is_unbalance=True` in LightGBM combined with temporal distribution shift (train is 80% late, test is 59% late).

### Fine-grained calibration gap (test set)

| Predicted Score Range | N Fills | Predicted % | Actual % | Gap |
|-----------------------|---------|------------|---------|-----|
| 0.02 – 0.07 | 3,721 | 4.7% | 9.7% | +5.0% |
| 0.07 – 0.15 | 11,125 | 11.4% | 26.2% | +14.8% |
| 0.15 – 0.24 | 23,350 | 19.4% | 42.0% | +22.6% |
| 0.24 – 0.37 | 40,863 | 30.2% | 53.1% | +22.9% |
| 0.37 – 0.50 | 28,482 | 43.0% | 60.8% | +17.8% |
| 0.50 – 0.63 | 29,229 | 56.0% | 71.4% | +15.4% |
| 0.63 – 0.71 | 25,153 | 66.6% | 74.1% | +7.5% |
| 0.71 – 0.80 | 15,052 | 73.5% | 78.1% | +4.6% |
| 0.80 – 0.88 | 3,183 | 83.2% | 87.4% | +4.2% |

**Key insight:** The gap is largest in the mid-range (0.15–0.40), where the model under-predicts actual late rates by ~20%. At the extremes (very low and very high scores) the gap narrows. **This means the model's ranking is useful (high scores = higher risk) but the raw probabilities are not trustworthy as absolute numbers.**

### Implication
We should NOT report raw probabilities to clinicians. Instead, we should:
1. Define risk tiers with clear clinical meanings
2. Report confidence intervals (via MAPIE conformal prediction)
3. Communicate trade-offs explicitly

---

## 2. Risk Tier Definitions

### Recommended tiers: 0.30 / 0.55 boundaries

These boundaries give roughly equal-sized groups with clear separation in actual late rates:

| Tier | Score Range | % of Patients | Actual Late Rate | Captures % of All Late Refills | Suggested Action |
|------|-------------|---------------|------------------|-------------------------------|-----------------|
| **LOW** | 0.00 – 0.30 | 32.4% | **39.9%** | 21.9% | No action needed. Monitor passively. |
| **MEDIUM** | 0.30 – 0.55 | 33.8% | **60.7%** | 34.8% | Automated reminder (SMS/email/app notification) at expected run-out date. |
| **HIGH** | 0.55 – 1.00 | 33.8% | **75.6%** | 43.3% | Proactive pharmacist outreach before run-out. Priority for intervention. |

### Why these boundaries?

- **Low tier (39.9% actual late rate):** Even "low risk" patients are late ~40% of the time — but this is below the population average (59%). These patients mostly manage their refills without intervention.
- **Medium tier (60.7%):** Around the population average. A lightweight, automated reminder is cost-effective and doesn't burden GPs or pharmacists.
- **High tier (75.6%):** Three quarters of these refills end up late. These patients need human attention — a pharmacist call, delivery scheduling, or GP flag.

### Alternative considered: 0.35 / 0.60

| Tier | Score Range | % of Patients | Actual Late Rate |
|------|-------------|---------------|------------------|
| LOW | 0.00 – 0.35 | 41.3% | 43.3% |
| MEDIUM | 0.35 – 0.60 | 31.5% | 64.7% |
| HIGH | 0.60 – 1.00 | 27.2% | 76.3% |

This is more conservative — fewer patients flagged as high risk, but lower risk group is larger with higher late rate. Choose based on operational capacity.

---

## 3. The Operational Trade-Off

### If thresholds are too aggressive (too many HIGH)
- **Burden:** Pharmacists are overwhelmed with outreach calls for patients who would have refilled anyway
- **Cost:** Higher operational cost per prevented late refill
- **Alert fatigue:** Staff stop trusting the system if too many flags are false alarms
- **GP impact:** If flags are routed to GPs, adds to already-strained appointment capacity

### If thresholds are too conservative (too few HIGH)
- **Missed patients:** Genuinely at-risk patients don't get outreach and refill late
- **Equity concern:** Vulnerable patients (elderly, multi-morbid, socially isolated) are disproportionately affected
- **Health outcomes:** Late refills → medication gaps → hospital admissions → higher system costs
- **Lost trust:** If the system fails to flag patients who then have adverse events, clinical trust erodes

### The sweet spot
The 0.30/0.55 tiers flag ~34% of patients as high risk. For a pharmacy processing 10,000 refills/day:
- **~3,400 HIGH:** Need pharmacist review/call — of these, ~2,570 (75.6%) will actually be late
- **~3,380 MEDIUM:** Get automated reminder — costs almost nothing to send
- **~3,220 LOW:** No action — saves resources for where they matter

**Number needed to treat (NNT) equivalent:** For every 1.32 patients flagged HIGH, 1 would actually be late. This is a very efficient flag rate.

---

## 4. Uncertainty Quantification with MAPIE

### Why uncertainty matters here

The DE-SynPUF data has **coarsened variables** (days supply rounded, costs binned, dates perturbed). The ground truth labels are themselves approximations. A single point prediction hides this uncertainty.

**MAPIE (Model Agnostic Prediction Interval Estimator)** uses conformal prediction to produce valid prediction intervals — guaranteed coverage at a given confidence level, regardless of the underlying model.

### Approach: Conformal prediction on the risk score

We use MAPIE's `CrossConformalRegressor` with our LightGBM model wrapped as a sklearn-compatible regressor. This gives us:
- A **point prediction** (the risk score)
- A **prediction interval** [lower, upper] at 90% confidence
- The **width** of the interval indicates how uncertain the model is for that specific patient

### How to interpret

For a patient with score 0.65 ± [0.45, 0.82]:
- "We estimate a 65% probability of late refill, but it could be as low as 45% or as high as 82%"
- The 37-percentage-point width indicates moderate uncertainty
- Even the lower bound (45%) is above our MEDIUM threshold → flag this patient

For a patient with score 0.72 ± [0.68, 0.76]:
- "We estimate a 72% probability of late refill, with high confidence (narrow interval)"
- Even the lower bound is firmly HIGH → very confident this patient needs outreach

For a patient with score 0.40 ± [0.15, 0.70]:
- "We estimate a 40% probability, but uncertainty is very high"
- The interval spans all three tiers → the model doesn't have enough information
- Action: flag for clinical review rather than auto-classifying

### Implementation

```python
from mapie.regression import CrossConformalRegressor
from sklearn.base import BaseEstimator, RegressorMixin

# Wrap LightGBM Booster as sklearn regressor
class LGBMWrapper(BaseEstimator, RegressorMixin):
    def __init__(self, model):
        self.model = model
    def fit(self, X, y):
        return self  # already fitted
    def predict(self, X):
        return self.model.predict(X)

# Conformal prediction
mapie = CrossConformalRegressor(
    LGBMWrapper(model), method="plus", cv=5, confidence_level=0.90
)
mapie.fit_conformalize(X_cal, y_cal)  # uses validation set
y_pred, y_pis = mapie.predict_interval(X_test)
# y_pis[:, 0] = lower bound, y_pis[:, 1] = upper bound
```

### What wide intervals tell us
- **Patient has few prior fills:** Model has little history to work with
- **Patient's behaviour is erratic:** High `std_gap_same_drug` → hard to predict
- **Patient is in an under-represented group:** Few similar patients in training data

---

## 5. Recommendations for Production

1. **Never show raw probabilities to clinicians.** Use tier labels (LOW/MEDIUM/HIGH) with clear definitions.
2. **Always show confidence intervals** alongside the tier. "HIGH risk (75% ± 12%)" is much more honest than "HIGH risk (75%)".
3. **Flag wide intervals** for human review rather than auto-classifying.
4. **Re-calibrate regularly.** As patient population changes, the score-to-outcome mapping will drift. Update tiers quarterly.
5. **Monitor operational impact.** Track: outreach volume, actual late rate in each tier, pharmacist time per flag, patient satisfaction.
6. **This is synthetic data.** All thresholds, tier boundaries, and uncertainty estimates would need to be re-derived on real Pharmacy2U dispensing data. The methodology transfers; the numbers don't.

---

## 6. Summary Table for Pitch

| What we deliver | What it means |
|----------------|---------------|
| Risk score (0–1) | Relative likelihood of late refill — higher = more risk |
| Risk tier (LOW/MED/HIGH) | Actionable category with defined clinical response |
| Confidence interval (90%) | How certain we are — wide = uncertain, narrow = confident |
| Calibration analysis | We know the model over-predicts and adjust for it |
| Threshold trade-off analysis | We understand the cost of being too aggressive vs too conservative |
