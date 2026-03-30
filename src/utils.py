"""Shared constants and utilities for the prescription refill risk pipeline.

This is the single source of truth for all pipeline configuration.
Change values here and they propagate everywhere automatically.
"""

from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Project paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
OUTPUTS = PROJECT_ROOT / "outputs"

# Ensure directories exist on import
DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
OUTPUTS.mkdir(parents=True, exist_ok=True)
(OUTPUTS / "population").mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Pipeline configuration  (edit these to change behaviour)
# ---------------------------------------------------------------------------

# Number of days after expected run-out before a refill is considered "late".
# e.g. GRACE_DAYS=7 means a fill arriving up to 7 days late is still on-time.
GRACE_DAYS = 7

# Temporal train / validation / test split boundaries.
# All fills on or before TRAIN_END → train set.
# Fills between TRAIN_END and VAL_END → validation set.
# Fills after VAL_END → test set.
# These dates are specific to the CMS DE-SynPUF 2008–2010 dataset.
TRAIN_END = "2009-06-30"
VAL_END   = "2009-12-31"

# ---------------------------------------------------------------------------
# Risk tier boundaries  (single source of truth)
#
# Used by: uncertainty.py, run_pipeline.py, run_population.py, demo worker
# ---------------------------------------------------------------------------

# Predicted probability thresholds for risk classification.
# Below TIER_LOW  → LOW risk
# TIER_LOW to TIER_HIGH → MEDIUM risk
# At or above TIER_HIGH → HIGH risk
#
# Boundaries were chosen so each tier captures roughly a third of the
# test-set population while maximising separation of actual late rates.
TIER_LOW  = 0.30
TIER_HIGH = 0.55

# Human-readable descriptions sent to the frontend / API
TIER_DESCRIPTIONS = {
    "LOW":    "Below-average late-refill probability. Standard monitoring is sufficient.",
    "MEDIUM": "Around-average late-refill probability. Automated reminder at expected run-out.",
    "HIGH":   "Above-average late-refill probability. Proactive pharmacist outreach recommended.",
}

# ---------------------------------------------------------------------------
# Chronic condition column mappings
# ---------------------------------------------------------------------------

# Raw column names in the CMS beneficiary summary files
CHRONIC_COLS = [
    "SP_ALZHDMTA", "SP_CHF", "SP_CHRNKIDN", "SP_CNCR", "SP_COPD",
    "SP_DEPRESSN", "SP_DIABETES", "SP_ISCHMCHT", "SP_OSTEOPRS",
    "SP_RA_OA", "SP_STRKETIA",
]

# Mapping from CMS column names to friendly Python names
CHRONIC_NAMES = {
    "SP_ALZHDMTA": "has_alzheimers",
    "SP_CHF": "has_chf",
    "SP_CHRNKIDN": "has_ckd",
    "SP_CNCR": "has_cancer",
    "SP_COPD": "has_copd",
    "SP_DEPRESSN": "has_depression",
    "SP_DIABETES": "has_diabetes",
    "SP_ISCHMCHT": "has_ischemic_heart",
    "SP_OSTEOPRS": "has_osteoporosis",
    "SP_RA_OA": "has_ra_oa",
    "SP_STRKETIA": "has_stroke",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_cms_date(series: pd.Series) -> pd.Series:
    """Parse CMS YYYYMMDD integer dates to datetime.

    The CMS DE-SynPUF dataset stores dates as 8-digit integers (e.g. 20080101).
    Invalid or missing values are silently converted to NaT.
    """
    return pd.to_datetime(series, format="%Y%m%d", errors="coerce")
