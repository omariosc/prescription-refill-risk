"""Feature engineering from claims data (inpatient, outpatient, carrier)."""

import pandas as pd
import numpy as np


def _count_events_before(
    fill_dates: pd.DataFrame,
    events: pd.DataFrame,
    event_date_col: str,
    windows: list[int] = [30, 90, 365],
    prefix: str = "n_events",
) -> pd.DataFrame:
    """For each fill, count events in the N days before SRVC_DT.

    This is a merge-then-filter approach: merge fills with events on patient,
    then filter by date window. Efficient for moderate-sized event tables.

    Args:
        fill_dates: DataFrame with DESYNPUF_ID, SRVC_DT, and index
        events: DataFrame with DESYNPUF_ID and event_date_col
        event_date_col: column name for the event date
        windows: list of day windows to count within
        prefix: column name prefix for output

    Returns:
        DataFrame indexed like fill_dates with count columns
    """
    # Merge all events for each patient
    merged = fill_dates[["DESYNPUF_ID", "SRVC_DT"]].merge(
        events[["DESYNPUF_ID", event_date_col]],
        on="DESYNPUF_ID",
        how="left",
    )

    # Days between fill and event (positive = event was before fill)
    merged["days_before"] = (merged["SRVC_DT"] - merged[event_date_col]).dt.days

    # Only keep events strictly before the fill
    merged = merged[merged["days_before"] > 0]

    # Count per window
    result = pd.DataFrame(index=fill_dates.index)
    for w in windows:
        in_window = merged[merged["days_before"] <= w]
        counts = in_window.groupby(in_window.index).size()
        result[f"{prefix}_{w}d"] = counts.reindex(fill_dates.index).fillna(0).astype(int)

    # Days since last event
    if len(merged) > 0:
        last_event = merged.groupby(merged.index)["days_before"].min()
        result[f"days_since_last_{prefix}"] = last_event.reindex(fill_dates.index)
    else:
        result[f"days_since_last_{prefix}"] = np.nan

    return result


def compute_inpatient_features(
    labelled_df: pd.DataFrame,
    inpatient_df: pd.DataFrame,
) -> pd.DataFrame:
    """Compute inpatient features for each labelled fill.

    Features:
    - n_hospitalisations_{30,90,365}d: admission count in window before fill
    - days_since_last_hospitalisation: recency
    - total_hospital_days_365d: sum of utilisation days in past year
    - any_hospitalisation_30d: binary flag
    """
    print("Computing inpatient features...")
    fill_dates = labelled_df[["DESYNPUF_ID", "SRVC_DT"]].copy()

    # Count admissions in windows
    result = _count_events_before(
        fill_dates, inpatient_df, "CLM_ADMSN_DT",
        windows=[30, 90, 365], prefix="n_hospitalisations",
    )

    # Binary flag
    result["any_hospitalisation_30d"] = (result["n_hospitalisations_30d"] > 0).astype(int)

    # Total hospital days in past year
    merged = fill_dates[["DESYNPUF_ID", "SRVC_DT"]].merge(
        inpatient_df[["DESYNPUF_ID", "CLM_ADMSN_DT", "CLM_UTLZTN_DAY_CNT"]],
        on="DESYNPUF_ID",
        how="left",
    )
    merged["days_before"] = (merged["SRVC_DT"] - merged["CLM_ADMSN_DT"]).dt.days
    in_year = merged[(merged["days_before"] > 0) & (merged["days_before"] <= 365)]
    total_days = in_year.groupby(in_year.index)["CLM_UTLZTN_DAY_CNT"].sum()
    result["total_hospital_days_365d"] = total_days.reindex(fill_dates.index).fillna(0).astype(int)

    print(f"  Inpatient features: {len(result.columns)} features")
    return result


