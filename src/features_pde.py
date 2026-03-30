"""Feature engineering from PDE data only (prescription fill history)."""

import pandas as pd
import numpy as np


def compute_pde_features(labelled_df: pd.DataFrame) -> pd.DataFrame:
    """Compute per-fill features from PDE prescription history.

    All features use only data strictly BEFORE each fill's SRVC_DT.

    Feature groups:
    - Same-drug (NDC5) refill history: gap stats, late history, cadence
    - Cross-drug patient-level: polypharmacy, fill frequency, costs
    """
    print("Computing PDE features...")
    df = labelled_df.sort_values(["DESYNPUF_ID", "NDC5", "SRVC_DT"]).copy()

    # --- Same-drug features (within patient-NDC5 group) ---
    grp = df.groupby(["DESYNPUF_ID", "NDC5"])

    # Fill order within group (0-indexed)
    df["fill_order"] = grp.cumcount()

    # Number of prior fills for this drug
    df["n_prior_fills_same_drug"] = df["fill_order"]

    # Prior gap stats (expanding window)
    # gap_days is the gap TO THE NEXT fill, so the "prior gap" for fill i
    # is the gap_days of fill i-1
    df["prev_gap"] = grp["gap_days"].shift(1)
    df["prev_excess_gap"] = grp["excess_gap"].shift(1)
    df["prev_late"] = grp["late"].shift(1)

    # Expanding stats on prior gaps
    df["mean_gap_same_drug"] = grp["prev_gap"].transform(
        lambda s: s.expanding().mean().shift(0)
    )
    df["std_gap_same_drug"] = grp["prev_gap"].transform(
        lambda s: s.expanding().std().shift(0)
    )
    df["last_gap_same_drug"] = df["prev_gap"]
    df["was_last_late"] = df["prev_late"]

    # Late history (expanding count/pct of prior late fills)
    df["cumulative_late"] = grp["prev_late"].transform(
        lambda s: s.expanding().sum().shift(0)
    )
    df["n_late_history"] = df["cumulative_late"]
    df["pct_late_history"] = np.where(
        df["n_prior_fills_same_drug"] > 0,
        df["n_late_history"] / df["n_prior_fills_same_drug"],
        np.nan,
    )

    # Days supply stats for this drug
    df["mean_days_supply_same_drug"] = grp["DAYS_SUPLY_NUM"].transform(
        lambda s: s.expanding().mean().shift(1)
    )
    df["current_days_supply"] = df["DAYS_SUPLY_NUM"]

    # Early refill detection (gap < days_supply implies stockpiling)
    df["was_early_refill"] = (df["prev_gap"] < grp["DAYS_SUPLY_NUM"].shift(1)).astype(float)
    df["early_refill_count"] = grp["was_early_refill"].transform(
        lambda s: s.expanding().sum().shift(0)
    )

    # --- Cross-drug features (patient-level) ---
    # These are more expensive — compute per-patient expanding stats

    # Sort by patient and date for cross-drug features
    df = df.sort_values(["DESYNPUF_ID", "SRVC_DT"]).copy()
    pat_grp = df.groupby("DESYNPUF_ID")

    # Fill order across all drugs for this patient
    df["patient_fill_order"] = pat_grp.cumcount()
    df["n_total_fills_all_drugs"] = df["patient_fill_order"]

    # Polypharmacy: count unique NDC5s seen so far
    df["n_unique_drugs"] = pat_grp["NDC5"].transform(
        lambda s: s.expanding().apply(lambda x: x.nunique(), raw=False)
    )
    # Shift to only count drugs BEFORE current fill
    df["n_unique_drugs"] = pat_grp["n_unique_drugs"].shift(1).fillna(0)

    # Cost features (expanding mean of prior fills)
    df["mean_cost"] = pat_grp["TOT_RX_CST_AMT"].transform(
        lambda s: s.expanding().mean().shift(1)
    )
    df["mean_patient_pay"] = pat_grp["PTNT_PAY_AMT"].transform(
        lambda s: s.expanding().mean().shift(1)
    )

    # Days since last fill (any drug)
    df["days_since_last_any_fill"] = pat_grp["SRVC_DT"].diff().dt.days

    # Re-sort back to canonical order
    df = df.sort_values(["DESYNPUF_ID", "NDC5", "SRVC_DT"]).copy()

    # Select feature columns
    feature_cols = [
        # Same-drug features
        "n_prior_fills_same_drug",
        "mean_gap_same_drug",
        "std_gap_same_drug",
        "last_gap_same_drug",
        "was_last_late",
        "n_late_history",
        "pct_late_history",
        "mean_days_supply_same_drug",
        "current_days_supply",
        "early_refill_count",
        # Cross-drug features
        "n_total_fills_all_drugs",
        "n_unique_drugs",
        "mean_cost",
        "mean_patient_pay",
        "days_since_last_any_fill",
    ]

    # Keep identifying columns + features + label
    keep_cols = [
        "DESYNPUF_ID", "NDC5", "SRVC_DT", "PDE_ID",
        "expected_runout", "next_fill_date", "gap_days", "excess_gap", "late",
    ] + feature_cols

    result = df[keep_cols].copy()
    print(f"  PDE features: {len(feature_cols)} features for {len(result):,} fills")
    return result
