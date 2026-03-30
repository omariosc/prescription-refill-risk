#!/usr/bin/env python3
"""Run predictions on ALL patients and compute population analytics.

Outputs:
  data/population/        — full per-fill predictions (gitignored)
  outputs/population/     — aggregate statistics JSON for backend/dashboard
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import pandas as pd

from src.data_loading import (
    build_ever_had_chronic,
    get_death_dates,
    load_beneficiary,
    load_carrier_aggregated,
    load_inpatient,
    load_outpatient,
    load_pde,
)
from src.features_bene import compute_bene_features
from src.features_claims import (
    compute_carrier_features,
    compute_inpatient_features,
    compute_outpatient_features,
)
from src.features_pde import compute_pde_features
from src.labels import build_refill_labels, temporal_split
from src.merge import merge_features
from src.model import train_model
from src.utils import DATA_PROCESSED, GRACE_DAYS, OUTPUTS, TIER_HIGH, TIER_LOW, TRAIN_END, VAL_END  # single source of truth

POP_DATA = Path(__file__).resolve().parent.parent / "data" / "population"
POP_OUT = OUTPUTS / "population"
POP_DATA.mkdir(parents=True, exist_ok=True)
POP_OUT.mkdir(parents=True, exist_ok=True)


def main() -> None:
    t0 = time.time()

    # ── Load & prepare (same as main pipeline) ──────────────────────
    print("=" * 60)
    print("POPULATION ANALYTICS: Loading data")
    print("=" * 60)

    pde = load_pde()
    bene = load_beneficiary()
    deaths = get_death_dates(bene)
    ever_had = build_ever_had_chronic(bene)
    inpatient = load_inpatient()
    outpatient = load_outpatient()
    carrier = load_carrier_aggregated()

    labelled = build_refill_labels(pde, deaths, grace_days=GRACE_DAYS)
    train, val, test = temporal_split(labelled)

    print("\n" + "=" * 60)
    print("POPULATION ANALYTICS: Feature engineering")
    print("=" * 60)

    pde_features = compute_pde_features(labelled)
    bene_features = compute_bene_features(labelled, bene, ever_had)
    ip_features = compute_inpatient_features(labelled, inpatient)
    op_features = compute_outpatient_features(labelled, outpatient)
    carrier_features = compute_carrier_features(labelled, carrier)
    merged_df, feature_cols = merge_features(
        pde_features, bene_features, ip_features, op_features, carrier_features,
    )

    # ── Train model on train set, validate on val ───────────────────
    print("\n" + "=" * 60)
    print("POPULATION ANALYTICS: Training model")
    print("=" * 60)

    train_m = merged_df[merged_df["SRVC_DT"] <= TRAIN_END]
    val_m = merged_df[(merged_df["SRVC_DT"] > TRAIN_END) & (merged_df["SRVC_DT"] <= VAL_END)]
    model = train_model(train_m, val_m, feature_cols)

    # ── Predict on ALL fills ────────────────────────────────────────
    print("\n" + "=" * 60)
    print("POPULATION ANALYTICS: Scoring all 1.47M fills")
    print("=" * 60)

    all_scores = model.predict(merged_df[feature_cols])
    merged_df["risk_score"] = all_scores
    merged_df["risk_tier"] = pd.cut(
        all_scores,
        bins=[-np.inf, TIER_LOW, TIER_HIGH, np.inf],
        labels=["LOW", "MODERATE", "HIGH"],
    )

    # ── Enrich with demographics ────────────────────────────────────
    # Year-matched bene join is already in bene_features; extract key cols
    merged_df["fill_year"] = merged_df["SRVC_DT"].dt.year
    merged_df["fill_month"] = merged_df["SRVC_DT"].dt.month
    merged_df["fill_quarter"] = merged_df["SRVC_DT"].dt.quarter
    merged_df["fill_yearmonth"] = merged_df["SRVC_DT"].dt.to_period("M").astype(str)

    # Add bene demographics directly (already computed as features)
    for col in ["age", "sex", "race", "n_chronic_conditions"]:
        if col in bene_features.columns:
            merged_df[col] = bene_features[col].values

    # Add split label
    merged_df["split"] = "train"
    merged_df.loc[merged_df["SRVC_DT"] > TRAIN_END, "split"] = "val"
    merged_df.loc[merged_df["SRVC_DT"] > VAL_END,   "split"] = "test"

    # ── Load NDC drug name cache ────────────────────────────────────
    ndc_cache_path = DATA_PROCESSED / "ndc_cache.json"
    ndc_map = {}
    if ndc_cache_path.exists():
        with open(ndc_cache_path) as f:
            cache = json.load(f)
        for ndc5, info in cache.get("ndc5", {}).items():
            name = info.get("name")
            if name:
                # Extract brand name from brackets if available
                if "[" in name and "]" in name:
                    name = name[name.index("[") + 1:name.index("]")]
                else:
                    name = name[:40]
            ndc_map[ndc5] = {
                "drug_name": name or f"NDC5-{ndc5}",
                "drug_class": info.get("drug_class") or "Unknown",
            }
    merged_df["drug_name"] = merged_df["NDC5"].map(lambda x: ndc_map.get(x, {}).get("drug_name", f"NDC5-{x}"))
    merged_df["drug_class"] = merged_df["NDC5"].map(lambda x: ndc_map.get(x, {}).get("drug_class", "Unknown"))

    # Map race codes
    race_map = {0: "Unknown", 1: "White", 2: "Black", 3: "Other", 5: "Hispanic"}
    merged_df["race_label"] = merged_df["race"].map(race_map).fillna("Unknown")

    # Map sex
    merged_df["sex_label"] = merged_df["sex"].map({0: "Male", 1: "Female"}).fillna("Unknown")

    # Age brackets
    merged_df["age_group"] = pd.cut(
        merged_df["age"],
        bins=[0, 54, 64, 74, 84, 120],
        labels=["<55", "55-64", "65-74", "75-84", "85+"],
    )

    # State code (from bene)
    bene_state = bene[bene["bene_year"] == 2009][["DESYNPUF_ID", "SP_STATE_CODE"]].drop_duplicates("DESYNPUF_ID")
    merged_df = merged_df.merge(bene_state, on="DESYNPUF_ID", how="left")
    merged_df.rename(columns={"SP_STATE_CODE": "state_code"}, inplace=True)

    n_total = len(merged_df)
    n_patients = merged_df["DESYNPUF_ID"].nunique()
    print(f"\n  Total scored fills: {n_total:,}")
    print(f"  Unique patients: {n_patients:,}")
    print(f"  Risk tiers: {merged_df['risk_tier'].value_counts().to_dict()}")

    # ── Save full per-fill results (gitignored) ─────────────────────
    print("\n" + "=" * 60)
    print("POPULATION ANALYTICS: Saving per-fill results")
    print("=" * 60)

    save_cols = [
        "DESYNPUF_ID", "NDC5", "drug_name", "drug_class",
        "SRVC_DT", "fill_year", "fill_month", "fill_quarter", "fill_yearmonth",
        "DAYS_SUPLY_NUM", "gap_days", "excess_gap", "late",
        "risk_score", "risk_tier", "split",
        "age", "age_group", "sex_label", "race_label", "state_code",
        "n_chronic_conditions",
    ]
    # Only keep columns that exist
    save_cols = [c for c in save_cols if c in merged_df.columns]
    pop_df = merged_df[save_cols].copy()
    pop_df["SRVC_DT"] = pop_df["SRVC_DT"].dt.strftime("%Y-%m-%d")

    pop_path = POP_DATA / "all_predictions.parquet"
    pop_df.to_parquet(pop_path, index=False)
    print(f"  Saved {len(pop_df):,} rows to {pop_path}")

    # ── Compute aggregate statistics ────────────────────────────────
    print("\n" + "=" * 60)
    print("POPULATION ANALYTICS: Computing aggregates")
    print("=" * 60)

    stats = {}

    # Overall summary
    stats["overview"] = {
        "total_fills": int(n_total),
        "total_patients": int(n_patients),
        "total_unique_drugs": int(merged_df["NDC5"].nunique()),
        "pct_late": round(float(merged_df["late"].mean() * 100), 1),
        "mean_risk_score": round(float(merged_df["risk_score"].mean()), 3),
        "median_risk_score": round(float(merged_df["risk_score"].median()), 3),
        "tier_counts": {k: int(v) for k, v in merged_df["risk_tier"].value_counts().items()},
        "tier_pct": {k: round(float(v / n_total * 100), 1) for k, v in merged_df["risk_tier"].value_counts().items()},
        "tier_actual_late": {
            tier: round(float(merged_df[merged_df["risk_tier"] == tier]["late"].mean() * 100), 1)
            for tier in ["LOW", "MODERATE", "HIGH"]
        },
    }

    # By time (year-month)
    time_agg = (
        merged_df.groupby("fill_yearmonth")
        .agg(
            n_fills=("late", "count"),
            pct_late=("late", "mean"),
            mean_risk=("risk_score", "mean"),
            n_high=("risk_tier", lambda x: (x == "HIGH").sum()),
            n_mod=("risk_tier", lambda x: (x == "MODERATE").sum()),
            n_low=("risk_tier", lambda x: (x == "LOW").sum()),
        )
        .reset_index()
    )
    time_agg["pct_late"] = (time_agg["pct_late"] * 100).round(1)
    time_agg["mean_risk"] = time_agg["mean_risk"].round(3)
    stats["by_time"] = time_agg.to_dict(orient="records")

    # By drug class
    drug_class_agg = (
        merged_df.groupby("drug_class")
        .agg(
            n_fills=("late", "count"),
            n_patients=("DESYNPUF_ID", "nunique"),
            pct_late=("late", "mean"),
            mean_risk=("risk_score", "mean"),
            pct_high=("risk_tier", lambda x: (x == "HIGH").mean()),
        )
        .reset_index()
        .sort_values("n_fills", ascending=False)
    )
    drug_class_agg["pct_late"] = (drug_class_agg["pct_late"] * 100).round(1)
    drug_class_agg["mean_risk"] = drug_class_agg["mean_risk"].round(3)
    drug_class_agg["pct_high"] = (drug_class_agg["pct_high"] * 100).round(1)
    stats["by_drug_class"] = drug_class_agg.head(20).to_dict(orient="records")

    # By top individual drugs (named)
    named_drugs = merged_df[~merged_df["drug_name"].str.startswith("NDC5-")]
    if len(named_drugs) > 0:
        drug_agg = (
            named_drugs.groupby(["NDC5", "drug_name"])
            .agg(
                n_fills=("late", "count"),
                n_patients=("DESYNPUF_ID", "nunique"),
                pct_late=("late", "mean"),
                mean_risk=("risk_score", "mean"),
            )
            .reset_index()
            .sort_values("n_fills", ascending=False)
        )
        drug_agg["pct_late"] = (drug_agg["pct_late"] * 100).round(1)
        drug_agg["mean_risk"] = drug_agg["mean_risk"].round(3)
        stats["by_drug"] = drug_agg.head(30).to_dict(orient="records")

    # By age group
    age_agg = (
        merged_df.groupby("age_group", observed=True)
        .agg(
            n_fills=("late", "count"),
            n_patients=("DESYNPUF_ID", "nunique"),
            pct_late=("late", "mean"),
            mean_risk=("risk_score", "mean"),
            pct_high=("risk_tier", lambda x: (x == "HIGH").mean()),
        )
        .reset_index()
    )
    age_agg["age_group"] = age_agg["age_group"].astype(str)
    age_agg["pct_late"] = (age_agg["pct_late"] * 100).round(1)
    age_agg["mean_risk"] = age_agg["mean_risk"].round(3)
    age_agg["pct_high"] = (age_agg["pct_high"] * 100).round(1)
    stats["by_age"] = age_agg.to_dict(orient="records")

    # By sex
    sex_agg = (
        merged_df.groupby("sex_label")
        .agg(
            n_fills=("late", "count"),
            n_patients=("DESYNPUF_ID", "nunique"),
            pct_late=("late", "mean"),
            mean_risk=("risk_score", "mean"),
            pct_high=("risk_tier", lambda x: (x == "HIGH").mean()),
        )
        .reset_index()
    )
    sex_agg["pct_late"] = (sex_agg["pct_late"] * 100).round(1)
    sex_agg["mean_risk"] = sex_agg["mean_risk"].round(3)
    sex_agg["pct_high"] = (sex_agg["pct_high"] * 100).round(1)
    stats["by_sex"] = sex_agg.to_dict(orient="records")

    # By race
    race_agg = (
        merged_df.groupby("race_label")
        .agg(
            n_fills=("late", "count"),
            n_patients=("DESYNPUF_ID", "nunique"),
            pct_late=("late", "mean"),
            mean_risk=("risk_score", "mean"),
            pct_high=("risk_tier", lambda x: (x == "HIGH").mean()),
        )
        .reset_index()
    )
    race_agg["pct_late"] = (race_agg["pct_late"] * 100).round(1)
    race_agg["mean_risk"] = race_agg["mean_risk"].round(3)
    race_agg["pct_high"] = (race_agg["pct_high"] * 100).round(1)
    stats["by_race"] = race_agg.to_dict(orient="records")

    # By chronic condition count
    chronic_agg = (
        merged_df.groupby("n_chronic_conditions")
        .agg(
            n_fills=("late", "count"),
            n_patients=("DESYNPUF_ID", "nunique"),
            pct_late=("late", "mean"),
            mean_risk=("risk_score", "mean"),
            pct_high=("risk_tier", lambda x: (x == "HIGH").mean()),
        )
        .reset_index()
    )
    chronic_agg["n_chronic_conditions"] = chronic_agg["n_chronic_conditions"].astype(int)
    chronic_agg["pct_late"] = (chronic_agg["pct_late"] * 100).round(1)
    chronic_agg["mean_risk"] = chronic_agg["mean_risk"].round(3)
    chronic_agg["pct_high"] = (chronic_agg["pct_high"] * 100).round(1)
    stats["by_chronic_count"] = chronic_agg.to_dict(orient="records")

    # By state (top 20)
    state_agg = (
        merged_df.groupby("state_code")
        .agg(
            n_fills=("late", "count"),
            n_patients=("DESYNPUF_ID", "nunique"),
            pct_late=("late", "mean"),
            mean_risk=("risk_score", "mean"),
            pct_high=("risk_tier", lambda x: (x == "HIGH").mean()),
        )
        .reset_index()
        .sort_values("n_fills", ascending=False)
    )
    state_agg["state_code"] = state_agg["state_code"].astype(int)
    state_agg["pct_late"] = (state_agg["pct_late"] * 100).round(1)
    state_agg["mean_risk"] = state_agg["mean_risk"].round(3)
    state_agg["pct_high"] = (state_agg["pct_high"] * 100).round(1)
    stats["by_state"] = state_agg.head(30).to_dict(orient="records")

    # By quarter (seasonal)
    quarter_agg = (
        merged_df.groupby(["fill_year", "fill_quarter"])
        .agg(
            n_fills=("late", "count"),
            pct_late=("late", "mean"),
            mean_risk=("risk_score", "mean"),
            pct_high=("risk_tier", lambda x: (x == "HIGH").mean()),
        )
        .reset_index()
    )
    quarter_agg["label"] = quarter_agg["fill_year"].astype(str) + " Q" + quarter_agg["fill_quarter"].astype(str)
    quarter_agg["pct_late"] = (quarter_agg["pct_late"] * 100).round(1)
    quarter_agg["mean_risk"] = quarter_agg["mean_risk"].round(3)
    quarter_agg["pct_high"] = (quarter_agg["pct_high"] * 100).round(1)
    stats["by_quarter"] = quarter_agg[["label", "n_fills", "pct_late", "mean_risk", "pct_high"]].to_dict(orient="records")

    # Patient-level risk summary (for drift detection)
    patient_agg = (
        merged_df.groupby("DESYNPUF_ID")
        .agg(
            n_fills=("late", "count"),
            pct_late=("late", "mean"),
            mean_risk=("risk_score", "mean"),
            max_risk=("risk_score", "max"),
            n_drugs=("NDC5", "nunique"),
            last_tier=("risk_tier", "last"),
        )
        .reset_index()
    )
    # Patient risk distribution
    patient_risk_hist = np.histogram(patient_agg["mean_risk"], bins=20, range=(0, 1))
    stats["patient_risk_distribution"] = {
        "bin_edges": [round(float(x), 2) for x in patient_risk_hist[1]],
        "counts": [int(x) for x in patient_risk_hist[0]],
    }

    # High-risk patient summary
    high_risk_patients = patient_agg[patient_agg["last_tier"] == "HIGH"]
    stats["high_risk_patients"] = {
        "count": int(len(high_risk_patients)),
        "pct_of_total": round(float(len(high_risk_patients) / len(patient_agg) * 100), 1),
        "mean_fills": round(float(high_risk_patients["n_fills"].mean()), 1),
        "mean_drugs": round(float(high_risk_patients["n_drugs"].mean()), 1),
        "mean_late_pct": round(float(high_risk_patients["pct_late"].mean() * 100), 1),
    }

    # Score distribution histogram (for all fills)
    score_hist = np.histogram(merged_df["risk_score"], bins=50, range=(0, 1))
    stats["score_distribution"] = {
        "bin_edges": [round(float(x), 3) for x in score_hist[1]],
        "counts": [int(x) for x in score_hist[0]],
    }

    # ── Save aggregate stats ────────────────────────────────────────
    stats_path = POP_OUT / "population_stats.json"
    with open(stats_path, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"\n  Aggregate stats saved to {stats_path}")

    # Also save a compact version for the backend database
    db_stats = {
        "overview": stats["overview"],
        "by_time": stats["by_time"],
        "by_drug_class": stats["by_drug_class"],
        "by_drug": stats.get("by_drug", []),
        "by_age": stats["by_age"],
        "by_sex": stats["by_sex"],
        "by_race": stats["by_race"],
        "by_chronic_count": stats["by_chronic_count"],
        "by_state": stats["by_state"],
        "by_quarter": stats["by_quarter"],
        "high_risk_patients": stats["high_risk_patients"],
        "score_distribution": stats["score_distribution"],
        "patient_risk_distribution": stats["patient_risk_distribution"],
    }
    db_path = POP_OUT / "dashboard_data.json"
    with open(db_path, "w") as f:
        json.dump(db_stats, f)
    db_size_kb = db_path.stat().st_size / 1024
    print(f"  Dashboard data saved to {db_path} ({db_size_kb:.0f} KB)")

    # ── Summary ─────────────────────────────────────────────────────
    elapsed = time.time() - t0
    print(f"\n{'=' * 60}")
    print(f"POPULATION ANALYTICS COMPLETE in {elapsed/60:.1f} minutes")
    print(f"{'=' * 60}")
    print(f"  Per-fill results: {pop_path}")
    print(f"  Aggregate stats:  {stats_path}")
    print(f"  Dashboard data:   {db_path} ({db_size_kb:.0f} KB)")
    print(f"\nKey findings:")
    print(f"  Overall late rate: {stats['overview']['pct_late']}%")
    print(f"  Tier split: {stats['overview']['tier_pct']}")
    print(f"  Actual late rates by tier: {stats['overview']['tier_actual_late']}")
    print(f"  High-risk patients: {stats['high_risk_patients']['count']:,} ({stats['high_risk_patients']['pct_of_total']}%)")


if __name__ == "__main__":
    main()
