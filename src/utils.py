"""Shared utility functions for the prescription refill risk pipeline."""

from pathlib import Path

import pandas as pd

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_RAW = PROJECT_ROOT / "data" / "raw"
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
OUTPUTS = PROJECT_ROOT / "outputs"

# Ensure processed data and output dirs exist
DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
OUTPUTS.mkdir(parents=True, exist_ok=True)

# Chronic condition columns in beneficiary files
CHRONIC_COLS = [
    "SP_ALZHDMTA", "SP_CHF", "SP_CHRNKIDN", "SP_CNCR", "SP_COPD",
    "SP_DEPRESSN", "SP_DIABETES", "SP_ISCHMCHT", "SP_OSTEOPRS",
    "SP_RA_OA", "SP_STRKETIA",
]

# Friendly names for chronic conditions
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


def parse_cms_date(series: pd.Series) -> pd.Series:
    """Parse YYYYMMDD integer dates to datetime. Handles NaN/0 gracefully."""
    return pd.to_datetime(series, format="%Y%m%d", errors="coerce")
