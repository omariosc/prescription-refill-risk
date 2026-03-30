"""Explainability: SHAP analysis and patient timeline demo."""

import lightgbm as lgb
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pandas as pd
import shap

from src.utils import OUTPUTS


def compute_shap_values(
    model: lgb.Booster,
    df: pd.DataFrame,
    feature_cols: list[str],
    max_samples: int = 5000,
) -> shap.Explanation:
    """Compute SHAP values for a dataset (sampled if large)."""
    print("Computing SHAP values...")
    if len(df) > max_samples:
        sample = df.sample(n=max_samples, random_state=42)
    else:
        sample = df

    explainer = shap.TreeExplainer(model)
    shap_values = explainer(sample[feature_cols])
    print(f"  SHAP computed for {len(sample):,} samples")
    return shap_values


def plot_shap_importance(shap_values: shap.Explanation, max_display: int = 20) -> None:
    """Plot and save SHAP feature importance bar chart."""
    fig, ax = plt.subplots(figsize=(10, 8))
    shap.plots.bar(shap_values, max_display=max_display, show=False, ax=ax)
    plt.tight_layout()
    path = OUTPUTS / "shap_importance.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  SHAP importance plot saved to {path}")


def plot_shap_summary(shap_values: shap.Explanation, max_display: int = 20) -> None:
    """Plot and save SHAP beeswarm summary plot."""
    fig, ax = plt.subplots(figsize=(10, 8))
    shap.plots.beeswarm(shap_values, max_display=max_display, show=False, ax=ax)
    plt.tight_layout()
    path = OUTPUTS / "shap_summary.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  SHAP summary plot saved to {path}")


def plot_patient_timeline(
    patient_id: str,
    labelled_df: pd.DataFrame,
    model: lgb.Booster,
    feature_cols: list[str],
    ndc5_filter: str | None = None,
) -> None:
    """Plot a patient's prescription timeline with risk scores.

    Shows fill dates, expected run-out dates, actual next fill dates,
    and color-coded risk scores.
    """
    patient_data = labelled_df[labelled_df["DESYNPUF_ID"] == patient_id].copy()
    if ndc5_filter:
        patient_data = patient_data[patient_data["NDC5"] == ndc5_filter]

    if len(patient_data) == 0:
        print(f"  No data for patient {patient_id}" +
              (f" NDC5={ndc5_filter}" if ndc5_filter else ""))
        return

    patient_data = patient_data.sort_values("SRVC_DT")

    # Predict risk scores
    risk_scores = model.predict(patient_data[feature_cols])
    patient_data["risk_score"] = risk_scores

    # Plot
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8), height_ratios=[3, 1],
                                    sharex=True)

    # Top: Timeline
    fill_dates = patient_data["SRVC_DT"].values
    runout_dates = patient_data["expected_runout"].values
    next_dates = patient_data["next_fill_date"].values
    late_flags = patient_data["late"].values
    scores = patient_data["risk_score"].values

    # Plot fill events
    colors = ["red" if l == 1 else "green" for l in late_flags]
    ax1.scatter(fill_dates, [1]*len(fill_dates), c=colors, s=100, zorder=5,
                label="Fill (red=late next, green=on-time)")

    # Plot supply periods as horizontal bars
    for i, (fd, rd) in enumerate(zip(fill_dates, runout_dates)):
        if pd.notna(rd):
            ax1.plot([fd, rd], [1, 1], color="steelblue", linewidth=6, alpha=0.3)

    # Plot gaps to next fill
    for i, (rd, nd) in enumerate(zip(runout_dates, next_dates)):
        if pd.notna(rd) and pd.notna(nd):
            gap_color = "red" if late_flags[i] == 1 else "green"
            ax1.plot([rd, nd], [1, 1], color=gap_color, linewidth=2, linestyle="--", alpha=0.5)

    ax1.set_yticks([])
    ax1.set_title(f"Patient {patient_id[:12]}... | NDC5={patient_data['NDC5'].iloc[0]}")
    ax1.legend(loc="upper left", fontsize=8)

    # Bottom: Risk scores over time
    ax2.bar(fill_dates, scores, width=20, color=colors, alpha=0.7)
    ax2.set_ylabel("Risk Score")
    ax2.set_ylim(0, 1)
    ax2.axhline(y=0.5, color="gray", linestyle="--", alpha=0.5)
    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax2.xaxis.set_major_locator(mdates.MonthLocator(interval=3))
    plt.xticks(rotation=45)

    plt.tight_layout()
    path = OUTPUTS / f"patient_timeline_{patient_id[:12]}.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Patient timeline saved to {path}")


def plot_calibration(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    n_bins: int = 10,
) -> None:
    """Plot and save calibration (reliability) diagram."""
    fraction_of_positives, mean_predicted_value = calibration_curve(
        y_true, y_prob, n_bins=n_bins, strategy="uniform"
    )

    fig, ax = plt.subplots(figsize=(8, 6))
    ax.plot([0, 1], [0, 1], "k--", label="Perfectly calibrated")
    ax.plot(mean_predicted_value, fraction_of_positives, "o-", label="Model")
    ax.set_xlabel("Mean predicted probability")
    ax.set_ylabel("Fraction of positives")
    ax.set_title("Calibration Plot")
    ax.legend()
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)

    plt.tight_layout()
    path = OUTPUTS / "calibration.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Calibration plot saved to {path}")
