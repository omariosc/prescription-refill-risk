"""Feature engineering from beneficiary summary data."""

import pandas as pd

from src.utils import CHRONIC_NAMES


def compute_bene_features(
    labelled_df: pd.DataFrame,
    bene_df: pd.DataFrame,
    ever_had_df: pd.DataFrame,
) -> pd.DataFrame:
    """Join beneficiary features to labelled fills, matched by year.

    Features:
    - Demographics: age, sex, race, ESRD
    - Chronic conditions (year-matched): 11 individual flags + count
    - "Ever had" chronic conditions (across all years up to fill)
    - Coverage: Part D months, HMO months
    - Annual reimbursement totals (IP, OP, carrier)
    """
    print("Computing beneficiary features...")
    df = labelled_df[["DESYNPUF_ID", "SRVC_DT"]].copy()
    df["fill_year"] = df["SRVC_DT"].dt.year

    # Year-matched join: join each fill to the beneficiary summary for that year
    chronic_friendly = list(CHRONIC_NAMES.values())
    bene_cols = (
        ["DESYNPUF_ID", "bene_year", "age",
         "BENE_SEX_IDENT_CD", "BENE_RACE_CD", "BENE_ESRD_IND",
         "PLAN_CVRG_MOS_NUM", "BENE_HMO_CVRAGE_TOT_MONS",
         "MEDREIMB_IP", "MEDREIMB_OP", "MEDREIMB_CAR",
         "BENRES_IP", "BENRES_OP", "BENRES_CAR"]
        + chronic_friendly
    )
    bene_subset = bene_df[bene_cols].copy()

    # Merge on patient + year
    merged = df.merge(
        bene_subset,
        left_on=["DESYNPUF_ID", "fill_year"],
        right_on=["DESYNPUF_ID", "bene_year"],
        how="left",
    )

    # Rename for clarity
    merged = merged.rename(columns={
        "BENE_SEX_IDENT_CD": "sex",
        "BENE_RACE_CD": "race",
        "BENE_ESRD_IND": "esrd",
        "PLAN_CVRG_MOS_NUM": "plan_coverage_months",
        "BENE_HMO_CVRAGE_TOT_MONS": "hmo_months",
        "MEDREIMB_IP": "annual_ip_reimbursement",
        "MEDREIMB_OP": "annual_op_reimbursement",
        "MEDREIMB_CAR": "annual_carrier_reimbursement",
        "BENRES_IP": "annual_ip_beneficiary_cost",
        "BENRES_OP": "annual_op_beneficiary_cost",
        "BENRES_CAR": "annual_carrier_beneficiary_cost",
    })

    # Remap sex: 1=male → 0, 2=female → 1
    merged["sex"] = (merged["sex"] == 2).astype(int)

    # N chronic conditions (year-matched)
    merged["n_chronic_conditions"] = merged[chronic_friendly].sum(axis=1)

    # Add "ever had" chronic conditions (cumulative across all years)
    ever_cols = [f"ever_{c}" for c in chronic_friendly]
    ever_renamed = ever_had_df.rename(
        columns={c: f"ever_{c}" for c in chronic_friendly}
    )
    merged = merged.merge(
        ever_renamed[["DESYNPUF_ID"] + ever_cols + ["n_chronic_conditions"]].rename(
            columns={"n_chronic_conditions": "n_chronic_ever"}
        ),
        on="DESYNPUF_ID",
        how="left",
    )

    # Feature columns
    feature_cols = [
        "age", "sex", "race", "esrd",
        "plan_coverage_months", "hmo_months",
        "annual_ip_reimbursement", "annual_op_reimbursement",
        "annual_carrier_reimbursement",
        "annual_ip_beneficiary_cost", "annual_op_beneficiary_cost",
        "annual_carrier_beneficiary_cost",
        "n_chronic_conditions", "n_chronic_ever",
    ] + chronic_friendly + ever_cols

    # Keep only feature columns (index-aligned with labelled_df)
    result = merged[feature_cols].copy()
    result.index = labelled_df.index

    print(f"  Beneficiary features: {len(feature_cols)} features")
    print(f"  Missing (no bene match): {result['age'].isna().sum():,} fills")
    return result
