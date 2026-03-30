"""Merge all feature groups into model-ready datasets."""

import pandas as pd


def merge_features(
    pde_features: pd.DataFrame,
    bene_features: pd.DataFrame | None = None,
    inpatient_features: pd.DataFrame | None = None,
    outpatient_features: pd.DataFrame | None = None,
    carrier_features: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Concatenate all feature DataFrames column-wise.

    All inputs must be index-aligned with pde_features.
    None inputs are skipped (allows incremental build).

    Returns a single DataFrame with all features + label.
    """
    print("Merging features...")
    df = pde_features.copy()

    for name, feat_df in [
        ("bene", bene_features),
        ("inpatient", inpatient_features),
        ("outpatient", outpatient_features),
        ("carrier", carrier_features),
    ]:
        if feat_df is not None:
            df = pd.concat([df, feat_df], axis=1)
            print(f"  + {name}: {len(feat_df.columns)} columns")

    # Drop non-feature columns for the feature matrix
    id_cols = ["DESYNPUF_ID", "NDC5", "SRVC_DT", "PDE_ID",
               "expected_runout", "next_fill_date", "gap_days", "excess_gap"]
    feature_cols = [c for c in df.columns if c not in id_cols + ["late"]]

    print(f"  Total features: {len(feature_cols)}")
    print(f"  Total rows: {len(df):,}")
    return df, feature_cols
