"""Construct late-refill labels and temporal train/val/test splits."""

import pandas as pd
import numpy as np


def build_refill_labels(
    pde: pd.DataFrame,
    death_dates: pd.DataFrame,
    grace_days: int = 7,
) -> pd.DataFrame:
    """Construct binary late-refill labels for each (patient, NDC5) fill.

    For each fill, the label indicates whether the NEXT fill of the same
    NDC5 group was late (excess gap > grace_days).

    Exclusions (label = NaN):
    - Last fill per (patient, NDC5) group — no next fill observed
    - Patient died before expected run-out date
    - Only fills from multi-fill (patient, NDC5) groups are kept

    Returns the PDE dataframe with added columns:
    - expected_runout, next_fill_date, gap_days, excess_gap, late
    """
    print("Building refill labels...")
    df = pde.sort_values(["DESYNPUF_ID", "NDC5", "SRVC_DT"]).copy()

    # Keep only multi-fill (patient, NDC5) groups
    group_sizes = df.groupby(["DESYNPUF_ID", "NDC5"])["SRVC_DT"].transform("count")
    df = df[group_sizes >= 2].copy()
    print(f"  Multi-fill groups: {len(df):,} rows from "
          f"{df.groupby(['DESYNPUF_ID', 'NDC5']).ngroups:,} (patient, NDC5) pairs")

    # Compute refill gap within each (patient, NDC5) group
    grp = df.groupby(["DESYNPUF_ID", "NDC5"])
    df["next_fill_date"] = grp["SRVC_DT"].shift(-1)
    df["expected_runout"] = df["SRVC_DT"] + pd.to_timedelta(df["DAYS_SUPLY_NUM"], unit="D")
    df["gap_days"] = (df["next_fill_date"] - df["SRVC_DT"]).dt.days
    df["excess_gap"] = df["gap_days"] - df["DAYS_SUPLY_NUM"]

    # Label: late if excess gap exceeds grace window
    df["late"] = np.where(
        df["next_fill_date"].isna(),  # last fill in group — censored
        np.nan,
        (df["excess_gap"] > grace_days).astype(float),
    )

    # Death censoring: exclude fills where patient died before expected runout
    df = df.merge(death_dates, on="DESYNPUF_ID", how="left")
    died_before_runout = (
        df["BENE_DEATH_DT"].notna()
        & (df["BENE_DEATH_DT"] <= df["expected_runout"])
    )
    df.loc[died_before_runout, "late"] = np.nan
    n_death_censored = died_before_runout.sum()

    # Drop rows with no label (censored or death-excluded)
    n_before = len(df)
    df = df[df["late"].notna()].copy()
    df["late"] = df["late"].astype(int)
    n_after = len(df)

    # Stats
    n_late = (df["late"] == 1).sum()
    n_ontime = (df["late"] == 0).sum()
    pct_late = n_late / len(df) * 100

    print(f"  Labelled fills: {n_after:,} (dropped {n_before - n_after:,} censored/death)")
    print(f"  Death-censored: {n_death_censored:,}")
    print(f"  Late: {n_late:,} ({pct_late:.1f}%) | On-time: {n_ontime:,} ({100-pct_late:.1f}%)")

    # Drop the merged death date column to keep clean
    df = df.drop(columns=["BENE_DEATH_DT"], errors="ignore")

    return df


def temporal_split(
    df: pd.DataFrame,
    train_end: str = "2009-06-30",
    val_end: str = "2009-12-31",
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split labelled fills into train/val/test by SRVC_DT.

    - Train: SRVC_DT <= train_end
    - Val:   train_end < SRVC_DT <= val_end
    - Test:  SRVC_DT > val_end
    """
    train_cutoff = pd.Timestamp(train_end)
    val_cutoff = pd.Timestamp(val_end)

    train = df[df["SRVC_DT"] <= train_cutoff].copy()
    val = df[(df["SRVC_DT"] > train_cutoff) & (df["SRVC_DT"] <= val_cutoff)].copy()
    test = df[df["SRVC_DT"] > val_cutoff].copy()

    for name, split in [("Train", train), ("Val", val), ("Test", test)]:
        n = len(split)
        pct_late = (split["late"] == 1).mean() * 100 if n > 0 else 0
        date_range = f"{split['SRVC_DT'].min().date()} to {split['SRVC_DT'].max().date()}" if n > 0 else "N/A"
        print(f"  {name}: {n:,} fills ({pct_late:.1f}% late) | {date_range}")

    return train, val, test