def compute_outpatient_features(
    labelled_df: pd.DataFrame,
    outpatient_df: pd.DataFrame,
) -> pd.DataFrame:
    """Compute outpatient features for each labelled fill.

    Features:
    - n_outpatient_visits_{30,90,365}d
    - days_since_last_outpatient
    - has_v58_code: patient has V58 (long-term drug use) diagnosis before fill
    """
    print("Computing outpatient features...")
    fill_dates = labelled_df[["DESYNPUF_ID", "SRVC_DT"]].copy()

    # Count visits in windows
    result = _count_events_before(
        fill_dates, outpatient_df, "CLM_FROM_DT",
        windows=[30, 90, 365], prefix="n_outpatient",
    )

    # V58 flag: did this patient ever have a V58 code before this fill?
    v58_events = outpatient_df[outpatient_df["has_v58"] == 1][["DESYNPUF_ID", "CLM_FROM_DT"]]
    merged = fill_dates[["DESYNPUF_ID", "SRVC_DT"]].merge(
        v58_events, on="DESYNPUF_ID", how="left",
    )
    merged["before_fill"] = merged["CLM_FROM_DT"] < merged["SRVC_DT"]
    has_v58 = merged[merged["before_fill"]].groupby(merged[merged["before_fill"]].index).size()
    result["has_v58_code"] = (has_v58.reindex(fill_dates.index).fillna(0) > 0).astype(int)

    print(f"  Outpatient features: {len(result.columns)} features")
    return result


def compute_carrier_features(
    labelled_df: pd.DataFrame,
    carrier_monthly: pd.DataFrame,
) -> pd.DataFrame:
    """Compute carrier features from pre-aggregated monthly data.

    Uses the patient-month aggregated carrier data for efficiency.

    Features:
    - n_physician_visits_{90,365}d (approximated from monthly counts)
    - n_unique_diagnoses_365d
    - total_carrier_spend_365d
    - has_office_visit_90d
    """
    print("Computing carrier features...")
    fill_dates = labelled_df[["DESYNPUF_ID", "SRVC_DT"]].copy()
    fill_dates["fill_period"] = fill_dates["SRVC_DT"].dt.to_period("M")

    # Convert carrier year_month to comparable period
    carrier = carrier_monthly.copy()

    result = pd.DataFrame(index=fill_dates.index)

    # For each fill, sum carrier monthly data from relevant months before the fill
    # This is done patient-by-patient for the 365d and 90d windows using month arithmetic

    # Pre-compute: for each fill, which months are in the 365d and 90d windows
    fill_dates["month_365d_start"] = (fill_dates["SRVC_DT"] - pd.DateOffset(days=365)).dt.to_period("M")
    fill_dates["month_90d_start"] = (fill_dates["SRVC_DT"] - pd.DateOffset(days=90)).dt.to_period("M")

    # Merge fills with carrier data
    merged = fill_dates.merge(carrier, on="DESYNPUF_ID", how="left")

    # Filter: carrier month must be before fill month
    merged = merged[merged["year_month"] < merged["fill_period"]]

    # 365-day window
    in_365d = merged[merged["year_month"] >= merged["month_365d_start"]]
    agg_365 = in_365d.groupby(in_365d.index).agg(
        n_physician_visits_365d=("n_claims", "sum"),
        n_unique_diagnoses_365d=("n_unique_diag", "sum"),
        total_carrier_spend_365d=("total_payment", "sum"),
    )
    for col in agg_365.columns:
        result[col] = agg_365[col].reindex(fill_dates.index).fillna(0)

    # 90-day window
    in_90d = merged[merged["year_month"] >= merged["month_90d_start"]]
    agg_90 = in_90d.groupby(in_90d.index).agg(
        n_physician_visits_90d=("n_claims", "sum"),
        has_office_visit_90d=("has_office_visit", "max"),
    )
    for col in agg_90.columns:
        result[col] = agg_90[col].reindex(fill_dates.index).fillna(0)

    result = result.astype({
        "n_physician_visits_365d": int,
        "n_physician_visits_90d": int,
        "has_office_visit_90d": int,
    })

    print(f"  Carrier features: {len(result.columns)} features")
    return result
