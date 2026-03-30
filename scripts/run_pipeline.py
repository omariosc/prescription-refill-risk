#!/usr/bin/env python3
"""End-to-end pipeline: load → clean → label → features → train → evaluate → explain."""

import sys
import time
from pathlib import Path

# Add project root to path
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
from src.explain import (
    compute_shap_values,
    plot_calibration,
    plot_patient_timeline,
    plot_shap_importance,
    plot_shap_summary,
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
from src.model import (
    evaluate_model,
    get_feature_importance,
    save_metrics,
    train_model,
)
from src.utils import OUTPUTS


def main() -> None:
    t0 = time.time()

    # ===================================================================
    # Phase 0: Load and clean data
    # ===================================================================
    print("=" * 60)
    print("PHASE 0: LOADING DATA")
    print("=" * 60)

    pde = load_pde()
    bene = load_beneficiary()
    deaths = get_death_dates(bene)
    ever_had = build_ever_had_chronic(bene)
    inpatient = load_inpatient()
    outpatient = load_outpatient()

    print("\nLoading carrier claims (this may take a few minutes)...")
    carrier_monthly = load_carrier_aggregated()

    # ===================================================================
    # Phase 1: Label construction + temporal split
    # ===================================================================
    print("\n" + "=" * 60)
    print("PHASE 1: LABEL CONSTRUCTION")
    print("=" * 60)

    labelled = build_refill_labels(pde, deaths, grace_days=7)
    print("\nTemporal split:")
    train, val, test = temporal_split(labelled)

    # ===================================================================
    # Phase 2: Feature engineering
    # ===================================================================
    print("\n" + "=" * 60)
    print("PHASE 2: FEATURE ENGINEERING")
    print("=" * 60)

    # PDE features (for all data, then split)
    pde_features = compute_pde_features(labelled)

    # Beneficiary features
    bene_features = compute_bene_features(labelled, bene, ever_had)

    # Claims features (these are the expensive ones)
    print()
    ip_features = compute_inpatient_features(labelled, inpatient)
    print()
    op_features = compute_outpatient_features(labelled, outpatient)
    print()
    carrier_features = compute_carrier_features(labelled, carrier_monthly)

    # ===================================================================
    # Phase 3: Merge features
    # ===================================================================
    print("\n" + "=" * 60)
    print("PHASE 3: MERGE FEATURES")
    print("=" * 60)

    merged_df, feature_cols = merge_features(
        pde_features,
        bene_features=bene_features,
        inpatient_features=ip_features,
        outpatient_features=op_features,
        carrier_features=carrier_features,
    )

    # Apply temporal split to merged data
    train_merged = merged_df[merged_df["SRVC_DT"] <= "2009-06-30"]
    val_merged = merged_df[
        (merged_df["SRVC_DT"] > "2009-06-30") & (merged_df["SRVC_DT"] <= "2009-12-31")
    ]
    test_merged = merged_df[merged_df["SRVC_DT"] > "2009-12-31"]

    print(f"\n  Train: {len(train_merged):,} | Val: {len(val_merged):,} | Test: {len(test_merged):,}")

    # ===================================================================
    # Phase 4: Model training and evaluation
    # ===================================================================
    print("\n" + "=" * 60)
    print("PHASE 4: MODEL TRAINING")
    print("=" * 60)

    model = train_model(train_merged, val_merged, feature_cols)

    print()
    val_metrics = evaluate_model(model, val_merged, feature_cols, "validation")
    print()
    test_metrics = evaluate_model(model, test_merged, feature_cols, "test")

    # Feature importance
    fi = get_feature_importance(model, feature_cols)
    print("\nTop 15 features by gain:")
    print(fi.head(15).to_string(index=False))

    # Save metrics
    save_metrics([val_metrics, test_metrics])

    # ===================================================================
    # Phase 5: Explainability + NDC Enrichment
    # ===================================================================
    print("\n" + "=" * 60)
    print("PHASE 5: EXPLAINABILITY + NDC ENRICHMENT")
    print("=" * 60)

    # NDC-to-drug-name enrichment
    from src.ndc_lookup import build_ndc5_lookup_table, get_drug_name, _load_cache

    ndc_table = build_ndc5_lookup_table(pde, top_n=100, max_tries_per_group=10)
    ndc_cache = _load_cache()

    # Save lookup table
    ndc_table.to_csv(OUTPUTS / "ndc_lookup.csv", index=False)
    print(f"  NDC lookup table saved to outputs/ndc_lookup.csv")

    # Print resolved drugs
    resolved = ndc_table[ndc_table["name"].notna()]
    if len(resolved) > 0:
        print(f"\n  Resolved {len(resolved)} drug groups:")
        for _, row in resolved.head(15).iterrows():
            print(f"    NDC5={row['ndc5']} ({row['n_fills']:,} fills): {row['name']}")

    # SHAP analysis
    print()
    shap_values = compute_shap_values(model, test_merged, feature_cols)
    plot_shap_importance(shap_values)
    plot_shap_summary(shap_values)

    # Calibration
    y_true = test_merged["late"].values
    y_prob = model.predict(test_merged[feature_cols])
    plot_calibration(y_true, y_prob)

    # Patient timeline demo — pick a patient with interesting mix of late/on-time
    # Prefer a patient whose NDC5 group resolved to a real drug name
    test_patient_stats = (
        test_merged.groupby(["DESYNPUF_ID", "NDC5"])
        .agg(n_fills=("late", "count"), n_late=("late", "sum"))
        .reset_index()
    )
    test_patient_stats["n_ontime"] = test_patient_stats["n_fills"] - test_patient_stats["n_late"]

    # Try to find patients with resolved drug names first
    resolved_ndc5s = set(resolved["ndc5"].tolist()) if len(resolved) > 0 else set()
    interesting = test_patient_stats[
        (test_patient_stats["n_late"] >= 2)
        & (test_patient_stats["n_ontime"] >= 1)
        & (test_patient_stats["n_fills"] >= 5)
    ].sort_values("n_fills", ascending=False)

    # Prefer resolved drug names
    with_names = interesting[interesting["NDC5"].isin(resolved_ndc5s)]
    demo_source = with_names if len(with_names) > 0 else interesting

    if len(demo_source) > 0:
        demo_row = demo_source.iloc[0]
        demo_patient = demo_row["DESYNPUF_ID"]
        demo_ndc5 = demo_row["NDC5"]
        drug_name = get_drug_name(demo_ndc5, ndc_cache)
        print(f"\nDemo patient: {demo_patient}")
        print(f"  Drug: {drug_name} (NDC5={demo_ndc5})")
        print(f"  Fills: {int(demo_row['n_fills'])} ({int(demo_row['n_late'])} late, {int(demo_row['n_ontime'])} on-time)")
        plot_patient_timeline(
            demo_patient, merged_df, model, feature_cols,
            ndc5_filter=demo_ndc5, drug_name=drug_name,
        )
    else:
        print("\n  No suitable patient found for timeline demo")

    # ===================================================================
    # Done
    # ===================================================================
    elapsed = time.time() - t0
    print(f"\n{'=' * 60}")
    print(f"PIPELINE COMPLETE in {elapsed/60:.1f} minutes")
    print(f"{'=' * 60}")
    print(f"  Outputs saved to: outputs/")
    print(f"  - metrics.json")
    print(f"  - ndc_lookup.csv")
    print(f"  - shap_importance.png")
    print(f"  - shap_summary.png")
    print(f"  - calibration.png")
    print(f"  - patient_timeline_*.png")


if __name__ == "__main__":
    main()
